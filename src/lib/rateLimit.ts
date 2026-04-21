export interface RateLimiter {
  check(key: string): { allowed: boolean; remaining: number }
}

export interface RateLimiterOptions {
  limit: number
  windowMs: number
}

export function createRateLimiter(opts: RateLimiterOptions): RateLimiter {
  const hits = new Map<string, number[]>()

  return {
    check(key: string) {
      const now = Date.now()
      const cutoff = now - opts.windowMs
      const bucket = (hits.get(key) ?? []).filter(ts => ts > cutoff)
      if (bucket.length >= opts.limit) {
        hits.set(key, bucket)
        return { allowed: false, remaining: 0 }
      }
      bucket.push(now)
      hits.set(key, bucket)
      return { allowed: true, remaining: opts.limit - bucket.length }
    },
  }
}
