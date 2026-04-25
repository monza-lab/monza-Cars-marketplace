/**
 * Fetch wrapper for scrapers.
 * Previously routed through a residential proxy (Decodo/Smartproxy).
 * Now delegates directly to the global fetch — kept as a thin wrapper
 * so every call-site doesn't need to be rewritten.
 */

/** Whether a proxy is configured (always false — proxy removed). */
export function isProxyConfigured(): boolean {
  return false
}

/**
 * Fetch a URL. Formerly proxy-aware; now a direct pass-through to fetch.
 */
export async function proxyFetch(
  url: string | URL,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  return fetch(url, init)
}
