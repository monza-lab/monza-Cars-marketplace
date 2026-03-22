import crypto from "node:crypto"
import { promises as fs } from "node:fs"
import path from "node:path"

import { loadCheckpoint, saveCheckpoint } from "./checkpoint"
import { fetchSearchPage } from "./discover"
import { fetchDetailPage } from "./detail"
import { normalizeListing } from "./normalize"
import { upsertListing } from "./supabase_writer"
import type { CollectorRunConfig, CollectorResult, CollectorCounts } from "./types"

export async function runElferspotCollector(config: CollectorRunConfig): Promise<CollectorResult> {
  const runId = crypto.randomUUID()
  const counts: CollectorCounts = { discovered: 0, written: 0, enriched: 0, errors: 0 }
  const errors: string[] = []
  const CONSECUTIVE_FAILURE_LIMIT = 5
  let consecutiveFailures = 0

  console.log(`[elferspot] Starting run ${runId}, maxPages=${config.maxPages}, details=${config.scrapeDetails}`)

  const checkpoint = await loadCheckpoint(config.checkpointPath)
  const processedSet = new Set(checkpoint.processedIds)
  const startPage = checkpoint.lastCompletedPage + 1

  // Ensure output dir
  const outputDir = path.dirname(config.outputPath)
  await fs.mkdir(outputDir, { recursive: true })

  for (let page = startPage; page <= config.maxPages; page++) {
    if (counts.discovered >= config.maxListings) {
      console.log(`[elferspot] Reached maxListings=${config.maxListings}`)
      break
    }

    try {
      console.log(`[elferspot] Fetching page ${page}...`)
      const { listings } = await fetchSearchPage(page, config.language, config.delayMs)

      if (listings.length === 0) {
        console.log(`[elferspot] No listings on page ${page}, stopping.`)
        break
      }

      for (const summary of listings) {
        if (processedSet.has(summary.sourceId)) continue
        if (counts.discovered >= config.maxListings) break

        counts.discovered++

        try {
          let detail = null
          if (config.scrapeDetails) {
            // Wait before detail fetch (rate limiting)
            await sleep(config.delayMs)
            detail = await fetchDetailPage(summary.sourceUrl)
            counts.enriched++
          }

          const normalized = normalizeListing(summary, detail)
          if (!normalized) continue

          const wrote = await upsertListing(normalized, config.dryRun)
          if (wrote) counts.written++

          // Append to JSONL
          await fs.appendFile(config.outputPath, JSON.stringify(normalized) + "\n", "utf8")

          processedSet.add(summary.sourceId)
          consecutiveFailures = 0  // Reset on success
        } catch (err) {
          counts.errors++
          consecutiveFailures++
          const msg = err instanceof Error ? err.message : String(err)
          errors.push(`${summary.sourceUrl}: ${msg}`)

          // Circuit-break on 403/429
          if (/\b(403|429)\b/.test(msg)) {
            errors.push("Circuit-break: blocked by server")
            break
          }

          // Circuit-break on consecutive failures
          if (consecutiveFailures >= CONSECUTIVE_FAILURE_LIMIT) {
            errors.push(`Circuit-break: ${CONSECUTIVE_FAILURE_LIMIT} consecutive failures`)
            break
          }
        }
      }

      // Save checkpoint after each page
      await saveCheckpoint(config.checkpointPath, {
        version: 1,
        updatedAt: new Date().toISOString(),
        lastCompletedPage: page,
        processedIds: Array.from(processedSet),
        written: counts.written,
        errors: counts.errors,
      })

      // Wait before next page (rate limiting)
      if (page < config.maxPages) {
        await sleep(config.delayMs)
      }
    } catch (err) {
      counts.errors++
      const msg = err instanceof Error ? err.message : String(err)
      errors.push(`Page ${page}: ${msg}`)

      if (/\b(403|429)\b/.test(msg)) {
        errors.push("Circuit-break: blocked by server")
        break
      }
    }
  }

  console.log(`[elferspot] Run complete: discovered=${counts.discovered}, written=${counts.written}, errors=${counts.errors}`)
  return { runId, counts, errors }
}

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}
