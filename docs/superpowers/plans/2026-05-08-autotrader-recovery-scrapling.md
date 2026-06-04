# AutoTrader Recovery & Scrapling Migration Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore 7,249 wrongly-demoted AutoTrader UK listings to active, fix the enrichment demotion bug, and migrate the scraper + enrichment from plain `fetch()` to Scrapling (StealthyFetcher) to bypass Cloudflare's 403 blocks on both Vercel and GitHub Actions.

**Architecture:** Three-phase approach: (1) Emergency data recovery — fix the enrichment demotion logic and restore listings in DB. (2) Scrapling infrastructure — create a Python fetcher script (search + detail modes using `StealthyFetcher`) and TypeScript wrapper, following the proven AutoScout24 pattern. (3) GitHub Actions migration — update the collector workflow with Scrapling and create a new enrichment workflow, removing reliance on Vercel cron for AutoTrader entirely.

**Tech Stack:** Python 3.11 + Scrapling (`StealthyFetcher`), TypeScript, Supabase JS client, GitHub Actions, Cheerio (existing HTML parsers reused).

---

## Root Cause Summary

| Issue | Cause |
|-------|-------|
| 0 active AutoTrader listings | Enrichment cron demotes to "unsold" when detail fetch is Cloudflare-blocked |
| Daily cron fails since Apr 27 | AutoTrader GraphQL gateway returns 403 (Cloudflare challenge) to datacenter IPs |
| GH Actions also 403-blocked | Same Cloudflare block — plain `fetch()` has no browser fingerprint |
| 0 UK cars in browse page | Frontend filters `status = 'active'` only; AutoTrader is sole UK source |

## File Structure

### Files to Modify
| File | Responsibility | Change |
|------|---------------|--------|
| `src/app/api/cron/enrich-autotrader/route.ts` | Vercel enrichment cron | Remove demotion logic (lines 163-179) |
| `src/features/scrapers/autotrader_collector/collector.ts` | Discovery + ingestion | Add Scrapling fallback for discovery |
| `src/features/scrapers/autotrader_collector/detail.ts` | Detail page fetcher | Add Scrapling fallback for HTML fetch |
| `.github/workflows/autotrader-collector.yml` | GH Actions collector | Add Python/Scrapling install steps |
| `vercel.json` | Vercel cron schedule | Remove `/api/cron/autotrader` entry (moved to GH Actions) |

### Files to Create
| File | Responsibility |
|------|---------------|
| `scripts/autotrader_scrapling_fetch.py` | Python fetcher: search + detail modes via StealthyFetcher |
| `src/features/scrapers/autotrader_collector/scrapling.ts` | TS wrapper: spawns Python script, parses JSON |
| `scripts/autotrader-enrich-scrapling.ts` | CLI enrichment script for GH Actions |
| `.github/workflows/autotrader-enrich.yml` | GH Actions enrichment workflow |
| `scripts/restore-autotrader-active.ts` | One-time DB restore script |

---

## Chunk 1: Emergency Data Recovery

### Task 1: Fix Enrichment Demotion Bug

**Files:**
- Modify: `src/app/api/cron/enrich-autotrader/route.ts:163-179`

The enrichment route demotes listings to "unsold" when `fetchAutoTraderDetail()` returns empty data. But empty data usually means Cloudflare blocked the request — NOT that the listing was removed. Status management belongs in `refreshActiveListings()` (which correctly checks for 404/410), not in enrichment.

- [ ] **Step 1: Remove the demotion block from the enrichment route**

Replace the `else if (!detailHasRecoverableData)` block (lines 163-179) with a simple skip + counter:

```typescript
// In src/app/api/cron/enrich-autotrader/route.ts
// REPLACE lines 163-179 (the else-if block starting with `} else if (!detailHasRecoverableData)`)
// WITH:
          } else {
            // No recoverable data — likely Cloudflare-blocked or transient error.
            // Do NOT demote to "unsold"; let refreshActiveListings() handle
            // genuine 404/410 removals.  Just touch updated_at so this row
            // isn't retried immediately in the next batch.
            const { error: skipErr } = await client
              .from("listings")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", row.id);
            if (!skipErr) consecutiveFailures = 0;
          }
```

- [ ] **Step 2: Verify the route still compiles**

Run: `npx tsc --noEmit src/app/api/cron/enrich-autotrader/route.ts`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/enrich-autotrader/route.ts
git commit -m "fix(enrich-autotrader): stop demoting listings to unsold on fetch failure

Cloudflare 403 blocks return empty detail data, which the enrichment
cron was incorrectly interpreting as 'listing removed'. This demoted
all 7,249 AutoTrader listings to unsold, making the UK market invisible.
Status management is now solely handled by refreshActiveListings()."
```

---

### Task 2: Restore AutoTrader Listings to Active

**Files:**
- Create: `scripts/restore-autotrader-active.ts`

- [ ] **Step 1: Create the restore script**

```typescript
// scripts/restore-autotrader-active.ts
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load env
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) { console.error("Missing Supabase env"); process.exit(1); }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Count before
  const { count: before } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("source", "AutoTrader")
    .eq("status", "unsold");
  console.log(`AutoTrader unsold before restore: ${before}`);

  if (!before || before === 0) {
    console.log("Nothing to restore.");
    return;
  }

  // Restore in batches of 1000
  let restored = 0;
  while (true) {
    const { data: batch } = await client
      .from("listings")
      .select("id")
      .eq("source", "AutoTrader")
      .eq("status", "unsold")
      .limit(1000);

    if (!batch || batch.length === 0) break;

    const ids = batch.map((r) => r.id);
    const { error } = await client
      .from("listings")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      console.error("Batch update error:", error.message);
      break;
    }
    restored += ids.length;
    console.log(`  Restored ${restored}...`);
  }

  // Count after
  const { count: activeAfter } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("source", "AutoTrader")
    .eq("status", "active");
  console.log(`\nDone. AutoTrader active after restore: ${activeAfter}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 2: Run the restore**

Run: `npx tsx scripts/restore-autotrader-active.ts`
Expected: `AutoTrader active after restore: 7249` (approximately)

- [ ] **Step 3: Verify on the live site**

Open the browse page filtered by UK market. Should now show thousands of listings instead of 0.

- [ ] **Step 4: Commit**

```bash
git add scripts/restore-autotrader-active.ts
git commit -m "fix(autotrader): restore 7249 demoted listings to active status"
```

---

## Chunk 2: Scrapling Python Script

### Task 3: Create AutoTrader Scrapling Fetcher (Python)

**Files:**
- Create: `scripts/autotrader_scrapling_fetch.py`
- Reference: `scripts/as24_scrapling_fetch.py` (template), `scripts/autotrader-scrapling-probe.py` (existing proof StealthyFetcher works)

The existing `autotrader-scrapling-probe.py` already proves `StealthyFetcher` can load AutoTrader pages. We expand it into a full two-mode script modeled on the AS24 fetcher.

Key difference from AS24: AutoTrader is NOT a Next.js app, so there's no `__NEXT_DATA__`. We parse the rendered DOM directly (search result cards and detail page specs).

- [ ] **Step 1: Create the Python script with search mode**

```python
#!/usr/bin/env python3
"""Fetch AutoTrader UK pages through Scrapling StealthyFetcher.

Modes:
  search <url> [<url> ...]  — fetch search page(s), extract listing cards
  detail <url> [<url> ...]  — fetch detail page(s), extract vehicle specs

Uses StealthyFetcher (headless browser) to bypass Cloudflare.
The TypeScript wrapper expects JSON on stdout.
"""
from __future__ import annotations

import io
import json
import os
import re
import sys

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers import StealthyFetcher


# ── Fetch ──────────────────────────────────────────────────────────────

def fetch_page(url: str, timeout: int = 30):
    """Fetch a fully-rendered page using StealthyFetcher."""
    StealthyFetcher.adaptive = True
    return StealthyFetcher.fetch(url, headless=True, network_idle=True, timeout=timeout)


# ── Search Mode ────────────────────────────────────────────────────────

def parse_search(url: str) -> dict:
    page = fetch_page(url, timeout=30)
    html_text = getattr(page, "html_content", "") or ""

    listings = []

    # AutoTrader search results: each listing card has an article or
    # section with data-testid containing the advertId.
    # Strategy 1: Look for listing card elements
    for card in page.css("a[href*='/car-details/']"):
        href = card.attributes.get("href", "")
        advert_match = re.search(r"/car-details/(\d+)", href)
        if not advert_match:
            continue

        advert_id = advert_match.group(1)

        # Try to get text content from the card's parent context
        parent = card
        title_text = ""
        price_text = ""

        # Walk up to find the listing card container
        for _ in range(5):
            p = getattr(parent, "parent", None)
            if p is None:
                break
            parent = p
            text = getattr(parent, "text", "") or ""
            if len(text) > 50:
                # Found a container with enough text
                title_text = text
                break

        # Extract title from the link text or nearby heading
        link_text = (getattr(card, "text", "") or "").strip()
        if link_text and len(link_text) > 5:
            title_text = link_text

        # Extract price from nearby elements
        price_el = None
        try:
            price_el = parent.css("[class*='price'], [data-testid*='price']")
        except Exception:
            pass
        if price_el:
            for pel in price_el:
                pt = (getattr(pel, "text", "") or "").strip()
                if pt and "£" in pt:
                    price_text = pt
                    break

        listing = {
            "advertId": advert_id,
            "title": _clean_text(title_text) or f"Porsche (AutoTrader {advert_id})",
            "priceText": price_text or None,
            "price": _parse_price(price_text),
            "url": f"https://www.autotrader.co.uk/car-details/{advert_id}",
        }
        listings.append(listing)

    # Deduplicate by advertId
    seen = set()
    unique = []
    for lst in listings:
        if lst["advertId"] not in seen:
            seen.add(lst["advertId"])
            unique.append(lst)

    # Try to get total results count from page text
    total_results = None
    for el in page.css("h1, [data-testid*='results-count'], [class*='results']"):
        text = getattr(el, "text", "") or ""
        m = re.search(r"([\d,]+)\s+(?:results?|cars?|Porsche)", text, re.IGNORECASE)
        if m:
            total_results = int(m.group(1).replace(",", ""))
            break

    return {
        "ok": True,
        "mode": "search",
        "listings": unique,
        "totalResults": total_results,
        "url": url,
    }


# ── Detail Mode ────────────────────────────────────────────────────────

def parse_detail(url: str) -> dict:
    page = fetch_page(url, timeout=30)
    html_text = getattr(page, "html_content", "") or ""
    body_text = getattr(page, "text", "") or ""

    vehicle: dict = {
        "title": None, "price": None, "priceText": None,
        "mileage": None, "mileageUnit": None,
        "location": None, "description": None,
        "images": [], "vin": None,
        "exteriorColor": None, "interiorColor": None,
        "transmission": None, "engine": None, "bodyStyle": None,
    }

    # Title
    for sel in ["h1", "[data-testid='vehicle-title']", "[class*='title']"]:
        for el in page.css(sel):
            t = _clean_text(getattr(el, "text", ""))
            if t and len(t) > 3:
                vehicle["title"] = t
                break
        if vehicle["title"]:
            break

    # Price
    for sel in ["[data-testid='price']", "[class*='price']"]:
        for el in page.css(sel):
            t = _clean_text(getattr(el, "text", ""))
            if t and "£" in t:
                vehicle["priceText"] = t
                vehicle["price"] = _parse_price(t)
                break
        if vehicle["price"]:
            break

    # Key specs — look for spec items in the overview section
    specs = _extract_specs(page, body_text)
    vehicle["mileage"] = specs.get("mileage")
    vehicle["mileageUnit"] = specs.get("mileageUnit", "miles")
    vehicle["transmission"] = specs.get("transmission")
    vehicle["engine"] = specs.get("engine")
    vehicle["bodyStyle"] = specs.get("bodyStyle")
    vehicle["exteriorColor"] = specs.get("exteriorColor")

    # Location
    for sel in ["[data-testid*='location']", "[class*='location']"]:
        for el in page.css(sel):
            t = _clean_text(getattr(el, "text", ""))
            if t and len(t) > 2:
                vehicle["location"] = t
                break
        if vehicle["location"]:
            break

    # Description
    for sel in ["[data-testid*='description']", "[class*='description']", "section p"]:
        for el in page.css(sel):
            t = _clean_text(getattr(el, "text", ""))
            if t and len(t) > 30:
                vehicle["description"] = t[:2000]
                break
        if vehicle["description"]:
            break

    # VIN
    vin_match = re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", body_text)
    if vin_match:
        vehicle["vin"] = vin_match.group(0).upper()

    # Images
    images = []
    for node in page.css("img"):
        src = node.attributes.get("src") or node.attributes.get("data-src") or ""
        if "atcdn.co.uk" in src:
            images.append(_normalize_image_url(src))
    vehicle["images"] = list(dict.fromkeys(images))[:30]  # dedupe, cap at 30

    return {"ok": True, "mode": "detail", "vehicle": vehicle, "url": url}


def _extract_specs(page, body_text: str) -> dict:
    """Extract key vehicle specs from the page."""
    specs: dict = {}

    # Strategy 1: Look for spec items in key-specs section
    for el in page.css("[data-testid*='spec'], [class*='spec'] li, [class*='key-spec']"):
        text = _clean_text(getattr(el, "text", ""))
        if not text:
            continue
        _match_spec(text, specs)

    # Strategy 2: Regex on body text for common patterns
    if not specs.get("mileage"):
        m = re.search(r"([\d,]+)\s*(miles?|km|kilometres?)\b", body_text, re.I)
        if m:
            specs["mileage"] = int(m.group(1).replace(",", ""))
            specs["mileageUnit"] = "km" if "km" in m.group(2).lower() else "miles"

    if not specs.get("transmission"):
        m = re.search(r"\b(Automatic|Manual|Semi-Automatic|PDK|Tiptronic|DSG|CVT)\b", body_text, re.I)
        if m:
            specs["transmission"] = m.group(1)

    if not specs.get("engine"):
        m = re.search(r"\b(\d(?:\.\d)?\s?[Ll](?:itre)?)\b", body_text)
        if m:
            specs["engine"] = m.group(1)

    if not specs.get("bodyStyle"):
        m = re.search(r"\b(Coupe|Convertible|SUV|Estate|Saloon|Hatchback|Cabriolet|Targa|Roadster)\b", body_text, re.I)
        if m:
            specs["bodyStyle"] = m.group(1)

    if not specs.get("exteriorColor"):
        m = re.search(r"(?:body|exterior)\s+colou?r[:\s]+([A-Za-z][A-Za-z\s-]{1,30})", body_text, re.I)
        if m:
            specs["exteriorColor"] = m.group(1).strip()

    return specs


def _match_spec(text: str, specs: dict):
    """Match a spec text like '20,000 miles' or 'Automatic' to a field."""
    lower = text.lower()
    m = re.search(r"([\d,]+)\s*(miles?|km)", lower)
    if m and not specs.get("mileage"):
        specs["mileage"] = int(m.group(1).replace(",", ""))
        specs["mileageUnit"] = "km" if "km" in m.group(2) else "miles"
        return
    if re.search(r"\b(automatic|manual|semi-auto|pdk|tiptronic)\b", lower) and not specs.get("transmission"):
        specs["transmission"] = text.strip()
        return
    m = re.search(r"\b(\d\.\d\s?l)", lower)
    if m and not specs.get("engine"):
        specs["engine"] = text.strip()
        return


# ── Helpers ────────────────────────────────────────────────────────────

def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _parse_price(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", text)
    try:
        n = int(cleaned)
        return n if n > 0 else None
    except ValueError:
        return None


def _normalize_image_url(url: str) -> str:
    """Upgrade AutoTrader image URLs to higher resolution."""
    url = re.sub(r"\?.*$", "", url)  # strip query params
    return url


# ── CLI ────────────────────────────────────────────────────────────────

def _safe_parse(fn, url: str) -> dict:
    try:
        return fn(url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


def main() -> int:
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: autotrader_scrapling_fetch.py <search|detail> <url> [<url>...]\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "Mode and URL required"}))
        return 1

    mode = sys.argv[1]
    urls = sys.argv[2:]

    if mode not in ("search", "detail"):
        sys.stderr.write(f"Unknown mode: {mode}\n")
        sys.stdout.write(json.dumps({"ok": False, "error": f"Unknown mode: {mode}"}))
        return 1

    parse_fn = parse_search if mode == "search" else parse_detail
    safe_fn = lambda url: _safe_parse(parse_fn, url)

    try:
        if len(urls) == 1:
            payload = parse_fn(urls[0])
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            return 0

        results = [safe_fn(u) for u in urls]
        sys.stdout.write(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        return 0
    except Exception as exc:
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Test the Python script locally (search mode)**

Run: `python scripts/autotrader_scrapling_fetch.py search "https://www.autotrader.co.uk/car-search?postcode=SW1A+1AA&make=Porsche"`
Expected: JSON with `ok: true`, `listings` array containing advertIds and titles.

- [ ] **Step 3: Test the Python script locally (detail mode)**

Pick an advertId from step 2 output.
Run: `python scripts/autotrader_scrapling_fetch.py detail "https://www.autotrader.co.uk/car-details/<advertId>"`
Expected: JSON with `ok: true`, `vehicle` object containing price, mileage, images, etc.

- [ ] **Step 4: Commit**

```bash
git add scripts/autotrader_scrapling_fetch.py
git commit -m "feat(autotrader): add Scrapling fetcher with search + detail modes

Uses StealthyFetcher (headless browser) to bypass Cloudflare 403 blocks.
Modeled on as24_scrapling_fetch.py. Supports search (listing discovery)
and detail (enrichment) modes."
```

---

## Chunk 3: TypeScript Wrapper + Collector Integration

### Task 4: Create TypeScript Scrapling Wrapper

**Files:**
- Create: `src/features/scrapers/autotrader_collector/scrapling.ts`
- Reference: `src/features/scrapers/autoscout24_collector/scrapling.ts` (template)

- [ ] **Step 1: Create the wrapper module**

```typescript
// src/features/scrapers/autotrader_collector/scrapling.ts
/**
 * AutoTrader Scrapling wrapper — spawns Python fetcher, parses JSON stdout.
 * Follows the AutoScout24 pattern (autoscout24_collector/scrapling.ts).
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { logEvent } from "./logging";
import type { AutoTraderDetailParsed } from "./detail";

const execFileAsync = promisify(execFile);

/* ── Predicates ────────────────────────────────────────────────────── */

export function canUseScrapling(): boolean {
  return !process.env.VERCEL && process.env.AT_FORCE_SCRAPLING !== "0";
}

/* ── Internals ─────────────────────────────────────────────────────── */

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

const SCRIPT_PATH = "scripts/autotrader_scrapling_fetch.py";

/* ── Search ────────────────────────────────────────────────────────── */

export interface ATScraplingSearchListing {
  advertId: string;
  title: string;
  price: number | null;
  priceText: string | null;
  url: string;
}

export interface ATScraplingSearchResult {
  listings: ATScraplingSearchListing[];
  totalResults: number | null;
}

export async function fetchATSearchWithScrapling(
  url: string,
): Promise<ATScraplingSearchResult | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const python = resolveScraplingPython();
    const result = await execFileAsync(python, [scriptPath, "search", url], {
      encoding: "utf8",
      timeout: 60_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch (err) {
    logEvent({
      level: "warn",
      event: "scrapling.at_search_error",
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok) {
      logEvent({ level: "warn", event: "scrapling.at_search_failed", url, error: parsed.error });
      return null;
    }
    return {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      totalResults: typeof parsed.totalResults === "number" ? parsed.totalResults : null,
    };
  } catch {
    return null;
  }
}

/* ── Detail ────────────────────────────────────────────────────────── */

export async function fetchATDetailWithScrapling(
  url: string,
): Promise<AutoTraderDetailParsed | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const python = resolveScraplingPython();
    const result = await execFileAsync(python, [scriptPath, "detail", url], {
      encoding: "utf8",
      timeout: 45_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch (err) {
    logEvent({
      level: "warn",
      event: "scrapling.at_detail_error",
      url,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok || !parsed.vehicle) return null;

    const v = parsed.vehicle;
    return {
      title: v.title ?? null,
      price: typeof v.price === "number" ? v.price : null,
      priceText: v.priceText ?? null,
      mileage: typeof v.mileage === "number" ? v.mileage : null,
      mileageUnit: v.mileageUnit ?? null,
      location: v.location ?? null,
      description: v.description ?? null,
      images: Array.isArray(v.images) ? v.images : [],
      vin: v.vin ?? null,
      exteriorColor: v.exteriorColor ?? null,
      interiorColor: v.interiorColor ?? null,
      transmission: v.transmission ?? null,
      engine: v.engine ?? null,
      bodyStyle: v.bodyStyle ?? null,
    };
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/features/scrapers/autotrader_collector/scrapling.ts`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/autotrader_collector/scrapling.ts
git commit -m "feat(autotrader): add TypeScript Scrapling wrapper

Follows AutoScout24 pattern. Spawns Python fetcher, parses JSON.
Supports search (discovery) and detail (enrichment) modes."
```

---

### Task 5: Update Collector Discovery with Scrapling Fallback

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/collector.ts`
- Modify: `src/features/scrapers/autotrader_collector/discover.ts`

The collector's `discoverAutoTrader()` currently uses only the GraphQL gateway. We add Scrapling as the primary attempt, falling back to gateway.

- [ ] **Step 1: Add Scrapling-based discovery function to discover.ts**

At the end of `discover.ts`, add a new function and update `discoverAutoTrader`:

```typescript
// Add import at top of discover.ts:
import { fetchATSearchWithScrapling, canUseScrapling } from "./scrapling";

// Replace the discoverAutoTrader function (line 464-514) with:
async function discoverAutoTrader(opts: DiscoverOptions): Promise<string[]> {
  // Try Scrapling first (bypasses Cloudflare)
  if (canUseScrapling()) {
    const scraplingResult = await discoverAutoTraderViaScrapling(opts);
    if (scraplingResult.length > 0) return scraplingResult;
    logEvent({
      level: "warn",
      event: "discover.scrapling_empty",
      runId: opts.runId,
      source: "AutoTrader",
    });
  }

  // Fallback: gateway API (works from residential IPs)
  return discoverAutoTraderViaGateway(opts);
}

async function discoverAutoTraderViaScrapling(opts: DiscoverOptions): Promise<string[]> {
  const out: string[] = [];
  const seen = new Set<string>();
  const startPage = Math.max(1, opts.startPage ?? 1);

  for (let page = startPage; page < startPage + opts.maxPages; page++) {
    const searchUrl = buildSearchUrl({
      make: opts.make,
      model: opts.model,
      postcode: opts.postcode || "SW1A 1AA",
      yearFrom: opts.yearFrom,
      yearTo: opts.yearTo,
      priceTo: opts.priceTo,
      mileageTo: opts.mileageTo,
    }) + (page > 1 ? `&page=${page}` : "");

    const result = await fetchATSearchWithScrapling(searchUrl);
    if (!result) break;

    let newCount = 0;
    for (const listing of result.listings) {
      const url = listing.url;
      if (seen.has(url)) continue;
      seen.add(url);
      out.push(url);
      newCount++;
    }

    logEvent({
      level: "info",
      event: "discover.scrapling_page_fetched",
      runId: opts.runId,
      source: "AutoTrader",
      page,
      listings: result.listings.length,
      totalResults: result.totalResults,
    });

    if (opts.onPageDone) await opts.onPageDone(page);
    if (newCount === 0) break;
  }

  return out;
}

// Rename old discoverAutoTrader to discoverAutoTraderViaGateway
async function discoverAutoTraderViaGateway(opts: DiscoverOptions): Promise<string[]> {
  // ... existing gateway-based code (the current lines 464-514) ...
}
```

- [ ] **Step 2: Verify the collector still compiles**

Run: `npx tsc --noEmit src/features/scrapers/autotrader_collector/discover.ts`
Expected: no errors

- [ ] **Step 3: Test locally**

Run: `npx tsx src/features/scrapers/autotrader_collector/cli.ts --maxPages=2 --dryRun`
Expected: Should discover listings via Scrapling and log `discover.scrapling_page_fetched` events. With `--dryRun`, no DB writes.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/autotrader_collector/discover.ts
git commit -m "feat(autotrader): use Scrapling for discovery, gateway as fallback

Scrapling (StealthyFetcher) bypasses Cloudflare 403 blocks that have
been breaking both Vercel cron and GitHub Actions since Apr 27."
```

---

### Task 6: Add Scrapling Fallback to Detail Fetcher

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/detail.ts`

The detail fetcher uses plain `fetch()` for both the product-page JSON API and HTML. Add Scrapling as a third fallback when both fail (Cloudflare-blocked).

- [ ] **Step 1: Add Scrapling fallback to fetchAutoTraderDetail**

Add at the top of `detail.ts`:
```typescript
import { fetchATDetailWithScrapling, canUseScrapling } from "./scrapling";
```

In `fetchAutoTraderDetail()` (line 86), after the existing try/catch at lines 107-164, add a Scrapling fallback before returning `empty`:

```typescript
// After line 161 (the existing try/catch), BEFORE "return empty;" at line 166:

  // Scrapling fallback — if both fetch approaches failed (likely CF-blocked)
  if (canUseScrapling()) {
    try {
      const scraplingResult = await fetchATDetailWithScrapling(url);
      if (scraplingResult) return scraplingResult;
    } catch {
      // fall through to empty
    }
  }

  return empty;
```

- [ ] **Step 2: Verify it compiles**

Run: `npx tsc --noEmit src/features/scrapers/autotrader_collector/detail.ts`
Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/autotrader_collector/detail.ts
git commit -m "feat(autotrader): add Scrapling fallback to detail fetcher

When product-page API and HTML fetch both fail (Cloudflare 403),
falls back to StealthyFetcher via Scrapling Python script."
```

---

## Chunk 4: GitHub Actions Workflows

### Task 7: Update AutoTrader Collector Workflow

**Files:**
- Modify: `.github/workflows/autotrader-collector.yml`

Add Python + Scrapling installation, increase max pages, set env vars.

- [ ] **Step 1: Update the workflow**

```yaml
name: AutoTrader Collector (Daily)

on:
  schedule:
    - cron: '0 2 * * *'      # 02:00 UTC daily
  workflow_dispatch:
    inputs:
      max_pages:
        description: 'Max search pages per source'
        default: '20'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'
      no_details:
        description: 'Skip detail page fetches'
        default: 'false'

concurrency:
  group: autotrader-collector
  cancel-in-progress: false

jobs:
  collect:
    runs-on: ubuntu-latest
    timeout-minutes: 45

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Scrapling
        run: |
          python3.11 -m pip install --upgrade pip
          python3.11 -m pip install "scrapling[fetchers,shell]"
          scrapling install

      - run: npm ci

      - name: Run AutoTrader collector (Scrapling-first)
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SCRAPLING_PYTHON: python3.11
          AT_FORCE_SCRAPLING: '1'
        run: |
          npx tsx src/features/scrapers/autotrader_collector/cli.ts \
            --maxPages=${{ github.event.inputs.max_pages || '20' }} \
            ${{ github.event.inputs.no_details == 'true' && '--noDetails' || '' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}

      - name: Upload output artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: autotrader-collector-output
          path: var/autotrader_collector/
          retention-days: 7
          if-no-files-found: ignore
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/autotrader-collector.yml
git commit -m "ci(autotrader): add Scrapling to collector workflow

Installs Python 3.11 + Scrapling, increases max pages to 20,
sets AT_FORCE_SCRAPLING=1. StealthyFetcher bypasses Cloudflare."
```

---

### Task 8: Create AutoTrader Enrichment CLI Script

**Files:**
- Create: `scripts/autotrader-enrich-scrapling.ts`
- Reference: `scripts/as24-enrich-scrapling.ts` (template)

- [ ] **Step 1: Create the enrichment script**

```typescript
// scripts/autotrader-enrich-scrapling.ts
/**
 * CLI: Enrich AutoTrader listings via Scrapling.
 * Designed for GitHub Actions (20-minute budget).
 *
 * Finds active AutoTrader listings missing key fields (engine IS NULL),
 * fetches detail pages with Scrapling, and updates only null fields.
 *
 * Usage:
 *   npx tsx scripts/autotrader-enrich-scrapling.ts
 *   npx tsx scripts/autotrader-enrich-scrapling.ts --limit=300 --dryRun
 *   npx tsx scripts/autotrader-enrich-scrapling.ts --preflight
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import { fetchATDetailWithScrapling } from "../src/features/scrapers/autotrader_collector/scrapling";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 300,
    timeBudgetMs: 20 * 60 * 1000,
    delayMs: 3000,
    dryRun: false,
    preflight: false,
  };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "timeBudgetMs") opts.timeBudgetMs = parseInt(val, 10);
      if (key === "delayMs") opts.delayMs = parseInt(val, 10);
    } else {
      const key = arg.slice(2);
      if (key === "dryRun") opts.dryRun = true;
      if (key === "preflight") opts.preflight = true;
    }
  }
  return opts;
}

function truncate(v: string | null | undefined, max: number): string | null {
  if (v == null) return null;
  return v.length <= max ? v : v.slice(0, max);
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== AutoTrader Scrapling Enrichment ===`);
  console.log(`Limit: ${opts.limit}, Budget: ${Math.round(opts.timeBudgetMs / 1000)}s, Delay: ${opts.delayMs}ms`);
  console.log(`Dry run: ${opts.dryRun}, Pre-flight: ${opts.preflight}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const runtime = process.env.GITHUB_ACTIONS ? "github_actions" as const : "cli" as const;
  await markScraperRunStarted({ scraperName: "at-enrich", runId, startedAt: new Date(startTime).toISOString(), runtime });

  // Query AutoTrader active listings missing key enrichment fields
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, engine, transmission, mileage, vin, color_exterior, description_text, images")
    .eq("source", "AutoTrader")
    .eq("status", "active")
    .or("engine.is.null,transmission.is.null,mileage.is.null,description_text.is.null")
    .order("updated_at", { ascending: true })
    .limit(opts.limit);

  if (error) { console.error("Query error:", error.message); process.exit(1); }
  console.log(`Found ${listings.length} AutoTrader listings needing enrichment\n`);

  if (listings.length === 0) {
    console.log("Nothing to enrich.");
    await clearScraperRunActive("at-enrich");
    return;
  }

  // Pre-flight
  if (opts.preflight) {
    console.log("=== PRE-FLIGHT CHECK ===\n");
    let passed = 0;
    for (const listing of listings.slice(0, 5)) {
      const detail = await fetchATDetailWithScrapling(listing.source_url);
      const ok = !!(detail?.price || detail?.mileage || detail?.engine || detail?.images?.length);
      console.log(`  ${ok ? "OK" : "SKIP"}: ${listing.source_url} — price=${detail?.price}, mileage=${detail?.mileage}, images=${detail?.images?.length ?? 0}`);
      if (ok) passed++;
      await new Promise((r) => setTimeout(r, opts.delayMs));
    }
    console.log(`\nPre-flight: ${passed}/5`);
    if (passed < 2) { console.error("Pre-flight FAILED."); process.exit(1); }
    console.log("Pre-flight PASSED.");
    await clearScraperRunActive("at-enrich");
    return;
  }

  // Batch
  let written = 0, skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const listing = listings[i];
    try {
      const detail = await fetchATDetailWithScrapling(listing.source_url);
      const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

      if (detail) {
        if (detail.price != null && detail.price > 0) {
          updates.current_bid = detail.price;
          updates.hammer_price = detail.price;
        }
        if (!listing.engine && detail.engine) updates.engine = truncate(detail.engine, 100);
        if (!listing.transmission && detail.transmission) updates.transmission = truncate(detail.transmission, 100);
        if (!listing.mileage && detail.mileage != null) {
          const km = detail.mileageUnit === "km" ? detail.mileage : Math.round(detail.mileage * 1.609344);
          updates.mileage = km;
          updates.mileage_unit = "km";
        }
        if (!listing.color_exterior && detail.exteriorColor) updates.color_exterior = truncate(detail.exteriorColor, 100);
        if (!listing.vin && detail.vin) updates.vin = truncate(detail.vin, 17);
        if (!listing.description_text && detail.description) updates.description_text = truncate(detail.description, 2000);
        if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1)) {
          updates.images = detail.images;
          updates.photos_count = detail.images.length;
        }
      } else {
        skipped++;
      }

      if (!opts.dryRun) {
        const { error: updateErr } = await supabase.from("listings").update(updates).eq("id", listing.id);
        if (updateErr) errors.push(`${listing.id}: ${updateErr.message}`);
        else written++;
      } else {
        console.log(`  [DRY] ${listing.source_url}: engine=${detail?.engine || "null"}, mileage=${detail?.mileage || "null"}`);
        written++;
      }

      if (written > 0 && written % 25 === 0) console.log(`  Progress: ${written}/${i + 1}`);
      if (i < listings.length - 1) await new Promise((r) => setTimeout(r, opts.delayMs));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${listing.source_url}: ${msg}`);
    }
  }

  const elapsed = Date.now() - startTime;
  console.log(`\n=== Summary ===`);
  console.log(`Written: ${written}, Skipped: ${skipped}, Errors: ${errors.length}, Duration: ${Math.round(elapsed / 1000)}s`);

  await recordScraperRun({
    scraper_name: "at-enrich",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length === 0,
    runtime,
    duration_ms: elapsed,
    discovered: listings.length,
    written,
    errors_count: errors.length,
    error_messages: errors.length > 0 ? errors.slice(0, 10) : undefined,
  });
  await clearScraperRunActive("at-enrich");
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
```

- [ ] **Step 2: Test locally with dry run**

Run: `npx tsx scripts/autotrader-enrich-scrapling.ts --preflight`
Expected: Pre-flight fetches 5 listings, at least 2 return enriched data.

- [ ] **Step 3: Commit**

```bash
git add scripts/autotrader-enrich-scrapling.ts
git commit -m "feat(autotrader): add Scrapling-based enrichment CLI script

Modeled on as24-enrich-scrapling.ts. Queries unenriched active
AutoTrader listings, fetches details via Scrapling, updates DB.
Supports --preflight, --dryRun, --limit, --delayMs."
```

---

### Task 9: Create AutoTrader Enrichment Workflow

**Files:**
- Create: `.github/workflows/autotrader-enrich.yml`
- Reference: `.github/workflows/autoscout24-enrich.yml` (template)

- [ ] **Step 1: Create the workflow**

```yaml
name: AutoTrader Enrichment (Scrapling)

on:
  schedule:
    - cron: '30 3 * * *'     # 03:30 UTC daily (after collector at 02:00)
  workflow_dispatch:
    inputs:
      limit:
        description: 'Max listings to enrich'
        default: '300'
      delay_ms:
        description: 'Delay between requests (ms)'
        default: '3000'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'
      preflight:
        description: 'Run pre-flight check only'
        default: 'false'

concurrency:
  group: autotrader-enrich
  cancel-in-progress: false

jobs:
  enrich:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Scrapling
        run: |
          python3.11 -m pip install --upgrade pip
          python3.11 -m pip install "scrapling[fetchers,shell]"
          scrapling install

      - run: npm ci

      - name: Run AutoTrader enrichment
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SCRAPLING_PYTHON: python3.11
          AT_FORCE_SCRAPLING: '1'
        run: |
          npx tsx scripts/autotrader-enrich-scrapling.ts \
            --limit=${{ github.event.inputs.limit || '300' }} \
            --delayMs=${{ github.event.inputs.delay_ms || '3000' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }} \
            ${{ github.event.inputs.preflight == 'true' && '--preflight' || '' }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/autotrader-enrich.yml
git commit -m "ci(autotrader): add Scrapling enrichment workflow

Runs daily at 03:30 UTC (after collector). Installs Python 3.11 +
Scrapling, enriches up to 300 listings with 3s delay."
```

---

### Task 10: Remove AutoTrader from Vercel Cron

**Files:**
- Modify: `vercel.json`

Since both collector and enrichment now run via GitHub Actions with Scrapling, remove the Vercel cron entries that always fail with 403.

- [ ] **Step 1: Remove the two AutoTrader entries from vercel.json crons array**

Remove:
```json
{ "path": "/api/cron/autotrader",   "schedule": "0 2 * * *" },
{ "path": "/api/cron/enrich-autotrader", "schedule": "45 7 * * *" },
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "ci(vercel): remove AutoTrader cron entries (moved to GH Actions)

Both collector and enrichment now run via GitHub Actions with Scrapling
to bypass Cloudflare. Vercel cron always got 403."
```

---

## Execution Order Summary

| Task | Phase | Description | Dependencies |
|------|-------|-------------|--------------|
| 1 | Emergency | Fix enrichment demotion bug | None |
| 2 | Emergency | Restore 7,249 listings to active | Task 1 (must fix bug first) |
| 3 | Scrapling | Create Python fetcher script | None |
| 4 | Scrapling | Create TypeScript wrapper | Task 3 |
| 5 | Integration | Update collector discovery | Tasks 3, 4 |
| 6 | Integration | Add Scrapling fallback to detail fetcher | Tasks 3, 4 |
| 7 | GH Actions | Update collector workflow | Tasks 3, 4, 5 |
| 8 | GH Actions | Create enrichment CLI script | Tasks 3, 4, 6 |
| 9 | GH Actions | Create enrichment workflow | Task 8 |
| 10 | Cleanup | Remove Vercel cron entries | Tasks 7, 9 |

**Parallelizable:** Tasks 1+3 can run in parallel. Tasks 5+6 can run in parallel. Tasks 7+8+9 can run in parallel.
