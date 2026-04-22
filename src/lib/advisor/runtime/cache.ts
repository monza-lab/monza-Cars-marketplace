export interface CachedResponse {
  content: string
  toolCalls: Array<{ name: string; args: Record<string, unknown>; result_summary: string }>
}

interface Entry { value: CachedResponse; expiresAt: number }

export interface QueryCacheOptions { ttlMs: number; max: number }

export function makeQueryCache(opts: QueryCacheOptions) {
  const map = new Map<string, Entry>()

  function key(user: string, hash: string) { return `${user}::${hash}` }

  function purgeExpired(now: number) {
    for (const [k, v] of map) {
      if (v.expiresAt <= now) map.delete(k)
    }
  }

  return {
    get(user: string, hash: string): CachedResponse | undefined {
      const now = Date.now()
      const entry = map.get(key(user, hash))
      if (!entry) return undefined
      if (entry.expiresAt <= now) { map.delete(key(user, hash)); return undefined }
      return entry.value
    },
    set(user: string, hash: string, value: CachedResponse): void {
      const now = Date.now()
      purgeExpired(now)
      while (map.size >= opts.max) {
        const oldestKey = map.keys().next().value
        if (oldestKey) map.delete(oldestKey)
      }
      map.set(key(user, hash), { value, expiresAt: now + opts.ttlMs })
    },
    size() { return map.size },
  }
}

// Hashing helper: normalize + hash the query + conversation context fingerprint.
export function queryHash(input: { text: string; tier: string; contextFingerprint: string }): string {
  const normalized = input.text.trim().toLowerCase().replace(/\s+/g, " ")
  return `${input.tier}::${input.contextFingerprint}::${normalized}`
}

// Single process-wide cache instance. 1-hour TTL, 10k entries.
export const advisorQueryCache = makeQueryCache({ ttlMs: 60 * 60 * 1000, max: 10_000 })
