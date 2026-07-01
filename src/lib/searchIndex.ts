import { getBrandConfig, type SeriesConfig } from "./brandConfig"

export interface SeriesMatch {
  id: string
  label: string
  family: string
  yearRange: [number, number]
  order: number
}

export interface ListingSearchRankRow {
  title?: string | null
  model?: string | null
  trim?: string | null
  series?: string | null
  platform?: string | null
  source?: string | null
  year?: number | null
}

const LISTING_SEARCH_TEXT_COLUMNS = [
  "title",
  "model",
  "trim",
  "series",
  "source",
  "platform",
  "transmission",
  "engine",
  "location",
] as const

const MAKE_PREFIX_RE = /^(?:porsche|posrche|prsche|porshe|porche|porsch|porsche)\s+/i

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(MAKE_PREFIX_RE, "")
    .replace(/[–—]/g, "-")
    .replace(/[/-]+/g, " ")
    .replace(/[^a-z0-9.]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

function normalizeSearchQuery(query: string): string {
  return normalizeSearchText(query)
}

function queryTokens(query: string): string[] {
  const seen = new Set<string>()
  return normalizeSearchQuery(query)
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      if (seen.has(token)) return false
      seen.add(token)
      return true
    })
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i - 1
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

function isTypoMatch(query: string, target: string): boolean {
  if (query.length <= 3) return false
  const maxDist = query.length <= 5 ? 1 : 2
  const lower = target.toLowerCase()
  const targetWords = lower.split(/\s+/)
  for (const word of targetWords) {
    if (levenshtein(query, word) <= maxDist) return true
  }
  if (lower.length <= query.length + 3 && levenshtein(query, lower) <= maxDist) {
    return true
  }
  return false
}

function variantTexts(s: SeriesConfig): string[] {
  return (s.variants ?? []).flatMap((v) => [v.label, ...v.keywords])
}

function seriesSearchTexts(s: SeriesConfig): string[] {
  return [
    s.id,
    s.label,
    s.family,
    ...s.keywords,
    ...variantTexts(s),
  ].map(normalizeSearchText)
}

function scoreSeries(s: SeriesConfig, q: string, tokens: string[]): number {
  const texts = seriesSearchTexts(s)
  const id = normalizeSearchText(s.id)
  const label = normalizeSearchText(s.label)
  const family = normalizeSearchText(s.family)
  const keywordTexts = s.keywords.map(normalizeSearchText)
  const variants = variantTexts(s).map(normalizeSearchText)
  const searchable = texts.join(" ")

  if (id === q || label === q) return 1000
  if (label.startsWith(q) || id.startsWith(q)) return 900
  if (keywordTexts.some((text) => text === q)) return 850
  if (label.includes(q) || id.includes(q)) return 800
  if (variants.some((text) => text === q)) return 700
  if (keywordTexts.some((text) => text.includes(q))) return 650
  if (variants.some((text) => text.includes(q))) return 600
  if (family.includes(q)) return 550

  if (tokens.length > 1 && tokens.every((token) => searchable.includes(token))) {
    let score = 500
    if (tokens.some((token) => token === id || token === label)) score += 180
    if (tokens.some((token) => keywordTexts.includes(token))) score += 120
    if (tokens.some((token) => variants.some((text) => text.split(/\s+/).includes(token)))) {
      score += 80
    }
    return score
  }

  if (isTypoMatch(q, s.label)) return 450
  if (isTypoMatch(q, s.family)) return 400
  if (tokens.length === 1 && tokens.some((token) => texts.some((text) => isTypoMatch(token, text)))) {
    return 350
  }
  return 0
}

function toMatch(s: SeriesConfig): SeriesMatch {
  return {
    id: s.id,
    label: s.label,
    family: s.family,
    yearRange: s.yearRange,
    order: s.order,
  }
}

export function searchSeries(query: string, make = "porsche"): SeriesMatch[] {
  const config = getBrandConfig(make)
  if (!config) return []
  const all = [...config.series].sort((a, b) => a.order - b.order)
  const tokens = queryTokens(query)
  const q = tokens.join(" ")
  if (!q) return all.map(toMatch)
  return all
    .map((s) => ({ series: s, score: scoreSeries(s, q, tokens) }))
    .filter((r) => r.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return a.series.order - b.series.order
    })
    .map((r) => toMatch(r.series))
}

export function normalizeListingSearchTokens(query: string): string[] {
  const seen = new Set<string>()
  return query
    .replace(/[%_,()]/g, " ")
    .replace(/[/-]+/g, " ")
    .replace(/[^A-Za-z0-9.]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .filter((token) => {
      const key = token.toLowerCase()
      if (seen.has(key)) return false
      seen.add(key)
      return true
    })
}

export function buildListingSearchOrClauses(query: string): string[] {
  return normalizeListingSearchTokens(query).map((token) => {
    const clauses = LISTING_SEARCH_TEXT_COLUMNS.map(
      (column) => `${column}.ilike.%${token}%`,
    )
    if (/^\d{4}$/.test(token)) clauses.push(`year.eq.${token}`)
    return clauses.join(",")
  })
}

function tokenInText(token: string, text: string): boolean {
  if (!token) return true
  const words = text.split(/\s+/).filter(Boolean)
  if (words.includes(token)) return true
  if (token.length > 3 && text.includes(token)) return true
  return token.length > 3 && isTypoMatch(token, text)
}

function containsTokenPhrase(text: string, phrase: string): boolean {
  if (!phrase) return true
  const textWords = text.split(/\s+/).filter(Boolean)
  const phraseWords = phrase.split(/\s+/).filter(Boolean)
  if (phraseWords.length === 0) return true
  if (phraseWords.length > textWords.length) return false

  for (let i = 0; i <= textWords.length - phraseWords.length; i++) {
    let matches = true
    for (let j = 0; j < phraseWords.length; j++) {
      if (textWords[i + j] !== phraseWords[j]) {
        matches = false
        break
      }
    }
    if (matches) return true
  }
  return false
}

function startsWithTokenPhrase(text: string, phrase: string): boolean {
  if (!phrase) return true
  const textWords = text.split(/\s+/).filter(Boolean)
  const phraseWords = phrase.split(/\s+/).filter(Boolean)
  if (phraseWords.length > textWords.length) return false
  return phraseWords.every((word, index) => textWords[index] === word)
}

function listingSearchScore(row: ListingSearchRankRow, query: string, originalIndex: number): number {
  const q = normalizeSearchQuery(query)
  if (!q) return -originalIndex

  const tokens = queryTokens(query)
  const title = normalizeSearchText(row.title ?? "")
  const model = normalizeSearchText(row.model ?? "")
  const trim = normalizeSearchText(row.trim ?? "")
  const series = normalizeSearchText(row.series ?? "")
  const platform = normalizeSearchText(row.platform ?? row.source ?? "")
  const year = row.year ? String(row.year) : ""
  const haystack = [title, model, trim, series, platform, year].filter(Boolean).join(" ")
  const allTokensMatch = tokens.every((token) => tokenInText(token, haystack))

  let score = 0
  if (model === q) score += 1600
  if (title === q) score += 1500
  if (series === q) score += 1300
  if (startsWithTokenPhrase(model, q)) score += 1100
  if (startsWithTokenPhrase(title, q)) score += 1000
  if (containsTokenPhrase(model, q)) score += 900
  if (containsTokenPhrase(title, q)) score += 750
  if (containsTokenPhrase(trim, q)) score += 650
  if (containsTokenPhrase(series, q)) score += 600
  if (allTokensMatch) score += 300

  for (const token of tokens) {
    if (model.split(/\s+/).includes(token)) score += 80
    else if (model.includes(token)) score += 50
    if (title.split(/\s+/).includes(token)) score += 35
    else if (title.includes(token)) score += 20
    if (trim.includes(token)) score += 20
    if (series === token) score += 90
    if (year === token) score += 80
  }

  if (!allTokensMatch) score -= 500
  return score - originalIndex / 1000
}

export function rankListingSearchRows<T extends ListingSearchRankRow>(
  rows: T[],
  query: string,
): T[] {
  if (!query.trim()) return rows
  return rows
    .map((row, index) => ({ row, score: listingSearchScore(row, query, index) }))
    .sort((a, b) => b.score - a.score)
    .map((r) => r.row)
}
