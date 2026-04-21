// Live load test: 50 listings × 4 locales against the real rewriter.
// Diversifies across platforms and description lengths so the sample
// hits thin sources, rich BaT text, non-English seller copy, and the
// noisy-HTML scrapes from classic.com. Populates the cache and reports
// a per-platform and per-locale summary.
//
// Run with:
//   set -a; source .env.local; set +a; npx tsx scripts/load-test-listing-rewriter.ts
//
// Optional overrides:
//   NUM_LISTINGS=20 npx tsx scripts/load-test-listing-rewriter.ts  # smaller run
//   GEMINI_MODEL=gemini-2.5-flash-lite ...                          # cheaper model

import { readFileSync } from "node:fs"
import { resolve } from "node:path"

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
  } catch {}
}
loadDotEnv()

import { createClient } from "@supabase/supabase-js"
import { rewriteListing, type RewriterLocale } from "../src/lib/ai/listingRewriter"
import { loadListingSource } from "../src/lib/ai/listingSource"

const NUM_LISTINGS = Number(process.env.NUM_LISTINGS ?? 50)
const LOCALES: readonly RewriterLocale[] = ["en", "es", "de", "ja"]
const MAX_PER_PLATFORM = Math.ceil(NUM_LISTINGS / 3)

interface RawListing {
  id: string
  year: number
  make: string
  model: string
  description_text: string
  platform: string | null
}

interface Attempt {
  listingId: string
  platform: string | null
  descLen: number
  locale: RewriterLocale
  ok: boolean
  ms: number
  headline?: string
  error?: string
  cached?: boolean
}

async function pickDiverseSample(): Promise<RawListing[]> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data, error } = await supabase
    .from("listings")
    .select("id, year, make, model, description_text, platform")
    .eq("make", "Porsche")
    .not("description_text", "is", null)
    .order("id", { ascending: true })
    .limit(400)

  if (error) throw error
  const all = (data ?? []).filter(
    r => typeof r.description_text === "string" && (r.description_text as string).length >= 80,
  ) as RawListing[]

  // Bucket by platform, then pick across buckets for diversity.
  const byPlatform = new Map<string, RawListing[]>()
  for (const row of all) {
    const key = row.platform ?? "UNKNOWN"
    const arr = byPlatform.get(key) ?? []
    arr.push(row)
    byPlatform.set(key, arr)
  }

  // Within each platform, sort by description length so we pick a spread
  // of thin/medium/rich for each platform (first, middle, last thirds).
  const picked: RawListing[] = []
  for (const [, arr] of byPlatform) {
    arr.sort((a, b) => a.description_text.length - b.description_text.length)
    const chosen: RawListing[] = []
    const len = arr.length
    if (len === 0) continue
    chosen.push(arr[0])
    if (len >= 3) chosen.push(arr[Math.floor(len / 2)])
    if (len >= 2) chosen.push(arr[len - 1])
    // Top up from evenly-spaced indices until platform quota is hit.
    let i = 1
    while (chosen.length < MAX_PER_PLATFORM && i < len - 1) {
      const step = Math.floor(len / (MAX_PER_PLATFORM + 1))
      const idx = step * (chosen.length)
      if (idx > 0 && idx < len - 1 && !chosen.includes(arr[idx])) chosen.push(arr[idx])
      i++
    }
    picked.push(...chosen.slice(0, MAX_PER_PLATFORM))
  }

  // Shuffle a bit so we don't hit one platform 15× in a row.
  for (let i = picked.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[picked[i], picked[j]] = [picked[j], picked[i]]
  }

  return picked.slice(0, NUM_LISTINGS)
}

async function runOne(listing: RawListing, locale: RewriterLocale): Promise<Attempt> {
  const t0 = Date.now()
  try {
    const source = await loadListingSource(listing.id)
    if (!source) {
      return {
        listingId: listing.id, platform: listing.platform, descLen: listing.description_text.length,
        locale, ok: false, ms: Date.now() - t0, error: "source_load_null",
      }
    }
    const out = await rewriteListing({ listingId: `live-${listing.id}`, locale, source })
    if (!out) {
      return {
        listingId: listing.id, platform: listing.platform, descLen: listing.description_text.length,
        locale, ok: false, ms: Date.now() - t0, error: "rewriter_returned_null",
      }
    }
    return {
      listingId: listing.id, platform: listing.platform, descLen: listing.description_text.length,
      locale, ok: true, ms: Date.now() - t0, headline: out.headline,
    }
  } catch (err) {
    return {
      listingId: listing.id, platform: listing.platform, descLen: listing.description_text.length,
      locale, ok: false, ms: Date.now() - t0,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  return sorted[idx]
}

async function main() {
  const banner = "═".repeat(72)
  console.log(banner)
  console.log(`  LISTING REWRITER LOAD TEST — ${NUM_LISTINGS} listings × ${LOCALES.length} locales`)
  console.log(banner)

  console.log("[load] picking diverse sample from Supabase…")
  const sample = await pickDiverseSample()
  console.log(`[load] selected ${sample.length} listings`)

  const platformCounts = new Map<string, number>()
  for (const l of sample) {
    const k = l.platform ?? "UNKNOWN"
    platformCounts.set(k, (platformCounts.get(k) ?? 0) + 1)
  }
  console.log("[load] sample distribution:")
  for (const [k, n] of platformCounts) console.log(`        ${k.padEnd(20)} ${n}`)

  const attempts: Attempt[] = []
  let idx = 0
  const tStart = Date.now()

  for (const listing of sample) {
    idx++
    // All four locales for one listing in parallel — bounded concurrency.
    const results = await Promise.all(LOCALES.map(loc => runOne(listing, loc)))
    attempts.push(...results)
    const headline = results.find(r => r.ok)?.headline?.slice(0, 90) ?? "(no success)"
    const ok4 = results.filter(r => r.ok).length
    console.log(
      `[${String(idx).padStart(2)}/${sample.length}] ${listing.id.slice(0, 8)} · ` +
      `${(listing.platform ?? "?").padEnd(16)} · len=${String(listing.description_text.length).padStart(5)} · ` +
      `${ok4}/4 ok · headline="${headline}"`
    )
  }

  const totalMs = Date.now() - tStart
  console.log(`\n[load] total elapsed: ${(totalMs / 1000).toFixed(1)}s`)

  console.log("\n" + banner)
  console.log("  RESULTS BY LOCALE")
  console.log(banner)
  const byLocale = new Map<RewriterLocale, Attempt[]>()
  for (const a of attempts) {
    const arr = byLocale.get(a.locale) ?? []
    arr.push(a)
    byLocale.set(a.locale, arr)
  }
  for (const [loc, arr] of byLocale) {
    const ok = arr.filter(a => a.ok).length
    const fail = arr.length - ok
    const sortedMs = arr.filter(a => a.ok).map(a => a.ms).sort((x, y) => x - y)
    console.log(
      `  [${loc}] ${ok}/${arr.length} ok · p50=${percentile(sortedMs, 50)}ms · ` +
      `p95=${percentile(sortedMs, 95)}ms · fail=${fail}`
    )
  }

  console.log("\n" + banner)
  console.log("  RESULTS BY PLATFORM")
  console.log(banner)
  const byPlatform = new Map<string, Attempt[]>()
  for (const a of attempts) {
    const k = a.platform ?? "UNKNOWN"
    const arr = byPlatform.get(k) ?? []
    arr.push(a)
    byPlatform.set(k, arr)
  }
  for (const [plat, arr] of byPlatform) {
    const ok = arr.filter(a => a.ok).length
    console.log(`  ${plat.padEnd(20)} ${ok}/${arr.length} ok`)
  }

  const failures = attempts.filter(a => !a.ok)
  if (failures.length > 0) {
    console.log("\n" + banner)
    console.log("  FAILURES")
    console.log(banner)
    for (const f of failures.slice(0, 20)) {
      console.log(`  ${f.listingId.slice(0, 8)} [${f.locale}] ${f.error}`)
    }
    if (failures.length > 20) console.log(`  …and ${failures.length - 20} more`)
  }

  // Cache verification — how many unique rows landed?
  console.log("\n" + banner)
  console.log("  CACHE VERIFICATION")
  console.log(banner)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const ids = sample.map(s => `live-${s.id}`)
  const { data: cached } = await supabase
    .from("listing_translations")
    .select("listing_id, locale")
    .in("listing_id", ids)
  const cachedByLocale = new Map<string, number>()
  for (const r of cached ?? []) {
    cachedByLocale.set(r.locale as string, (cachedByLocale.get(r.locale as string) ?? 0) + 1)
  }
  for (const loc of LOCALES) {
    console.log(`  ${loc}: ${cachedByLocale.get(loc) ?? 0} rows cached`)
  }

  // Print five listing IDs to open in the browser for visual verification.
  const sampleForBrowser = sample
    .filter(l => attempts.filter(a => a.listingId === l.id).every(a => a.ok))
    .slice(0, 6)
  if (sampleForBrowser.length > 0) {
    console.log("\n" + banner)
    console.log("  URLs FOR BROWSER VERIFICATION")
    console.log(banner)
    for (const l of sampleForBrowser) {
      console.log(`  http://localhost:3000/en/cars/porsche/live-${l.id}`)
      console.log(`  http://localhost:3000/es/cars/porsche/live-${l.id}`)
      console.log(`  http://localhost:3000/de/cars/porsche/live-${l.id}`)
      console.log(`  http://localhost:3000/ja/cars/porsche/live-${l.id}`)
    }
  }
}

main().catch(err => {
  console.error("[load] FAILED", err)
  process.exit(1)
})
