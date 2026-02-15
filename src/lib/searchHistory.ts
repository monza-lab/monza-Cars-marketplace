export type SearchHistoryEntry = {
  query: string
  timestamp: number
}

const STORAGE_KEY = "monza_search_history"
const MAX_ENTRIES = 50

export function saveSearchQuery(query: string): void {
  try {
    const history = getSearchHistory()
    // Remove duplicate if exists
    const filtered = history.filter(
      (e) => e.query.toLowerCase() !== query.toLowerCase()
    )
    // Add new entry at the top
    filtered.unshift({ query, timestamp: Date.now() })
    // Cap at max entries
    if (filtered.length > MAX_ENTRIES) filtered.length = MAX_ENTRIES
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch {
    // SSR or private browsing — silently ignore
  }
}

export function getSearchHistory(): SearchHistoryEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    return JSON.parse(raw) as SearchHistoryEntry[]
  } catch {
    return []
  }
}

export function clearSearchHistory(): void {
  try {
    localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function removeSearchEntry(timestamp: number): void {
  try {
    const history = getSearchHistory()
    const filtered = history.filter((e) => e.timestamp !== timestamp)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered))
  } catch {
    // ignore
  }
}
