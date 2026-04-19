#!/usr/bin/env tsx
import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { createClient } from "@supabase/supabase-js"

// Minimal .env.local loader (avoid adding dotenv as a dep).
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

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY")
    process.exit(1)
  }
  const supabase = createClient(url, key)

  console.log("\n=== (1) Rich 992 GT3 (long description, 2022+) ===")
  // Broaden: pull many 992 GT3s, sort by description length desc
  const { data: rich } = await supabase
    .from("listings")
    .select("id, year, make, model, trim, description_text")
    .ilike("make", "porsche")
    .ilike("model", "%GT3%")
    .gte("year", 2022)
    .not("description_text", "is", null)
    .limit(200)
  const richSorted = (rich ?? []).slice().sort((a, b) => (b.description_text?.length ?? 0) - (a.description_text?.length ?? 0))
  const richPick = richSorted.find(l => (l.description_text?.length ?? 0) > 1500) ?? richSorted[0]
  if (richPick) {
    console.log(`  id: ${richPick.id}`)
    console.log(`  ${richPick.year} ${richPick.model}`)
    console.log(`  description length: ${richPick.description_text?.length}`)
  }
  console.log("  top 3 by desc length:")
  richSorted.slice(0, 3).forEach(l => console.log(`  - ${l.id} | ${l.year} ${l.model} | ${l.description_text?.length} chars`))

  console.log("\n=== (2) Sparse 991 Carrera (short description, 2012-2019) ===")
  // Broaden: 991 series Carrera variants
  const { data: sparse } = await supabase
    .from("listings")
    .select("id, year, make, model, trim, description_text")
    .ilike("make", "porsche")
    .ilike("model", "%Carrera%")
    .gte("year", 2012).lte("year", 2019)
    .not("description_text", "is", null)
    .limit(300)
  const sparseFiltered = (sparse ?? []).filter(l => {
    const len = l.description_text?.length ?? 0
    return len > 20 && len < 400
  })
  sparseFiltered.sort((a, b) => (a.description_text?.length ?? 0) - (b.description_text?.length ?? 0))
  const sparsePick = sparseFiltered[0]
  if (sparsePick) {
    console.log(`  id: ${sparsePick.id}`)
    console.log(`  ${sparsePick.year} ${sparsePick.model}`)
    console.log(`  description length: ${sparsePick.description_text?.length}`)
  } else {
    console.log("  (no sparse match — showing 5 shortest overall)")
    const all = (sparse ?? []).slice().sort((a, b) => (a.description_text?.length ?? 0) - (b.description_text?.length ?? 0))
    all.slice(0, 5).forEach(l => console.log(`  - ${l.id} | ${l.year} ${l.model} | ${l.description_text?.length} chars`))
  }
  console.log("  top 3 candidates in 20-400 range:")
  sparseFiltered.slice(0, 3).forEach(l => console.log(`  - ${l.id} | ${l.year} ${l.model} | ${l.description_text?.length} chars`))

  console.log("\n=== (3) Challenging 997 GT3 RS (2007-2011) ===")
  const { data: challenge } = await supabase
    .from("listings")
    .select("id, year, make, model, trim, description_text")
    .ilike("make", "porsche")
    .ilike("model", "%GT3 RS%")
    .gte("year", 2007).lte("year", 2011)
    .not("description_text", "is", null)
    .limit(20)
  const challengeSorted = (challenge ?? []).slice().sort((a, b) => (b.description_text?.length ?? 0) - (a.description_text?.length ?? 0))
  const challengePick = challengeSorted[0]
  if (challengePick) {
    console.log(`  id: ${challengePick.id}`)
    console.log(`  ${challengePick.year} ${challengePick.model}`)
    console.log(`  description length: ${challengePick.description_text?.length}`)
  }
  console.log("  top 3 by desc length:")
  challengeSorted.slice(0, 3).forEach(l => console.log(`  - ${l.id} | ${l.year} ${l.model} | ${l.description_text?.length} chars`))
}

main().catch(e => { console.error(e); process.exit(1) })
