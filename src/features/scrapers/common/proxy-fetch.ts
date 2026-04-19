/**
 * Proxy-aware fetch for non-Playwright scrapers.
 * Uses Decodo (formerly Smartproxy) residential rotating proxies when configured.
 *
 * Usage:
 *   import { proxyFetch, isProxyConfigured } from "@/features/scrapers/common/proxy-fetch"
 *   const response = await proxyFetch(url, { headers: { ... } })
 */

import { ProxyAgent } from "undici"

interface ProxyConfig {
  url: string
  username: string
  password: string
}

function getProxyConfig(): ProxyConfig | null {
  const url = process.env.DECODO_PROXY_URL
  const username = process.env.DECODO_PROXY_USER
  const password = process.env.DECODO_PROXY_PASS
  if (!url || !username || !password) return null
  return { url, username, password }
}

let cachedAgent: ProxyAgent | null = null
let proxyDisabled = false

function getProxyAgent(): ProxyAgent | null {
  if (proxyDisabled) return null
  if (cachedAgent) return cachedAgent
  const config = getProxyConfig()
  if (!config) return null

  cachedAgent = new ProxyAgent({
    uri: config.url,
    token: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}`,
  })
  return cachedAgent
}

/** Whether Decodo proxy credentials are configured */
export function isProxyConfigured(): boolean {
  return getProxyConfig() !== null
}

/**
 * Fetch through the Decodo residential proxy (if configured).
 * Falls back to direct fetch if proxy is not configured or if the proxy
 * request fails (connection error, timeout, etc.).
 */
export async function proxyFetch(
  url: string | URL,
  init?: RequestInit & { signal?: AbortSignal },
): Promise<Response> {
  const agent = getProxyAgent()
  if (!agent) {
    return fetch(url, init)
  }

  try {
    // Node's fetch accepts `dispatcher` via undici under the hood
    return await fetch(url, {
      ...init,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dispatcher: agent as any,
    } as RequestInit)
  } catch {
    // Proxy unreachable — disable it for the rest of this process
    // so every subsequent request goes direct immediately.
    proxyDisabled = true
    cachedAgent = null
    console.warn("[proxy-fetch] Proxy unreachable, switching to direct fetch for this session")
    return fetch(url, init)
  }
}
