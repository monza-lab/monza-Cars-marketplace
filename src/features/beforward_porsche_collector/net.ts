import { setTimeout as sleep } from "node:timers/promises";

export interface RetryOptions {
  retries: number;
  baseDelayMs: number;
}

export class PerDomainRateLimiter {
  private nextAllowedAtMsByDomain = new Map<string, number>();

  constructor(private readonly minIntervalMs: number) {}

  async waitForDomain(domain: string): Promise<void> {
    const now = Date.now();
    const nextAllowedAt = this.nextAllowedAtMsByDomain.get(domain) ?? now;
    if (nextAllowedAt > now) {
      await sleep(nextAllowedAt - now);
    }
    this.nextAllowedAtMsByDomain.set(domain, Date.now() + this.minIntervalMs);
  }
}

export function getDomainFromUrl(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "unknown";
  }
}

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
      isRateLimited = /\b429\b|too many requests/i.test(msg);
      if (attempt >= totalAttempts) break;
    }

    const base = opts.baseDelayMs * Math.pow(2, attempt - 1);
    const delay = isRateLimited ? Math.max(base * 4, 30_000) : base;
    await sleep(delay);
  }
  if (lastError) throw lastError;
  return { value: last as T, attempts: totalAttempts };
}

export async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

export async function fetchJson<T>(url: string, timeoutMs: number): Promise<T> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      Accept: "application/json,text/plain,*/*",
      "Accept-Language": "en-US,en;q=0.9",
      "Cache-Control": "no-cache",
      Pragma: "no-cache",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return (await res.json()) as T;
}
