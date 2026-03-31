import * as cheerio from "cheerio"
import { proxyFetch } from "@/features/scrapers/common/proxy-fetch"
import type { ElferspotListingSummary } from "./types"

const SEARCH_PATHS: Record<string, string> = {
  en: "/en/search/",
  de: "/de/suchen/",
  nl: "/nl/zoeken/",
  fr: "/fr/rechercher/",
}

export function buildSearchUrl(page: number, language: string): string {
  const basePath = SEARCH_PATHS[language] ?? SEARCH_PATHS.en
  if (page <= 1) return `https://www.elferspot.com${basePath}`
  return `https://www.elferspot.com${basePath}page/${page}/`
}

export function extractSourceIdFromUrl(url: string): string | null {
  // URL pattern: /en/car/{slug}-{year}-{id}/
  const match = url.match(/-(\d{5,})\/?\s*$/)
  return match ? match[1] : null
}

export function parseSearchPage(html: string): ElferspotListingSummary[] {
  const $ = cheerio.load(html)
  const listings: ElferspotListingSummary[] = []

  // Elferspot uses a.content-teaser cards linking to /car/ or /fahrzeug/
  $("a.content-teaser[href*='/car/'], a.content-teaser[href*='/fahrzeug/']").each((_i, el) => {
    const href = $(el).attr("href") ?? ""
    if (!href.includes("elferspot.com")) return

    const sourceId = extractSourceIdFromUrl(href)
    if (!sourceId) return

    // Avoid duplicates within a page
    if (listings.some(l => l.sourceId === sourceId)) return

    const title = $(el).find("h3").first().text().trim()
      || $(el).attr("title")?.trim()
      || ""

    // Year is a text node inside div.teaser-atts (next to flag img)
    const attsText = $(el).find("div.teaser-atts").first().text().trim()
    const yearMatch = attsText.match(/\b(19|20)\d{2}\b/)
    let year = yearMatch ? parseInt(yearMatch[0], 10) : null

    // Fallback: extract year from URL slug (e.g., porsche-991-carrera-gts-2015-5857332)
    if (!year) {
      const urlYearMatch = href.match(/-((?:19|20)\d{2})-\d{5,}\/?$/)
      if (urlYearMatch) year = parseInt(urlYearMatch[1], 10)
    }

    // Country from flag img alt attribute (e.g., "DE", "US", "CH")
    const flagAlt = $(el).find("img.flag").first().attr("alt") || null

    // Thumbnail: use data-src (lazy-loaded), not src (placeholder SVG)
    const img = $(el).find("img.content-teaser-image").first()
    const thumbnailUrl = img.attr("data-src") || img.attr("src") || null

    listings.push({
      sourceUrl: href,
      sourceId,
      title: title || `Porsche ${sourceId}`,
      year,
      country: flagAlt,
      thumbnailUrl,
    })
  })

  return listings
}

export async function fetchSearchPage(page: number, language: string): Promise<{
  html: string
  listings: ElferspotListingSummary[]
}> {
  const url = buildSearchUrl(page, language)
  const response = await proxyFetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  })

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`)
  }

  const html = await response.text()
  const listings = parseSearchPage(html)
  return { html, listings }
}
