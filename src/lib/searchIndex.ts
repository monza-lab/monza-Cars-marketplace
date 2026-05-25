import { getBrandConfig, type SeriesConfig } from "./brandConfig"

export interface SeriesMatch {
  id: string
  label: string
  family: string
  yearRange: [number, number]
  order: number
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

function seriesMatchesQuery(s: SeriesConfig, q: string): boolean {
  if (s.id.toLowerCase().includes(q)) return true
  if (s.label.toLowerCase().includes(q)) return true
  if (s.family.toLowerCase().includes(q)) return true
  if (s.keywords.some((k) => k.toLowerCase().includes(q))) return true
  if (s.variants?.some((v) => v.label.toLowerCase().includes(q))) return true
  if (s.variants?.some((v) => v.keywords?.some((k) => k.toLowerCase().includes(q)))) return true
  if (isTypoMatch(q, s.label)) return true
  if (isTypoMatch(q, s.family)) return true
  return false
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
  const q = query.trim().toLowerCase()
  if (!q) return all.map(toMatch)
  return all.filter((s) => seriesMatchesQuery(s, q)).map(toMatch)
}
