/**
 * Fetch hero Porsche photos from Supabase for the MonzaHaus 30s promo video.
 *
 * Pulls photos for:
 *  - Lineage scenes: 930, 993, 991 (GT3 RS preferred), 992 (GT3 preferred)
 *  - Cross-continent montage: Japan, UK, Europe, USA — one strong photo each
 *  - Detail shots: 4-6 close-ups (any Porsche, prefer interiors / wheels / dashboards)
 *
 * Downloads to videos/monzahaus-30s/assets/photos/
 * Writes metadata JSON to videos/monzahaus-30s/assets/photo-manifest.json
 *
 * Usage: npx tsx scripts/fetch-monzahaus-photos.ts
 */

import { createClient } from "@supabase/supabase-js"
import { promises as fs } from "node:fs"
import path from "node:path"
import { request as httpsRequest } from "node:https"
import { request as httpRequest } from "node:http"
import { readFileSync } from "node:fs"

// minimal .env.local loader (avoids dotenv dependency)
function loadEnvFile(p: string) {
  try {
    const text = readFileSync(p, "utf8")
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i)
      if (!m) continue
      const [, k, raw] = m
      const v = raw.replace(/^['"]|['"]$/g, "")
      if (!process.env[k]) process.env[k] = v
    }
  } catch { /* ignore */ }
}
loadEnvFile(path.resolve(process.cwd(), ".env.local"))

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY")
  process.exit(1)
}

const OUT_DIR = path.resolve(
  process.cwd(),
  "videos/monzahaus-30s/assets/photos",
)
const MANIFEST = path.resolve(
  process.cwd(),
  "videos/monzahaus-30s/assets/photo-manifest.json",
)

type Listing = {
  id: string
  year: number | null
  make: string | null
  model: string | null
  trim: string | null
  title: string | null
  country: string | null
  region: string | null
  current_bid: number | null
  hammer_price: number | string | null
  final_price: number | null
  source: string | null
  source_url: string | null
  images: string[] | null
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
})

// ── helpers ──

function fetchUrl(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const lib = url.startsWith("https") ? httpsRequest : httpRequest
    const req = lib(
      url,
      {
        method: "GET",
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
        },
      },
      (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) {
          const loc = res.headers.location
          if (!loc) return reject(new Error("redirect with no location"))
          return resolve(fetchUrl(loc.startsWith("http") ? loc : new URL(loc, url).toString()))
        }
        if ((res.statusCode || 0) >= 400) {
          return reject(new Error(`HTTP ${res.statusCode} for ${url}`))
        }
        const chunks: Buffer[] = []
        res.on("data", (c) => chunks.push(c))
        res.on("end", () => resolve(Buffer.concat(chunks)))
      },
    )
    req.on("error", reject)
    req.setTimeout(15_000, () => req.destroy(new Error("timeout")))
    req.end()
  })
}

function fileExt(url: string): string {
  const u = new URL(url)
  const ext = path.extname(u.pathname).toLowerCase()
  return [".jpg", ".jpeg", ".png", ".webp"].includes(ext) ? ext : ".jpg"
}

async function download(url: string, outName: string): Promise<string | null> {
  const dest = path.join(OUT_DIR, outName + fileExt(url))
  try {
    const buf = await fetchUrl(url)
    if (buf.length < 200_000) {
      console.warn(`  skip tiny (${buf.length}b): ${url}`)
      return null
    }
    await fs.writeFile(dest, buf)
    console.log(`  ✓ ${path.basename(dest)} (${(buf.length / 1024).toFixed(0)}kb)`)
    return path.basename(dest)
  } catch (e) {
    console.warn(`  ✗ ${url}: ${(e as Error).message}`)
    return null
  }
}

// ── series queries ──

async function querySeries(
  seriesKeyword: string,
  trimKeywords: string[],
  limit = 25,
): Promise<Listing[]> {
  let q = supabase
    .from("listings")
    .select(
      "id, year, make, model, trim, title, country, region, current_bid, hammer_price, final_price, source, source_url, images",
    )
    .ilike("make", "porsche")
    .eq("source", "Elferspot")
    .not("images", "is", null)
    .limit(limit)

  // model OR title contains the series keyword
  q = q.or(`model.ilike.%${seriesKeyword}%,title.ilike.%${seriesKeyword}%`)

  const { data, error } = await q
  if (error) {
    console.error(`Query error for ${seriesKeyword}:`, error.message)
    return []
  }

  const rows = (data ?? []) as Listing[]
  // Prefer rows where trim hints at premium variants
  const scored = rows
    .map((r) => {
      const hay = `${r.trim ?? ""} ${r.title ?? ""} ${r.model ?? ""}`.toLowerCase()
      let score = 0
      for (const kw of trimKeywords) {
        if (hay.includes(kw.toLowerCase())) score += 10
      }
      const imgs = r.images?.length ?? 0
      score += Math.min(imgs, 10)
      const price =
        r.current_bid ??
        r.final_price ??
        (typeof r.hammer_price === "string"
          ? parseFloat(r.hammer_price)
          : r.hammer_price) ??
        0
      score += Math.log10(Math.max(1, price))
      return { r, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((x) => x.r)

  return scored
}

async function queryByCountry(
  countries: string[],
  limit = 10,
): Promise<Listing[]> {
  const orClause = countries.map((c) => `country.ilike.${c}`).join(",")
  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, year, make, model, trim, title, country, region, current_bid, hammer_price, final_price, source, source_url, images",
    )
    .ilike("make", "porsche")
    .eq("source", "Elferspot")
    .not("images", "is", null)
    .or(orClause)
    .order("current_bid", { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    console.error(`Country query error [${countries.join(",")}]:`, error.message)
    return []
  }
  return (data ?? []).filter((r) => (r.images?.length ?? 0) >= 3) as Listing[]
}

// ── main ──

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true })

  const manifest: {
    lineage: { series: string; file: string; meta: Listing }[]
    continents: { region: string; file: string; meta: Listing }[]
    details: { file: string; meta: Listing }[]
  } = { lineage: [], continents: [], details: [] }

  // ── Lineage hero series (8 generations, Elferspot only) ──
  const lineageTargets: { id: string; keyword: string; trim: string[] }[] = [
    { id: "356", keyword: "356", trim: ["speedster", "carrera", "a", "b", "c"] },
    { id: "930", keyword: "930", trim: ["turbo", "3.3", "3.0"] },
    { id: "964", keyword: "964", trim: ["turbo", "rs", "carrera 4", "c4"] },
    { id: "993", keyword: "993", trim: ["turbo", "carrera s", "rs", "gt2"] },
    { id: "996", keyword: "996", trim: ["gt3", "gt2", "turbo", "carrera 4s"] },
    { id: "997", keyword: "997", trim: ["gt3 rs", "gt3", "gt2 rs", "turbo s", "sport classic"] },
    { id: "991", keyword: "991", trim: ["gt3 rs", "gt3", "speedster", "r", "turbo s"] },
    { id: "992", keyword: "992", trim: ["gt3", "turbo s", "s/t", "sport classic"] },
  ]

  for (const t of lineageTargets) {
    console.log(`\n── ${t.id} (${t.keyword}) ──`)
    const rows = await querySeries(t.keyword, t.trim, 30)
    if (rows.length === 0) {
      console.warn(`  no listings for ${t.id}`)
      continue
    }
    // Download up to 2 photos per series for variety
    for (const r of rows.slice(0, 4)) {
      const imgs = r.images ?? []
      const url = imgs[0]
      if (!url) continue
      const fname = await download(url, `lineage_${t.id}_${r.id.slice(0, 8)}`)
      if (fname) {
        manifest.lineage.push({ series: t.id, file: fname, meta: r })
        if (manifest.lineage.filter((m) => m.series === t.id).length >= 2) break
      }
    }
  }

  // ── Markets (was "continents"). 6 buckets, all Elferspot-covered. ──
  const markets: { id: string; countries: string[] }[] = [
    { id: "DE", countries: ["%germany%", "DE"] },
    { id: "NL", countries: ["%netherlands%", "NL"] },
    { id: "BE", countries: ["%belgium%", "BE"] },
    { id: "IT", countries: ["%italy%", "IT"] },
    { id: "UK", countries: ["%united kingdom%", "%great britain%", "GB", "UK"] },
    { id: "US", countries: ["%united states%", "%usa%", "US"] },
  ]

  for (const c of markets) {
    console.log(`\n── ${c.id} market ──`)
    const rows = await queryByCountry(c.countries, 15)
    if (rows.length === 0) {
      console.warn(`  no listings for ${c.id}`)
      continue
    }
    for (const r of rows.slice(0, 3)) {
      const url = r.images?.[0]
      if (!url) continue
      const fname = await download(url, `market_${c.id}_${r.id.slice(0, 8)}`)
      if (fname) {
        manifest.continents.push({ region: c.id, file: fname, meta: r })
        if (manifest.continents.filter((m) => m.region === c.id).length >= 2) break
      }
    }
  }

  // ── Detail shots: Elferspot-only, 10+ photos, prefer halo models ──
  console.log("\n── detail shots ──")
  const { data: detailRows } = await supabase
    .from("listings")
    .select(
      "id, year, make, model, trim, title, country, region, current_bid, hammer_price, final_price, source, source_url, images",
    )
    .ilike("make", "porsche")
    .eq("source", "Elferspot")
    .not("images", "is", null)
    .or(
      "model.ilike.%carrera gt%,model.ilike.%918%,model.ilike.%959%,model.ilike.%gt3 rs%,model.ilike.%gt2 rs%,trim.ilike.%gt3 rs%,trim.ilike.%gt2 rs%",
    )
    .order("current_bid", { ascending: false, nullsFirst: false })
    .limit(40)

  const richRows = ((detailRows ?? []) as Listing[]).filter(
    (r) => (r.images?.length ?? 0) >= 10,
  )

  let detailCount = 0
  for (const r of richRows) {
    if (detailCount >= 5) break
    const imgs = r.images ?? []
    // Take photos from later in the array (typically detail / interior shots)
    const url = imgs[Math.min(5 + detailCount, imgs.length - 1)]
    if (!url) continue
    const fname = await download(url, `detail_${r.id.slice(0, 8)}_${detailCount}`)
    if (fname) {
      manifest.details.push({ file: fname, meta: r })
      detailCount++
    }
  }

  // Strip large fields from meta before writing
  const lite = (l: Listing) => ({
    id: l.id,
    year: l.year,
    make: l.make,
    model: l.model,
    trim: l.trim,
    title: l.title,
    country: l.country,
    region: l.region,
    price: l.current_bid ?? l.final_price ?? l.hammer_price ?? null,
    source: l.source,
  })

  const out = {
    generatedAt: new Date().toISOString(),
    lineage: manifest.lineage.map((m) => ({ ...m, meta: lite(m.meta) })),
    continents: manifest.continents.map((m) => ({ ...m, meta: lite(m.meta) })),
    details: manifest.details.map((m) => ({ ...m, meta: lite(m.meta) })),
  }

  await fs.writeFile(MANIFEST, JSON.stringify(out, null, 2))
  console.log(`\n── done ──`)
  console.log(
    `lineage:${out.lineage.length}  continents:${out.continents.length}  details:${out.details.length}`,
  )
  console.log(`manifest: ${MANIFEST}`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
