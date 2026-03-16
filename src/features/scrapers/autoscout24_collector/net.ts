import { setTimeout as sleep } from "node:timers/promises";

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
}

/**
 * Rate limiter for Playwright page navigations.
 * Enforces a minimum delay between sequential page.goto() calls.
 */
export class NavigationRateLimiter {
  private nextAllowedAt = 0;

  constructor(private readonly minIntervalMs: number) {}

  async waitBeforeNavigation(): Promise<void> {
    const now = Date.now();
    if (this.nextAllowedAt > now) {
      await sleep(this.nextAllowedAt - now);
    }
    this.nextAllowedAt = Date.now() + this.minIntervalMs;
  }
}

/**
 * Retry a function with exponential backoff.
 * Detects 429/rate limit errors and applies 4x delay (min 30s).
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  opts: RetryOptions,
  shouldRetry?: (value: T) => boolean,
): Promise<{ value: T; attempts: number }> {
  const totalAttempts = 1 + Math.max(0, opts.retries);
  let last: T | undefined;
  let lastError: unknown;
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    let isRateLimited = false;
    try {
      last = await fn(attempt);
      if (!(shouldRetry?.(last) ?? false)) {
        return { value: last, attempts: attempt };
      }
    } catch (err) {
      lastError = err;
      const msg = err instanceof Error ? err.message : String(err);
      isRateLimited = /\b429\b|too many requests|rate.?limit/i.test(msg);
      if (attempt >= totalAttempts) break;
    }

    const base = opts.baseDelayMs * Math.pow(2, attempt - 1);
    const delay = isRateLimited ? Math.max(base * 4, 30_000) : base;
    await sleep(delay);
  }
  if (lastError) throw lastError;
  return { value: last as T, attempts: totalAttempts };
}
