# Proxy & Anti-Bot Options for Monza Cars Marketplace

> Last updated: 2026-03-13

## Current State

- **DECODO (Smartproxy)** configured in codebase but **not active** (no paid subscription)
- Scrapers run from Vercel datacenter IPs → blocked by Cloudflare/Akamai on CarsAndBids, CollectingCars, and partially on AutoScout24/Classic.com
- BaT works via embedded JSON extraction (no browser needed), but inconsistently

---

## 1. Free Options

### 1A. `impit` — TLS Fingerprint Impersonation (Node.js)

| | |
|---|---|
| **What** | Rust-based Node.js library that impersonates real browser TLS fingerprints (JA3/JA4). Replaces `fetch()` with a call that looks like Chrome/Firefox at the TLS handshake level. |
| **Cost** | **$0** (open source, by Apify) |
| **Install** | `npm install impit` |
| **Best for** | BaT, CarsAndBids, CollectingCars — sites that block based on TLS fingerprint |
| **Limitation** | Does NOT execute JavaScript. Only HTTP-level impersonation. |
| **Impact** | HIGH — single biggest free improvement for HTTP-based scrapers |

```typescript
import { Impit } from 'impit';
const impit = new Impit({ browser: 'chrome' });
const response = await impit.fetch('https://carsandbids.com/auctions');
const html = await response.text();
```

### 1B. FlareSolverr — Cloudflare Cookie Farming (Docker)

| | |
|---|---|
| **What** | Self-hosted proxy server that runs a real Chromium browser, solves Cloudflare JS challenges, returns HTML + `cf_clearance` cookies |
| **Cost** | **$0** (open source, Docker) |
| **Install** | `docker run -d -p 8191:8191 ghcr.io/flaresolverr/flaresolverr:latest` |
| **Best for** | Solving CF JS challenges once, then reusing cookies (~30 min validity) |
| **Limitation** | Cannot solve Cloudflare Turnstile (interactive CAPTCHA). ~60-80% success rate. ~500MB RAM per session. |
| **Impact** | MEDIUM — useful as fallback when impit alone isn't enough |

```typescript
async function getCfCookies(url: string): Promise<Record<string, string>> {
  const res = await fetch('http://localhost:8191/v1', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ cmd: 'request.get', url, maxTimeout: 60000 }),
  });
  const data = await res.json();
  if (data.status !== 'ok') throw new Error(data.message);
  const cookies: Record<string, string> = {};
  for (const c of data.solution.cookies) cookies[c.name] = c.value;
  return cookies;
}
```

### 1C. Playwright + Stealth Scripts (already implemented)

| | |
|---|---|
| **What** | Our existing `browser.ts` with `navigator.webdriver` removal, plugins spoofing, chrome.runtime patching |
| **Cost** | **$0** (already in codebase) |
| **Files** | `src/features/classic_collector/browser.ts`, `src/features/autoscout24_collector/browser.ts` |
| **Best for** | JS-heavy sites (AutoScout24, Classic.com) |
| **Limitation** | Without proxy, home/Vercel IP gets flagged after a few requests |
| **Impact** | Already deployed — the bottleneck is IP reputation, not browser fingerprint |

### 1D. Scrapling (Python, free)

| | |
|---|---|
| **What** | Python framework with built-in Cloudflare Turnstile bypass, TLS spoofing, adaptive selectors |
| **Cost** | **$0** (BSD-3 license) |
| **Install** | `pip install "scrapling[all]"` |
| **Best for** | Sites with Cloudflare Turnstile (the hardest challenge to bypass) |
| **Limitation** | **Python only** — would need a separate microservice (FastAPI) callable from Node.js |
| **Impact** | HIGH potential but requires Python infrastructure |

```python
from scrapling.fetchers import StealthyFetcher
page = StealthyFetcher.fetch('https://carsandbids.com/auctions')
listings = page.css('.auction-item')
```

### 1E. Free Proxy Lists — NOT VIABLE

| Service | Reliability | Blocked by CF/Akamai? |
|---|---|---|
| ProxyScrape free | ~5-10% uptime | Yes — all blacklisted |
| free-proxy-list.net | ~10% working | Yes |
| Spys.one | Low | Yes |
| Tor exit nodes | Moderate | Yes — all publicly listed |

**Verdict**: Do not use. All free proxy IPs are on anti-bot blocklists.

### 1F. Cloudflare Workers as Proxy — NOT VIABLE

Using CF Workers to proxy requests does NOT bypass Cloudflare protection on target sites. CF detects its own IPs and still applies challenges. Also violates Cloudflare ToS.

---

## 2. Low-Cost Paid Options ($3-20/month)

### 2A. Webshare.io

| | |
|---|---|
| **Free tier** | 10 datacenter proxies (free forever) |
| **Paid** | $2.99/mo for 100 proxies |
| **Type** | Datacenter (not residential) |
| **Anti-bot bypass** | None — just IP rotation |
| **Best for** | Sites without aggressive anti-bot |

### 2B. ProxyScrape Premium

| | |
|---|---|
| **Cost** | **$3.49/mo** |
| **Type** | Residential rotating proxies |
| **Pool** | Smaller pool than enterprise providers |
| **Best for** | Budget residential proxy needs |

### 2C. IPRoyal

| | |
|---|---|
| **Cost** | **$1.75/GB** residential (traffic never expires) |
| **Pool** | 32M+ IPs |
| **Best for** | Pay-as-you-go with no monthly commitment |
| **Note** | At ~50MB/day scraping = ~1.5GB/month = **~$2.63/month** |

### 2D. DECODO/Smartproxy (what we have configured)

| | |
|---|---|
| **Cost** | **$3.50/GB** residential PAYG |
| **Pool** | 115M+ IPs |
| **Features** | Site Unblocker, Scraping Browser |
| **Best for** | Mid-range with good tooling |
| **Note** | Already integrated in codebase — just needs active subscription |

---

## 3. Mid-Range Paid Options ($50-100/month)

### 3A. Firecrawl Cloud (Standard)

| | |
|---|---|
| **Cost** | **$83/mo** (annual) |
| **Credits** | 100,000 pages/month |
| **Anti-bot** | Fire-engine: automatic CF/Akamai bypass, proxy rotation, CAPTCHA solving |
| **Output** | Markdown (LLM-optimized), structured JSON via schema |
| **Self-host** | Yes but loses Fire-engine (anti-bot) |
| **Node SDK** | `npm install @mendable/firecrawl-js` |
| **Best for** | LLM-powered extraction, maximum simplicity |
| **Limitation** | Cloud-only for anti-bot features. AGPL-3.0 license for self-host. |

```typescript
import Firecrawl from '@mendable/firecrawl-js';
const app = new Firecrawl({ apiKey: 'fc-...' });
const result = await app.scrape('https://carsandbids.com/auctions', {
  formats: ['markdown', { type: 'json', schema: CarListingSchema }]
});
```

### 3B. Bright Data Web Unlocker (PAYG)

| | |
|---|---|
| **Cost** | **$1.50/1K requests** (pay-as-you-go, no minimum) |
| **At our volume** (~100 req/day) | **~$4.50/month** |
| **Anti-bot** | Automatic CF/Akamai/PerimeterX/DataDome bypass + CAPTCHA solving |
| **Success rate** | 99.9% claimed / 97.9% independently tested |
| **Integration** | Simple HTTP proxy header |
| **Best for** | Guaranteed unblocking of specific hard targets |

```typescript
const response = await fetch('https://carsandbids.com/auctions', {
  headers: {
    'Proxy-Authorization': 'Basic ' + Buffer.from(
      'brd-customer-ID-zone-web_unlocker:PASSWORD'
    ).toString('base64'),
  }
});
```

---

## 4. Enterprise Options ($500+/month)

### 4A. Bright Data Scraping Browser

| | |
|---|---|
| **Cost** | **$8/GB** PAYG / $499/mo for 71GB |
| **What** | Cloud-hosted browser you control via Playwright/Puppeteer over CDP |
| **Anti-bot** | Full: proxy rotation, CAPTCHA solving, fingerprint management — all automatic |
| **Integration** | `playwright.chromium.connectOverCDP('wss://...@brd.superproxy.io:9222')` |

### 4B. Bright Data Residential Proxies

| | |
|---|---|
| **Cost** | **$4-8/GB** PAYG / $499/mo for 141GB |
| **Pool** | 150M+ IPs (world's largest) |
| **Best for** | High-volume scraping with rotating residential IPs |

### 4C. Cloudflare Browser Rendering

| | |
|---|---|
| **Cost** | **$5/mo base** + $0.09/browser-hour (10h free/month) |
| **What** | Serverless headless Chromium on CF edge. REST API: `/scrape`, `/markdown`, `/crawl` |
| **Anti-bot** | **NONE** — does not bypass CF/Akamai protection |
| **Best for** | Scraping unprotected sites, PDF generation, screenshots |
| **Not for** | Our use case (car marketplaces are all protected) |

---

## 5. Comparison Matrix

| Solution | Cost/mo | CF Bypass | Akamai Bypass | Node.js | Effort |
|---|---|---|---|---|---|
| **impit** | $0 | Partial (TLS) | No | Native | 15 min |
| **FlareSolverr** | $0 | JS challenges only | No | HTTP API | 1-2 hrs |
| **Playwright stealth** (existing) | $0 | Partial | Partial | Native | Already done |
| **Scrapling** | $0 | Yes (Turnstile) | Partial | Python sidecar | 4-8 hrs |
| **Webshare free** | $0 | No | No | Proxy | 30 min |
| **IPRoyal** | ~$3 | With browser | With browser | Proxy | 30 min |
| **ProxyScrape** | $3.49 | With browser | With browser | Proxy | 30 min |
| **DECODO** (activate) | ~$4 | With browser | With browser | Already wired | 5 min |
| **Bright Data Unlocker** | ~$5 | Yes (auto) | Yes (auto) | HTTP header | 1 hr |
| **Firecrawl Cloud** | $83 | Yes (auto) | Yes (auto) | SDK | 2-4 hrs |
| **Bright Data Browser** | $499+ | Yes (auto) | Yes (auto) | CDP | 2-4 hrs |
| **CF Browser Rendering** | $5 | **No** | **No** | Workers only | N/A |

---

## 6. Recommended Strategy

### Phase 1: Free ($0)
1. Install `impit` → replace `fetch()` in BaT/CaB/CC scrapers
2. Set up FlareSolverr (Docker) for cookie farming as fallback
3. Keep existing Playwright stealth for AutoScout24/Classic.com

### Phase 2: If free isn't enough (~$3-5/mo)
4. Activate DECODO subscription (already wired in code) OR
5. Use IPRoyal pay-as-you-go ($1.75/GB, ~$3/mo at our volume)

### Phase 3: If we need guaranteed 99%+ success (~$5-15/mo)
6. Bright Data Web Unlocker PAYG ($1.50/1K requests) — only for the hardest targets

---

## 7. Per-Site Recommendation

| Site | Current Status | Recommended Free Fix | Paid Fallback |
|---|---|---|---|
| **BringATrailer** | Working (embedded JSON) | `impit` for HTTP requests | — |
| **CarsAndBids** | 403 Blocked | `impit` → FlareSolverr cookies | BD Web Unlocker |
| **CollectingCars** | 403 Blocked | `impit` → FlareSolverr cookies | BD Web Unlocker |
| **AutoScout24** | ~85% working | Keep Playwright stealth | Residential proxy ($3/mo) |
| **Classic.com** | Working (URL parsing fix) | Keep Playwright stealth | — |
| **AutoTrader** | GraphQL API (stale header) | Fix `x-sauron-app-version` | — |
| **Beforward** | Working | No change needed | — |

---

## References

- [impit (Apify)](https://github.com/apify/impit)
- [FlareSolverr](https://github.com/FlareSolverr/FlareSolverr)
- [Scrapling](https://github.com/D4Vinci/Scrapling)
- [Firecrawl](https://www.firecrawl.dev)
- [Bright Data](https://brightdata.com/pricing)
- [Cloudflare Browser Rendering](https://developers.cloudflare.com/browser-rendering/)
- [DECODO/Smartproxy](https://decodo.com)
- [IPRoyal](https://iproyal.com)
- [Webshare](https://www.webshare.io)
- [curl-impersonate](https://github.com/lwthiker/curl-impersonate)
- [Camoufox](https://github.com/daijro/camoufox)
