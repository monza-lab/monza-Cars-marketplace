/**
 * Fetch wrapper for scrapers.
 * Routes through a residential proxy when AT_PROXY_URL is set.
 * Falls back to direct fetch when no proxy is configured.
 *
 * Supported AT_PROXY_URL formats:
 *   http://user:pass@host:port
 *   http://host:port
 *   socks5://host:port
 */

let _dispatcher: object | undefined;
let _dispatcherUrl: string | undefined;

function getProxyDispatcher(): object | undefined {
  const proxyUrl = process.env.AT_PROXY_URL?.trim();
  if (!proxyUrl) return undefined;

  // Cache the dispatcher so we don't create a new one per request
  if (_dispatcherUrl === proxyUrl && _dispatcher) return _dispatcher;

  try {
    // Node.js 20+ bundles undici — ProxyAgent is available at runtime
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ProxyAgent } = require("undici");
    _dispatcher = new ProxyAgent(proxyUrl);
    _dispatcherUrl = proxyUrl;
    return _dispatcher;
  } catch {
    // undici not available — fall through to direct fetch
    return undefined;
  }
}

/** Whether a proxy is configured via AT_PROXY_URL. */
export function isProxyConfigured(): boolean {
  return !!process.env.AT_PROXY_URL?.trim();
}

/**
 * Fetch a URL, routing through AT_PROXY_URL when configured.
 */
export async function proxyFetch(
  url: string | URL,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  const dispatcher = getProxyDispatcher();
  if (dispatcher) {
    // Node.js built-in fetch accepts undici's dispatcher option
    return fetch(url, { ...init, dispatcher } as RequestInit);
  }
  return fetch(url, init);
}
