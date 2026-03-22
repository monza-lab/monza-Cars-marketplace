import * as cheerio from "cheerio"
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

  // Elferspot listing cards are links to /en/car/ or /de/fahrzeug/ pages
  $("a[href*='/car/'], a[href*='/fahrzeug/']").each((_i, el) => {
    const href = $(el).attr("href") ?? ""
    if (!href.includes("elferspot.com")) return

    const sourceId = extractSourceIdFromUrl(href)
    if (!sourceId) return

    // Avoid duplicates within a page
    if (listings.some(l => l.sourceId === sourceId)) return

    const title = $(el).find("h2, h3, .title").first().text().trim()
      || $(el).attr("title")?.trim()
      || ""

    const yearText = $(el).find(".year, .construction-year").first().text().trim()
    const yearMatch = yearText.match(/\b(19|20)\d{2}\b/)
    const year = yearMatch ? parseInt(yearMatch[0], 10) : null

    const img = $(el).find("img").first()
    const thumbnailUrl = img.attr("src") || img.attr("data-src") || null

    listings.push({
      sourceUrl: href,
      sourceId,
      title: title || `Porsche ${sourceId}`,
      year,
      country: null,
      thumbnailUrl,
    })
  })

  return listings
}

export async function fetchSearchPage(page: number, language: string, delayMs: number): Promise<{
  html: string
  listings: ElferspotListingSummary[]
}> {
  const url = buildSearchUrl(page, language)
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
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
