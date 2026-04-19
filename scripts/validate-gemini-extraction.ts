#!/usr/bin/env tsx
/**
 * Validates Gemini signal extraction against 3 real listings.
 * Run: cd producto && npx tsx scripts/validate-gemini-extraction.ts
 * Requires GEMINI_API_KEY and Supabase creds in .env.local.
 *
 * Task 28 (Haus Report Phase 5): run live Gemini extraction against the
 * validation listings recorded in Task 27 and save regression fixtures so
 * future prompt changes can be diffed.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

// Minimal .env.local loader (matches scripts/select-validation-listings.ts).
function loadDotEnv() {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8")
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i)
      if (!m) continue
      const [, k, rawV] = m
      if (process.env[k]) continue
      const v = rawV.replace(/^"|"$/g, "").replace(/^'|'$/g, "")
      process.env[k] = v
    }
  } catch {
    // .env.local missing is fine if env is already set
  }
}
loadDotEnv()

const LISTINGS = [
  { label: "rich", id: "38c0f512-1eeb-43b7-a73c-1f81af1534ca" },
  { label: "sparse", id: "2cd90406-5857-47cb-b593-4a497bbddec7" },
  { label: "challenging", id: "891effde-c23e-4bf8-86de-117631cdff7c" },
] as const

// Gemini has a generous input window but extraction prompts waste tokens on
// very long descriptions — truncate rich scenarios defensively.
const MAX_DESCRIPTION_CHARS = 20000

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }
  if (!process.env.GEMINI_API_KEY) {
    console.error("Missing GEMINI_API_KEY")
    process.exit(1)
  }
  const supabase = createClient(supabaseUrl, supabaseKey)

  // Dynamic import AFTER env vars are loaded, since gemini.ts reads
  // GEMINI_API_KEY at module-load time.
  const { extractTextSignals } = await import("../src/lib/fairValue/extractors/text")

  for (const { label, id } of LISTINGS) {
    console.log(`\n=== ${label} (${id}) ===`)
    const { data: listing, error } = await supabase
      .from("listings")
      .select("id, year, make, model, description_text")
      .eq("id", id)
      .single()

    if (error || !listing) {
      console.error(`  Failed to fetch: ${error?.message ?? "not found"}`)
      continue
    }
    const rawDesc = listing.description_text ?? ""
    const truncated = rawDesc.length > MAX_DESCRIPTION_CHARS
    const desc = truncated ? rawDesc.slice(0, MAX_DESCRIPTION_CHARS) : rawDesc
    console.log(`  ${listing.year} ${listing.model} | ${rawDesc.length} chars${truncated ? ` (truncated to ${desc.length})` : ""}`)

    // Retry once on failure for network blips / transient 5xx.
    // 4096 output tokens: the default 2048 was truncating the JSON payload on
    // rich + challenging listings (longer arrays of modifications/panels).
    let result = await extractTextSignals({ description: desc, maxOutputTokens: 4096 })
    if (!result.ok) {
      console.warn(`  First attempt failed: ${result.error} — retrying once...`)
      await new Promise(r => setTimeout(r, 3000))
      result = await extractTextSignals({ description: desc, maxOutputTokens: 4096 })
    }
    if (!result.ok) {
      console.error(`  Extraction failed after retry: ${result.error}`)
      continue
    }

    console.log(`  ${result.signals.length} signals extracted`)
    result.signals.forEach(s => console.log(`    - ${s.key}: ${s.value_display}`))

    const output = {
      listing_id: listing.id,
      listing_label: label,
      listing_meta: {
        year: listing.year,
        model: listing.model,
        description_chars: rawDesc.length,
        description_truncated_to: truncated ? desc.length : null,
      },
      extracted_at: new Date().toISOString(),
      signals_count: result.signals.length,
      signals: result.signals,
      raw_payload: result.rawPayload,
    }
    const outPath = resolve("src/lib/ai/__fixtures__", `gemini-signals-${label}.json`)
    writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n")
    console.log(`  saved ${outPath}`)
  }
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
