import { setTimeout as sleep } from "node:timers/promises";

export interface RetryOptions {
  retries: number; // additional tries after first
  baseDelayMs: number;
}

export class PerDomainRateLimiter {
  private nextAllowedAtMsByDomain = new Map<string, number>();
  private minIntervalMs: number;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = minIntervalMs;
  }

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
  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    last = await fn(attempt);
    const retry = shouldRetry ? shouldRetry(last) : false;
    if (!retry) return { value: last, attempts: attempt };
    const delay = opts.baseDelayMs * Math.pow(2, attempt - 1);
    await sleep(delay);
  }
  return { value: last as T, attempts: totalAttempts };
}

export async function fetchHtml(url: string, timeoutMs: number): Promise<string> {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-GB,en;q=0.9",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
      "Cache-Control": "max-age=0",
    },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText}`);
  }
  return await res.text();
}
