import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import type {
  CollectorRunConfig,
  CollectorResult,
  CollectorCounts,
  ScrapeMeta,
  NormalizedListing,
} from "./types";
import { generateShards } from "./shards";
import { discoverShard, discoverShardWithScrapling } from "./discover";
import { canUseScrapling } from "./scrapling";
import { fetchAndParseDetail } from "./detail";
import { normalizeListing, normalizeFromSearch, isLuxuryCarListing } from "./normalize";
import { deriveSourceId } from "./id";
import { NavigationRateLimiter, withRetry } from "./net";
import {
  loadCheckpoint,
  saveCheckpoint,
  updateShardCheckpoint,
  markShardComplete,
  getIncompleteShards,
  getShardResumePage,
} from "./checkpoint";
import { launchStealthBrowser, createStealthContext, createPage, closeBrowser } from "./browser";
import { createSupabaseWriter, createDryRunWriter } from "./supabase_writer";
import { logEvent } from "./logging";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const MAX_CONSECUTIVE_BLOCKS = 5;
const CONTEXT_REFRESH_INTERVAL = 100;

export interface HardFailureErrorInput {
  counts: CollectorCounts;
  errors: string[];
  shardsCompleted: number;
  shardsTotal: number;
}

export function buildHardFailureError(input: HardFailureErrorInput): Error | null {
  const { counts, errors, shardsCompleted, shardsTotal } = input;

  const repeatedAkamaiBlocks =
    counts.akamaiBlocked >= MAX_CONSECUTIVE_BLOCKS ||
    errors.some((message) => /consecutive Akamai blocks/i.test(message));

  if (repeatedAkamaiBlocks) {
    return new Error(
      [
        "repeated Akamai blocks",
        `discovered=${counts.discovered}`,
        `detailsFetched=${counts.detailsFetched}`,
        `normalized=${counts.normalized}`,
        `written=${counts.written}`,
        `errors=${counts.errors}`,
        `skippedDuplicate=${counts.skippedDuplicate}`,
        `akamaiBlocked=${counts.akamaiBlocked}`,
        `shardsCompleted=${shardsCompleted}/${shardsTotal}`,
      ].join(" | "),
    );
  }

  if (counts.discovered === 0 && counts.written === 0) {
    return new Error(
      [
        "zero output",
        `discovered=${counts.discovered}`,
        `detailsFetched=${counts.detailsFetched}`,
        `normalized=${counts.normalized}`,
        `written=${counts.written}`,
        `errors=${counts.errors}`,
        `skippedDuplicate=${counts.skippedDuplicate}`,
        `akamaiBlocked=${counts.akamaiBlocked}`,
        `shardsCompleted=${shardsCompleted}/${shardsTotal}`,
      ].join(" | "),
    );
  }

  return null;
}

export async function runAutoScout24Collector(config: CollectorRunConfig): Promise<CollectorResult> {
  const runId = crypto.randomUUID();
  const scrapeTimestamp = new Date().toISOString();
  const meta: ScrapeMeta = { runId, scrapeTimestamp };
  const errors: string[] = [];

  const counts: CollectorCounts = {
    discovered: 0,
    detailsFetched: 0,
    normalized: 0,
    written: 0,
    errors: 0,
    skippedDuplicate: 0,
    akamaiBlocked: 0,
  };

  const startMs = Date.now();

  logEvent({ level: "info", event: "collector.start", runId, config: { ...config, proxyPassword: "***" } });

  // Generate or use provided shards
  const allShards = config.shards ?? generateShards({
    countries: config.countries,
    maxPagesPerShard: config.maxPagesPerShard,
  });

  // Load checkpoint, filter to incomplete shards
  let checkpoint = await loadCheckpoint(config.checkpointPath);
  let incompleteIds = getIncompleteShards(checkpoint, allShards);

  // Auto-reset: if all shards are already complete, start a fresh run
  if (incompleteIds.length === 0 && allShards.length > 0) {
    logEvent({ level: "info", event: "collector.checkpoint_reset", runId, reason: "all shards already complete" });
    checkpoint = { version: 1, updatedAt: new Date().toISOString(), shards: {}, totalWritten: 0, totalErrors: 0 };
    await saveCheckpoint(config.checkpointPath, checkpoint);
    incompleteIds = allShards.map((s) => s.id);
  }

  const pendingShards = allShards.filter((s) => incompleteIds.includes(s.id));

  logEvent({
    level: "info",
    event: "collector.shards_loaded",
    runId,
    total: allShards.length,
    pending: pendingShards.length,
    completed: allShards.length - pendingShards.length,
  });

  // Writer
  const writer = config.dryRun ? createDryRunWriter() : createSupabaseWriter();

  // Ensure output directory
  const outputDir = path.dirname(config.outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Scrapling mode: skip browser entirely
  const useScrapling = canUseScrapling();
  logEvent({ level: "info", event: "collector.mode", runId, mode: useScrapling ? "scrapling" : "playwright" });

  const browser = useScrapling ? null : await launchStealthBrowser({
    headless: config.headless,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  });

  let context = browser ? await createStealthContext(browser, {
    headless: config.headless,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  }) : null;
  let page = context ? await createPage(context) : null;
  const rateLimiter = new NavigationRateLimiter(config.navigationDelayMs);

  const seenSourceIds = new Set<string>();
  let consecutiveBlocks = 0;
  let shardsCompleted = allShards.length - pendingShards.length;
  let totalListingsProcessed = 0;

  try {
    for (const shard of pendingShards) {
      // Time-budget guard: stop if less than 15s remaining
      if (config.timeBudgetMs && (Date.now() - startMs) > (config.timeBudgetMs - 15_000)) {
        logEvent({ level: "info", event: "collector.time_budget_exceeded", runId, elapsedMs: Date.now() - startMs });
        break;
      }

      if (totalListingsProcessed >= config.maxListings) {
        logEvent({ level: "info", event: "collector.max_listings_reached", runId, limit: config.maxListings });
        break;
      }

      if (consecutiveBlocks >= MAX_CONSECUTIVE_BLOCKS) {
        const msg = `Aborting: ${MAX_CONSECUTIVE_BLOCKS} consecutive Akamai blocks`;
        logEvent({ level: "error", event: "collector.circuit_breaker", runId, message: msg });
        errors.push(msg);
        break;
      }

      logEvent({ level: "info", event: "collector.shard_start", runId, shard: shard.id });

      const resumePage = getShardResumePage(checkpoint, shard.id);

      // Discover listings for this shard
      const discoverResult = useScrapling
        ? await discoverShardWithScrapling({
            shard,
            runId,
            navigationDelayMs: config.navigationDelayMs,
            resumeFromPage: resumePage,
            onPageDone: async (shardId, pageNum, found) => {
              checkpoint = updateShardCheckpoint(checkpoint, shardId, pageNum, found);
              await saveCheckpoint(config.checkpointPath, checkpoint);
            },
          })
        : await (() => {
            if (!page) {
              throw new Error("Playwright page unavailable in browser collector mode");
            }

            return discoverShard({
              page,
              shard,
              rateLimiter,
              pageTimeoutMs: config.pageTimeoutMs,
              runId,
              resumeFromPage: resumePage,
              onPageDone: async (shardId, pageNum, found) => {
                checkpoint = updateShardCheckpoint(checkpoint, shardId, pageNum, found);
                await saveCheckpoint(config.checkpointPath, checkpoint);
              },
            });
          })();

      counts.discovered += discoverResult.listings.length;

      if (discoverResult.listings.length === 0 && discoverResult.pagesProcessed === 0) {
        // Likely blocked
        consecutiveBlocks++;
      } else {
        consecutiveBlocks = 0;
      }

      // Process discovered listings
      for (const searchListing of discoverResult.listings) {
        if (totalListingsProcessed >= config.maxListings) break;

        const sourceId = deriveSourceId({ sourceId: searchListing.id, sourceUrl: searchListing.url });
        if (seenSourceIds.has(sourceId)) {
          counts.skippedDuplicate++;
          continue;
        }
        seenSourceIds.add(sourceId);

        if (!isLuxuryCarListing({ make: searchListing.make, title: searchListing.title, targetMake: config.make })) {
          continue;
        }

        // Refresh browser context periodically (skip in scrapling mode — no browser)
        if (!useScrapling && totalListingsProcessed > 0 && totalListingsProcessed % CONTEXT_REFRESH_INTERVAL === 0) {
          logEvent({ level: "info", event: "collector.context_refresh", runId, index: totalListingsProcessed });
          if (!browser) {
            throw new Error("Playwright browser unavailable during context refresh");
          }
          await page?.close().catch(() => {});
          await context?.close().catch(() => {});
          context = await createStealthContext(browser, {
            headless: config.headless,
            proxyServer: config.proxyServer,
            proxyUsername: config.proxyUsername,
            proxyPassword: config.proxyPassword,
          });
          page = await createPage(context);
        }

        let normalized: NormalizedListing | null = null;

        if (config.scrapeDetails && !useScrapling) {
          try {
            if (!page) {
              throw new Error("Playwright page unavailable during detail scrape");
            }
            const detailPage = page;
            await rateLimiter.waitBeforeNavigation();
            const { value: detail } = await withRetry(
              async () => fetchAndParseDetail({ page: detailPage, url: searchListing.url, pageTimeoutMs: config.pageTimeoutMs, runId }),
              { retries: 1, baseDelayMs: 3000 },
            );
            counts.detailsFetched++;
            consecutiveBlocks = 0;
            normalized = normalizeListing({ search: searchListing, detail, meta, targetMake: config.make });
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            if (msg.includes("Akamai") || msg.includes("challenge")) {
              consecutiveBlocks++;
              counts.akamaiBlocked++;
              logEvent({ level: "warn", event: "collector.akamai_block", runId, url: searchListing.url });
            } else {
              consecutiveBlocks = 0;
              logEvent({ level: "warn", event: "collector.detail_error", runId, url: searchListing.url, error: msg });
            }
            // Fallback to summary-only
            normalized = normalizeFromSearch({ search: searchListing, meta, targetMake: config.make });
          }
        } else {
          normalized = normalizeFromSearch({ search: searchListing, meta, targetMake: config.make });
        }

        if (normalized) {
          counts.normalized++;
          try {
            const { wrote } = await writer.upsertAll(normalized, meta, config.dryRun);
            if (wrote) counts.written++;
            await fs.appendFile(config.outputPath, JSON.stringify(normalized) + "\n", "utf8");
          } catch (err) {
            counts.errors++;
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Write error: ${msg}`);
            logEvent({ level: "error", event: "collector.write_error", runId, error: msg });
          }
        }

        totalListingsProcessed++;

        // Progress log every 25 listings
        if (totalListingsProcessed % 25 === 0) {
          logEvent({ level: "info", event: "collector.progress", runId, processed: totalListingsProcessed, counts });
        }
      }

      // Mark shard complete
      checkpoint = markShardComplete(checkpoint, shard.id);
      checkpoint = { ...checkpoint, totalWritten: counts.written, totalErrors: counts.errors };
      await saveCheckpoint(config.checkpointPath, checkpoint);
      shardsCompleted++;

      logEvent({
        level: "info",
        event: "collector.shard_done",
        runId,
        shard: shard.id,
        discovered: discoverResult.listings.length,
        shardsCompleted,
        shardsTotal: allShards.length,
      });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal: ${msg}`);
    logEvent({ level: "error", event: "collector.fatal", runId, error: msg });
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await closeBrowser(browser);
  }

  logEvent({ level: "info", event: "collector.done", runId, counts, shardsCompleted, shardsTotal: allShards.length });

  if (!config.skipMonitoring) {
    const endTime = Date.now();
    const runtime = process.env.GITHUB_ACTIONS ? 'github_actions' as const : 'cli' as const;

    await recordScraperRun({
      scraper_name: 'autoscout24',
      run_id: runId,
      started_at: scrapeTimestamp,
      finished_at: new Date(endTime).toISOString(),
      success: errors.length === 0 || counts.written > 0,
      runtime,
      duration_ms: endTime - new Date(scrapeTimestamp).getTime(),
      discovered: counts.discovered,
      written: counts.written,
      errors_count: counts.errors,
      details_fetched: counts.detailsFetched,
      normalized: counts.normalized,
      skipped_duplicate: counts.skippedDuplicate,
      bot_blocked: counts.akamaiBlocked,
      error_messages: errors.length > 0 ? errors : undefined,
    });
  }

  return {
    runId,
    shardsCompleted,
    shardsTotal: allShards.length,
    counts,
    errors,
    outputPath: config.outputPath,
  };
}

/**
 * Convenience wrapper with sensible defaults.
 */
export async function runCollector(overrides?: Partial<CollectorRunConfig>): Promise<CollectorResult> {
  const config: CollectorRunConfig = {
    mode: "daily",
    make: "Porsche",
    countries: ["D", "A", "B", "E", "F", "I", "L", "NL"],
    maxPagesPerShard: 20,
    maxListings: 50000,
    headless: true,
    proxyServer: process.env.DECODO_PROXY_URL,
    proxyUsername: process.env.DECODO_PROXY_USER,
    proxyPassword: process.env.DECODO_PROXY_PASS,
    navigationDelayMs: 3000,
    pageTimeoutMs: 30000,
    scrapeDetails: false,
    checkpointPath: "var/autoscout24_collector/checkpoint.json",
    outputPath: "var/autoscout24_collector/listings.jsonl",
    dryRun: false,
    ...overrides,
  };
  return runAutoScout24Collector(config);
}
