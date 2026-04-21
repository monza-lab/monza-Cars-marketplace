// One-off live smoke test for the listing rewriter.
// Ensures listing_translations exists, picks a clean Bring-a-Trailer listing
// with a meaty description, runs the rewriter for en/es/de/ja, prints each
// output, and verifies the cache.
//
// Run with: source .env.local before invoking so GEMINI_API_KEY and Supabase
// env are captured at module-load time (gemini.ts reads them eagerly).
//
//   set -a; source .env.local; set +a; npx tsx scripts/smoke-listing-rewriter.ts

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
import { Client } from "pg"
import { rewriteListing, type RewriterLocale } from "../src/lib/ai/listingRewriter"
import { loadListingSource } from "../src/lib/ai/listingSource"

async function ensureTable() {
  const url = process.env.DATABASE_URL
  if (!url) {
    console.log("[smoke] no DATABASE_URL — assuming listing_translations already exists; skipping DDL")
    return
  }
  const c = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
  await c.connect()
  try {
    const exists = await c.query(
      `select 1 from information_schema.tables where table_schema='public' and table_name='listing_translations'`,
    )
    if (exists.rowCount && exists.rowCount > 0) {
      console.log("[smoke] listing_translations already present")
    } else {
      const sql = readFileSync(
        resolve(process.cwd(), "supabase/migrations/20260421_create_listing_translations.sql"),
        "utf8",
      )
      await c.query(sql)
      console.log("[smoke] applied listing_translations migration")
    }
  } finally {
    await c.end()
  }
}

async function pickBaTListing() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )

  // Prefer BaT — descriptions there are editorial-quality rather than
  // scraped site chrome.
  const { data, error } = await supabase
    .from("listings")
    .select("id, year, make, model, description_text, platform")
    .eq("make", "Porsche")
    .eq("platform", "BRING_A_TRAILER")
    .not("description_text", "is", null)
    .order("id", { ascending: true })
    .limit(60)

  if (error) throw error
  const candidates = (data ?? [])
    .filter(r => typeof r.description_text === "string")
    // Clean descriptions are typically 800–4000 chars. Anything above
    // 8000 is usually site chrome accidentally scraped.
    .filter(r => {
      const n = (r.description_text as string).length
      return n >= 600 && n <= 6000
    })
    .sort((a, b) => (b.description_text as string).length - (a.description_text as string).length)

  const picked = candidates[0]
  if (!picked) throw new Error("No clean BaT Porsche listing found")
  return picked as {
    id: string; year: number; make: string; model: string;
    description_text: string; platform: string | null
  }
}

async function main() {
  console.log("═".repeat(70))
  console.log("  LISTING REWRITER — LIVE SMOKE TEST")
  console.log("═".repeat(70))

  await ensureTable()

  const picked = await pickBaTListing()
  console.log(`\n[smoke] picked listing id=${picked.id}  (${picked.year} ${picked.model})`)
  console.log(`[smoke] platform=${picked.platform}`)
  console.log(`[smoke] description length=${picked.description_text.length} chars`)
  console.log(`\n── Source description ──`)
  console.log(picked.description_text.slice(0, 1200) + (picked.description_text.length > 1200 ? "…" : ""))

  const source = await loadListingSource(picked.id)
  if (!source) throw new Error(`loadListingSource returned null for id=${picked.id}`)

  const locales: RewriterLocale[] = ["en", "es", "de", "ja"]
  for (const locale of locales) {
    console.log(`\n── Generating [${locale}] ──`)
    const t0 = Date.now()
    const out = await rewriteListing({ listingId: `live-${picked.id}`, locale, source })
    const ms = Date.now() - t0
    if (!out) {
      console.log(`[${locale}] FAILED — service returned null (see logs above)`)
    } else {
      console.log(`[${locale}] ${ms}ms  promptVersion=${out.promptVersion}  model=${out.model}`)
      console.log(`  headline: ${out.headline}`)
      out.highlights.forEach(h => console.log(`     • ${h}`))
    }
  }

  console.log("\n" + "═".repeat(70))
  console.log("  CACHE VERIFICATION")
  console.log("═".repeat(70))

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { auth: { persistSession: false } },
  )
  const { data: cached } = await supabase
    .from("listing_translations")
    .select("listing_id, locale, prompt_version, model, generated_at")
    .eq("listing_id", `live-${picked.id}`)

  console.table(cached ?? [])
}

main().catch(err => {
  console.error("[smoke] FAILED", err)
  process.exit(1)
})
