# AS24 Scrapling Integration — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Playwright with Scrapling (`Fetcher`, requests-based) for the AutoScout24 collector to bypass Akamai Bot Manager blocking that has resulted in 0 listings/run for 8+ consecutive days.

**Architecture:** Python fetcher (`Fetcher.get(url, impersonate="chrome")`) extracts `__NEXT_DATA__` JSON from AS24 search/detail pages without a browser. TypeScript wrapper spawns the Python script and parses JSON stdout. Collector conditionally skips browser launch when scrapling is active.

**Tech Stack:** Python 3.11 + scrapling[fetchers], TypeScript/Node.js, Supabase, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-04-20-as24-scrapling-design.md`

**Reference implementation:** Classic.com scrapling (`scripts/classic_scrapling_fetch.py`, `src/features/scrapers/classic_collector/scrapling.ts`, `scripts/classic-enrich-scrapling.ts`)

---

## File Structure

### New Files

| File | Responsibility |
|------|----------------|
| `scripts/as24_scrapling_fetch.py` | Python fetcher — search + detail modes, batch support |
| `src/features/scrapers/autoscout24_collector/scrapling.ts` | TS wrapper — spawns Python, parses JSON stdout |
| `scripts/as24-enrich-scrapling.ts` | Enrichment CLI — fetches detail pages, updates null DB fields |

### Modified Files

| File | Change |
|------|--------|
| `src/features/scrapers/autoscout24_collector/types.ts` | Add `AS24ScraplingSearchResult`, `AS24ScraplingDetailResult` |
| `src/features/scrapers/autoscout24_collector/discover.ts` | Add `discoverShardWithScrapling()` |
| `src/features/scrapers/autoscout24_collector/collector.ts` | Conditional browser launch, scrapling discovery path, guard detail fetch |
| `src/features/scrapers/autoscout24_collector/cli.ts` | Add `--forceScrapling` and `--disablePlaywright` flags |
| `src/features/scrapers/common/monitoring/types.ts` | Add `'as24-enrich'` to `ScraperName` |
| `.github/workflows/autoscout24-collector.yml` | Add Python/scrapling setup, env vars |
| `.github/workflows/autoscout24-enrich.yml` | Switch to scrapling enrichment script, schedule 07:30 |

---

## Chunk 1: Foundation — Python Fetcher + TS Wrapper

### Task 1: Create Python Fetcher

**Files:**
- Create: `scripts/as24_scrapling_fetch.py`

This script mirrors `scripts/classic_scrapling_fetch.py` but adds a **mode argument** (`search` or `detail`) as the first CLI arg. The search mode replicates the `mapNextDataListing()` logic from `discover.ts:267-341`, outputting flat fields matching `AS24ListingSummary`.

- [ ] **Step 1: Create the Python fetcher script**

```python
#!/usr/bin/env python3
"""Fetch AutoScout24 pages through Scrapling and emit parsed JSON.

Modes:
  search <url> [<url> ...]   — fetch search page(s), extract listings from __NEXT_DATA__
  detail <url> [<url> ...]   — fetch detail page(s), extract vehicle specs

The TypeScript wrapper expects JSON on stdout.
"""

from __future__ import annotations

import io
import json
import os
import re
import sys
from concurrent.futures import ProcessPoolExecutor

# Force UTF-8 stdout/stderr on Windows (avoids charmap codec errors)
if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers.requests import Fetcher


# ── Fetch ──────────────────────────────────────────────────────────────

def fetch_html(url: str, timeout: int = 15) -> str:
    try:
        response = Fetcher.get(url, impersonate="chrome", timeout=timeout, retries=1)
    except Exception as exc:
        raise RuntimeError(f"Scrapling fetch failed: {exc}") from exc

    text = getattr(response, "html_content", "") or getattr(response, "body", "") or ""
    if not text:
        raise RuntimeError("Scrapling fetch returned empty HTML")
    return text


# ── __NEXT_DATA__ Extraction ──────────────────────────────────────────

def extract_next_data(html_text: str) -> dict | None:
    match = re.search(
        r'<script\s+id="__NEXT_DATA__"[^>]*>\s*(.*?)\s*</script>',
        html_text,
        re.DOTALL,
    )
    if not match:
        return None
    try:
        return json.loads(match.group(1))
    except json.JSONDecodeError:
        return None


# ── Search Mode ───────────────────────────────────────────────────────

def parse_search(url: str) -> dict:
    raw_html = fetch_html(url, timeout=15)
    next_data = extract_next_data(raw_html)
    if not next_data:
        return {"ok": False, "error": "No __NEXT_DATA__ found", "url": url}

    page_props = next_data.get("props", {}).get("pageProps", {})
    raw_listings = page_props.get("listings", [])
    total_results = page_props.get("numberOfResults")
    total_pages = page_props.get("numberOfPages")

    listings = []
    for raw in raw_listings:
        listing = _map_listing(raw)
        if listing:
            listings.append(listing)

    return {
        "ok": True,
        "mode": "search",
        "listings": listings,
        "totalResults": total_results if isinstance(total_results, int) else None,
        "totalPages": total_pages if isinstance(total_pages, int) else None,
        "url": url,
    }


def _map_listing(raw: dict) -> dict | None:
    """Replicates discover.ts mapNextDataListing() — outputs flat AS24ListingSummary fields."""
    listing_id = raw.get("id")
    if not listing_id:
        return None

    # URL
    rel_url = raw.get("url", "")
    if rel_url:
        url = rel_url if rel_url.startswith("http") else f"https://www.autoscout24.com{rel_url}"
    else:
        url = f"https://www.autoscout24.com/offers/{listing_id}"

    id_match = re.search(r"/offers/([^?#]+)", url)
    final_id = id_match.group(1) if id_match else str(listing_id)

    # Vehicle
    v = raw.get("vehicle") or {}
    make = v.get("make", "Porsche")
    model = v.get("model") or v.get("modelGroup")
    variant = v.get("variant")
    version = v.get("modelVersionInput")

    # Title (same logic as discover.ts buildTitle)
    parts = [make]
    if model:
        parts.append(model)
    if version:
        parts.append(version)
    elif variant and variant != f"{make} {model}":
        parts.append(variant)
    title = " ".join(parts)

    # Price — prefer tracking.price (clean number) over priceFormatted
    tracking = raw.get("tracking") or {}
    tracking_price = _safe_int(tracking.get("price"))
    formatted_price = _parse_price((raw.get("price") or {}).get("priceFormatted", ""))
    price = tracking_price or formatted_price

    # Currency from formatted price
    price_formatted = (raw.get("price") or {}).get("priceFormatted", "")
    currency = _detect_currency(price_formatted) or "EUR"

    # Mileage — prefer tracking.mileage
    tracking_mileage = _safe_int(tracking.get("mileage"))
    vehicle_mileage = _parse_number(v.get("mileageInKm", ""))
    mileage_km = tracking_mileage or vehicle_mileage

    # Year from firstRegistration
    first_reg = tracking.get("firstRegistration")
    year = _parse_year_from_reg(first_reg) or _parse_year_from_title(title)

    # Location (flat string, matching AS24ListingSummary.location)
    loc = raw.get("location") or {}
    loc_parts = [loc.get("city"), loc.get("zip")]
    location = ", ".join(str(p) for p in loc_parts if p) or None
    country = loc.get("countryCode")

    # Images — upgrade resolution from 250x188 to 720x540
    images = [
        img.replace("/250x188.webp", "/720x540.webp")
        for img in (raw.get("images") or [])
    ]

    # Transmission, power, fuel, seller
    transmission = v.get("transmission") or _find_detail(raw.get("vehicleDetails"), "Gear")
    power = _find_detail(raw.get("vehicleDetails"), "Power")
    fuel_type = v.get("fuel")
    seller_type = (raw.get("seller") or {}).get("type")

    return {
        "id": final_id,
        "url": url,
        "title": title,
        "price": price,
        "currency": currency,
        "mileageKm": mileage_km,
        "year": year,
        "make": make,
        "model": model,
        "fuelType": fuel_type,
        "transmission": transmission,
        "power": power,
        "location": location,
        "country": country,
        "sellerType": seller_type,
        "images": images,
        "firstRegistration": first_reg,
    }


# ── Detail Mode ───────────────────────────────────────────────────────

def parse_detail(url: str) -> dict:
    raw_html = fetch_html(url, timeout=10)
    vehicle: dict = {
        "trim": None, "vin": None, "transmission": None,
        "bodyStyle": None, "engine": None,
        "colorExterior": None, "colorInterior": None,
        "description": None, "images": [], "features": [],
    }

    next_data = extract_next_data(raw_html)
    if next_data:
        page_props = next_data.get("props", {}).get("pageProps", {})
        _extract_detail_from_next_data(page_props, vehicle)

    # Fallback: JSON-LD structured data
    _extract_from_json_ld(raw_html, vehicle)

    return {"ok": True, "mode": "detail", "vehicle": vehicle, "url": url}


def _extract_detail_from_next_data(page_props: dict, vehicle: dict) -> None:
    """Extract vehicle details from __NEXT_DATA__ pageProps on detail pages."""
    listing = (
        page_props.get("listingDetails")
        or page_props.get("listing")
        or page_props.get("pageData", {}).get("listingDetails")
        or {}
    )

    v = listing.get("vehicle") or {}
    tracking = listing.get("tracking") or {}

    if not vehicle["trim"]:
        vehicle["trim"] = v.get("modelVersionInput") or v.get("variant") or tracking.get("variant")
    if not vehicle["vin"]:
        vehicle["vin"] = listing.get("vin") or v.get("vin")
    if not vehicle["transmission"]:
        vehicle["transmission"] = v.get("transmission") or _find_detail(listing.get("vehicleDetails"), "Gear")
    if not vehicle["bodyStyle"]:
        vehicle["bodyStyle"] = v.get("bodyType") or v.get("bodyStyle")
    if not vehicle["engine"]:
        engine = v.get("rawPowerInKw") or _find_detail(listing.get("vehicleDetails"), "Power")
        if engine:
            vehicle["engine"] = str(engine)
    if not vehicle["colorExterior"]:
        vehicle["colorExterior"] = v.get("bodyColor") or v.get("bodyColorOriginal")
    if not vehicle["colorInterior"]:
        vehicle["colorInterior"] = v.get("upholsteryColor")
    if not vehicle["description"]:
        vehicle["description"] = listing.get("description") or listing.get("sellerNotes")

    # Images
    imgs = listing.get("images") or []
    if imgs and not vehicle["images"]:
        vehicle["images"] = [
            img.replace("/250x188.webp", "/720x540.webp")
            for img in imgs if isinstance(img, str)
        ]

    # Features/equipment
    equipment = listing.get("equipment") or listing.get("features") or []
    if equipment and not vehicle["features"]:
        vehicle["features"] = [str(e) for e in equipment if e]


def _extract_from_json_ld(raw_html: str, vehicle: dict) -> None:
    """Fallback: extract from JSON-LD structured data."""
    for match in re.finditer(
        r'<script\s+type="application/ld\+json"[^>]*>\s*(.*?)\s*</script>',
        raw_html, re.DOTALL,
    ):
        try:
            data = json.loads(match.group(1))
        except json.JSONDecodeError:
            continue
        if not isinstance(data, dict):
            continue
        schema_type = data.get("@type", "")
        if schema_type not in ("Car", "Vehicle", "Product"):
            continue

        if not vehicle["vin"]:
            vehicle["vin"] = data.get("vehicleIdentificationNumber")
        if not vehicle["bodyStyle"]:
            vehicle["bodyStyle"] = data.get("bodyType")
        if not vehicle["engine"]:
            eng = data.get("vehicleEngine")
            if isinstance(eng, dict):
                vehicle["engine"] = eng.get("engineDisplacement") or eng.get("name")
            elif isinstance(eng, str):
                vehicle["engine"] = eng
        if not vehicle["colorExterior"]:
            vehicle["colorExterior"] = data.get("color")
        if not vehicle["transmission"]:
            trans = data.get("vehicleTransmission")
            if trans:
                vehicle["transmission"] = str(trans)
        if not vehicle["description"]:
            vehicle["description"] = data.get("description")
        if not vehicle["images"] and data.get("image"):
            imgs = data["image"]
            if isinstance(imgs, str):
                vehicle["images"] = [imgs]
            elif isinstance(imgs, list):
                vehicle["images"] = [str(i) for i in imgs if i]


# ── Helpers ───────────────────────────────────────────────────────────

def _safe_int(val) -> int | None:
    if val is None:
        return None
    try:
        n = int(val)
        return n if n > 0 else None
    except (ValueError, TypeError):
        return None

def _parse_price(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", text)
    try:
        n = int(cleaned)
        return n if n > 0 else None
    except ValueError:
        return None

def _parse_number(text: str) -> int | None:
    if not text:
        return None
    cleaned = re.sub(r"[^0-9]", "", str(text))
    try:
        n = int(cleaned)
        return n if n > 0 else None
    except ValueError:
        return None

def _detect_currency(text: str) -> str | None:
    if not text:
        return None
    if "CHF" in text or "Fr." in text:
        return "CHF"
    if "£" in text or "GBP" in text:
        return "GBP"
    if "$" in text or "USD" in text:
        return "USD"
    if "€" in text or "EUR" in text:
        return "EUR"
    return "EUR"

def _parse_year_from_reg(text) -> int | None:
    if not text:
        return None
    m = re.search(r"(?:\d{2}[/-])?((?:19|20)\d{2})", str(text))
    return int(m.group(1)) if m else None

def _parse_year_from_title(title: str) -> int | None:
    m = re.search(r"\b(19\d{2}|20\d{2})\b", title)
    return int(m.group(1)) if m else None

def _find_detail(details, label: str) -> str | None:
    if not details or not isinstance(details, list):
        return None
    for d in details:
        if isinstance(d, dict) and d.get("ariaLabel") == label:
            return d.get("data")
    return None


# ── Batch & CLI ───────────────────────────────────────────────────────

def _parse_search_safe(url: str) -> dict:
    try:
        return parse_search(url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}

def _parse_detail_safe(url: str) -> dict:
    try:
        return parse_detail(url)
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


def main() -> int:
    if len(sys.argv) < 3:
        sys.stderr.write("Usage: as24_scrapling_fetch.py <search|detail> <url> [<url> ...]\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "Mode and URL required"}))
        return 1

    mode = sys.argv[1]
    urls = sys.argv[2:]

    if mode not in ("search", "detail"):
        sys.stderr.write(f"Unknown mode: {mode}\n")
        sys.stdout.write(json.dumps({"ok": False, "error": f"Unknown mode: {mode}"}))
        return 1

    parse_fn = parse_search if mode == "search" else parse_detail
    safe_fn = _parse_search_safe if mode == "search" else _parse_detail_safe
    max_workers = 4 if mode == "search" else 6

    try:
        if len(urls) == 1:
            payload = parse_fn(urls[0])
            sys.stdout.write(json.dumps(payload, ensure_ascii=False))
            return 0

        results = []
        with ProcessPoolExecutor(max_workers=min(max_workers, len(urls))) as executor:
            for parsed in executor.map(safe_fn, urls):
                results.append(parsed)

        sys.stdout.write(json.dumps({"ok": True, "results": results}, ensure_ascii=False))
        return 0
    except Exception as exc:
        sys.stderr.write(str(exc) + "\n")
        sys.stdout.write(json.dumps({"ok": False, "error": str(exc)}))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Validate Python fetcher locally (search mode)**

Run:
```bash
python scripts/as24_scrapling_fetch.py search "https://www.autoscout24.com/lst/porsche/911?cy=D&fregfrom=2020&fregto=2025"
```

Expected: JSON with `"ok": true`, `"mode": "search"`, `"listings": [...]` (non-empty array), `"totalResults"`, `"totalPages"`.

- [ ] **Step 3: Validate Python fetcher locally (detail mode)**

Run:
```bash
python scripts/as24_scrapling_fetch.py detail "https://www.autoscout24.com/offers/porsche-911-carrera-gasoline-white-886bb429-99d0-4773-bf73-e51a04be3dd0"
```

(Use a real URL from step 2's output)

Expected: JSON with `"ok": true`, `"mode": "detail"`, `"vehicle": { "trim": ..., ... }`.

- [ ] **Step 4: Commit Python fetcher**

```bash
git add scripts/as24_scrapling_fetch.py
git commit -m "feat(as24): add scrapling Python fetcher for search + detail modes"
```

---

### Task 2: Add Scrapling Types to `types.ts`

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/types.ts`

Per spec, scrapling types are defined in `types.ts` alongside existing `AS24ListingSummary` and `AS24DetailParsed`.

- [ ] **Step 1: Add scrapling types at the end of `types.ts`**

After the existing `CollectorResult` interface (after line 174), add:

```typescript
/** Result from scrapling search page fetch */
export interface AS24ScraplingSearchResult {
  listings: AS24ListingSummary[];
  totalResults: number | null;
  totalPages: number | null;
}

/** Result from scrapling detail page fetch */
export interface AS24ScraplingDetailResult {
  trim: string | null;
  vin: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  engine: string | null;
  colorExterior: string | null;
  colorInterior: string | null;
  description: string | null;
  images: string[];
  features: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add src/features/scrapers/autoscout24_collector/types.ts
git commit -m "feat(as24): add scrapling search/detail result types"
```

---

### Task 3: Create TS Wrapper

**Files:**
- Create: `src/features/scrapers/autoscout24_collector/scrapling.ts`

Adapts the Classic.com wrapper pattern (`src/features/scrapers/classic_collector/scrapling.ts`). Key difference: this wrapper passes a mode argument (`search`/`detail`) to the Python script, and handles two distinct return types. Types are imported from `types.ts`.

- [ ] **Step 1: Create the TS wrapper**

```typescript
/**
 * AutoScout24 Scrapling wrapper — spawns Python fetcher, parses JSON stdout.
 *
 * Adapts the Classic.com pattern (classic_collector/scrapling.ts) with
 * a mode argument (search/detail) and two return types.
 */
import { execFile, spawnSync } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

import type { AS24ListingSummary, AS24ScraplingSearchResult, AS24ScraplingDetailResult } from "./types";
import { logEvent } from "./logging";

const execFileAsync = promisify(execFile);

/* ── Predicates ────────────────────────────────────────────────────── */

/** Returns true if scrapling is available (not Vercel, not force-disabled) */
export function canUseScrapling(): boolean {
  return !process.env.VERCEL && process.env.AS24_FORCE_SCRAPLING !== "0";
}

/** Returns true if Playwright fallback should be skipped entirely */
export function shouldSkipPlaywrightFallback(): boolean {
  return process.env.AS24_DISABLE_PLAYWRIGHT_FALLBACK === "1";
}

/* ── Internals ─────────────────────────────────────────────────────── */

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

function shellEscape(arg: string): string {
  return `'${arg.replace(/'/g, `'\\''`)}'`;
}

const SCRIPT_PATH = "scripts/as24_scrapling_fetch.py";

/* ── Search ────────────────────────────────────────────────────────── */

/** Fetch a search page → listings + pagination info */
export async function fetchAS24SearchWithScrapling(
  url: string,
): Promise<AS24ScraplingSearchResult | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const shell = process.env.SHELL || "/bin/bash";
    const command = `${resolveScraplingPython()} ${shellEscape(scriptPath)} search ${shellEscape(url)}`;
    const result = await execFileAsync(shell, ["-lc", command], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch (err) {
    logEvent({
      level: "warn",
      event: "scrapling.search_error",
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
      logEvent({ level: "warn", event: "scrapling.search_failed", url, error: parsed.error });
      return null;
    }
    return {
      listings: Array.isArray(parsed.listings) ? parsed.listings : [],
      totalResults: typeof parsed.totalResults === "number" ? parsed.totalResults : null,
      totalPages: typeof parsed.totalPages === "number" ? parsed.totalPages : null,
    };
  } catch {
    return null;
  }
}

/* ── Detail ────────────────────────────────────────────────────────── */

/** Fetch a detail page → vehicle specs */
export async function fetchAS24DetailWithScrapling(
  url: string,
): Promise<AS24ScraplingDetailResult | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const shell = process.env.SHELL || "/bin/bash";
    const command = `${resolveScraplingPython()} ${shellEscape(scriptPath)} detail ${shellEscape(url)}`;
    const result = await execFileAsync(shell, ["-lc", command], {
      encoding: "utf8",
      timeout: 30_000,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
  } catch {
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok || !parsed.vehicle) return null;
    const v = parsed.vehicle;
    return {
      trim: v.trim ?? null,
      vin: v.vin ?? null,
      transmission: v.transmission ?? null,
      bodyStyle: v.bodyStyle ?? null,
      engine: v.engine ?? null,
      colorExterior: v.colorExterior ?? null,
      colorInterior: v.colorInterior ?? null,
      description: v.description ?? null,
      images: Array.isArray(v.images) ? v.images : [],
      features: Array.isArray(v.features) ? v.features : [],
    };
  } catch {
    return null;
  }
}

/* ── Batch Detail ──────────────────────────────────────────────────── */

/** Batch fetch detail pages (for enrichment script) */
export async function fetchAS24DetailBatchWithScrapling(
  urls: string[],
): Promise<Array<(AS24ScraplingDetailResult & { url: string }) | null> | null> {
  if (!canUseScrapling() || urls.length === 0) return [];

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  const result = spawnSync(resolveScraplingPython(), [scriptPath, "detail", ...urls], {
    encoding: "utf8",
    timeout: 120_000,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });

  if (result.error || result.status !== 0) return null;

  const stdout = (result.stdout ?? "").trim();
  if (!stdout) return null;

  try {
    const parsed = JSON.parse(stdout);
    if (!parsed.ok || !Array.isArray(parsed.results)) return null;

    return parsed.results.map((item: Record<string, unknown>) => {
      const ok = item.ok as boolean;
      if (!ok || !item.vehicle) return null;
      const v = item.vehicle as Record<string, unknown>;
      return {
        trim: (v.trim as string) ?? null,
        vin: (v.vin as string) ?? null,
        transmission: (v.transmission as string) ?? null,
        bodyStyle: (v.bodyStyle as string) ?? null,
        engine: (v.engine as string) ?? null,
        colorExterior: (v.colorExterior as string) ?? null,
        colorInterior: (v.colorInterior as string) ?? null,
        description: (v.description as string) ?? null,
        images: Array.isArray(v.images) ? v.images : [],
        features: Array.isArray(v.features) ? v.features : [],
        url: (item.url as string) ?? "",
      };
    });
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Commit TS wrapper**

```bash
git add src/features/scrapers/autoscout24_collector/scrapling.ts
git commit -m "feat(as24): add scrapling TS wrapper for search + detail"
```

---

## Chunk 2: Integration — Discovery + Collector

### Task 4: Add `discoverShardWithScrapling()` to discover.ts

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/discover.ts`

Add a new `discoverShardWithScrapling()` function that mirrors `discoverShard()` but calls `fetchAS24SearchWithScrapling()` instead of Playwright's `page.goto()`. The existing `discoverShard()` remains unchanged for Playwright fallback.

- [ ] **Step 1: Add import for `fetchAS24SearchWithScrapling`**

At the top of `discover.ts`, after the existing imports (line 7), add:

```typescript
import { fetchAS24SearchWithScrapling } from "./scrapling";
```

- [ ] **Step 2: Add `ScraplingDiscoverOptions` interface and `discoverShardWithScrapling()` function**

After the `discoverShard()` function (after line 151), add:

```typescript
/* ------------------------------------------------------------------ */
/*  Scrapling-based Discovery                                          */
/* ------------------------------------------------------------------ */

export interface ScraplingDiscoverOptions {
  shard: SearchShard;
  runId: string;
  navigationDelayMs: number;
  resumeFromPage?: number;
  onPageDone?: (shardId: string, page: number, found: number) => Promise<void>;
}

/**
 * Discover listings using Scrapling (requests-based, no browser).
 * Mirrors discoverShard() interface but calls fetchAS24SearchWithScrapling().
 */
export async function discoverShardWithScrapling(
  opts: ScraplingDiscoverOptions,
): Promise<DiscoverResult> {
  const allListings: AS24ListingSummary[] = [];
  const seenUrls = new Set<string>();
  let totalResults: number | null = null;
  let pagesProcessed = 0;
  const startPage = (opts.resumeFromPage ?? 0) + 1;

  for (let pageNum = startPage; pageNum <= opts.shard.maxPages; pageNum++) {
    const url = buildSearchUrl(opts.shard, pageNum);
    logEvent({
      level: "info",
      event: "discover.scrapling_page_start",
      runId: opts.runId,
      shard: opts.shard.id,
      page: pageNum,
      url,
    });

    const result = await fetchAS24SearchWithScrapling(url);
    if (!result) {
      logEvent({
        level: "warn",
        event: "discover.scrapling_fetch_failed",
        runId: opts.runId,
        shard: opts.shard.id,
        page: pageNum,
      });
      break;
    }

    if (totalResults === null && result.totalResults !== null) {
      totalResults = result.totalResults;
    }

    // Deduplicate by URL
    const newListings: AS24ListingSummary[] = [];
    for (const listing of result.listings) {
      if (!seenUrls.has(listing.url)) {
        seenUrls.add(listing.url);
        newListings.push(listing);
      }
    }

    allListings.push(...newListings);
    pagesProcessed++;

    logEvent({
      level: "info",
      event: "discover.scrapling_page_done",
      runId: opts.runId,
      shard: opts.shard.id,
      page: pageNum,
      found: newListings.length,
      total: allListings.length,
      totalResults,
    });

    if (newListings.length === 0) break;

    // Warn if shard is saturated
    if (pageNum === 20 && newListings.length > 0) {
      logEvent({
        level: "warn",
        event: "discover.shard_saturated",
        runId: opts.runId,
        shard: opts.shard.id,
        message: "Shard reached 20-page limit. Consider adding price-range sub-shards.",
      });
    }

    await opts.onPageDone?.(opts.shard.id, pageNum, newListings.length);

    // Rate limiting between pages
    if (pageNum < opts.shard.maxPages) {
      await new Promise((r) => setTimeout(r, opts.navigationDelayMs));
    }
  }

  return {
    shardId: opts.shard.id,
    listings: allListings,
    totalResults,
    pagesProcessed,
  };
}
```

- [ ] **Step 3: Commit discovery integration**

```bash
git add src/features/scrapers/autoscout24_collector/discover.ts
git commit -m "feat(as24): add discoverShardWithScrapling() for requests-based discovery"
```

---

### Task 5: Modify Collector for Conditional Scrapling/Playwright

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/collector.ts`

Make browser launch conditional on `canUseScrapling()`. When scrapling is active: skip browser, use `discoverShardWithScrapling()`, skip context refresh, guard detail fetch path (prevent null `page` crash when `scrapeDetails=true`).

- [ ] **Step 1: Add imports**

At the top of `collector.ts`, add to the existing imports:

```typescript
import { canUseScrapling } from "./scrapling";
import { discoverShardWithScrapling } from "./discover";
```

Note: `discoverShard` is already imported from `"./discover"` — just add `discoverShardWithScrapling` to the existing import.

- [ ] **Step 2: Make browser launch conditional**

Replace lines 139-153 (the browser launch block — keep line 154 `const rateLimiter = ...` intact):

```typescript
  // Launch browser
  const browser = await launchStealthBrowser({
    headless: config.headless,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  });

  let context = await createStealthContext(browser, {
    headless: config.headless,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  });
  let page = await createPage(context);
```

With:

```typescript
  // Scrapling mode: skip browser entirely
  const useScrapling = canUseScrapling();
  logEvent({ level: "info", event: "collector.mode", runId, mode: useScrapling ? "scrapling" : "playwright" });

  const browser = useScrapling ? null : await launchStealthBrowser({
    headless: config.headless,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  });

  let context = browser ? await createStealthContext(browser, {
    headless: config.headless,
    proxyServer: config.proxyServer,
    proxyUsername: config.proxyUsername,
    proxyPassword: config.proxyPassword,
  }) : null;
  let page = context ? await createPage(context) : null;
```

- [ ] **Step 3: Switch discovery function**

Replace lines 186-197 (the `discoverShard` call):

```typescript
      const discoverResult = await discoverShard({
        page,
        shard,
        rateLimiter,
        pageTimeoutMs: config.pageTimeoutMs,
        runId,
        resumeFromPage: resumePage,
        onPageDone: async (shardId, pageNum, found) => {
          checkpoint = updateShardCheckpoint(checkpoint, shardId, pageNum, found);
          await saveCheckpoint(config.checkpointPath, checkpoint);
        },
      });
```

With:

```typescript
      const discoverResult = useScrapling
        ? await discoverShardWithScrapling({
            shard,
            runId,
            navigationDelayMs: config.navigationDelayMs,
            resumeFromPage: resumePage,
            onPageDone: async (shardId, pageNum, found) => {
              checkpoint = updateShardCheckpoint(checkpoint, shardId, pageNum, found);
              await saveCheckpoint(config.checkpointPath, checkpoint);
            },
          })
        : await discoverShard({
            page: page!,
            shard,
            rateLimiter,
            pageTimeoutMs: config.pageTimeoutMs,
            runId,
            resumeFromPage: resumePage,
            onPageDone: async (shardId, pageNum, found) => {
              checkpoint = updateShardCheckpoint(checkpoint, shardId, pageNum, found);
              await saveCheckpoint(config.checkpointPath, checkpoint);
            },
          });
```

- [ ] **Step 4: Skip context refresh in scrapling mode**

Change the context refresh condition (around line 224). Replace:

```typescript
        if (totalListingsProcessed > 0 && totalListingsProcessed % CONTEXT_REFRESH_INTERVAL === 0) {
```

With:

```typescript
        if (!useScrapling && totalListingsProcessed > 0 && totalListingsProcessed % CONTEXT_REFRESH_INTERVAL === 0) {
```

- [ ] **Step 5: Guard detail fetch path in scrapling mode**

The detail fetching block (around lines 239-264) uses `page` directly via `fetchAndParseDetail({ page, ... })`. When `useScrapling` is true and `page` is null, this would crash. Guard the `scrapeDetails` block to only use Playwright when not in scrapling mode. In scrapling mode, always fall through to summary-only normalization (detail enrichment happens separately via the enrichment script).

Replace:

```typescript
        if (config.scrapeDetails) {
```

With:

```typescript
        if (config.scrapeDetails && !useScrapling) {
```

This ensures scrapling mode never enters the Playwright detail fetch path. The circuit breaker at lines 200-205 (`consecutiveBlocks++` when 0 listings and 0 pages) already works correctly for scrapling mode — no adaptation needed since `counts.akamaiBlocked` is only incremented inside this now-guarded detail block.

- [ ] **Step 6: Make browser cleanup null-safe**

Replace the cleanup in the `finally` block (around lines 309-312):

```typescript
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await closeBrowser(browser);
```

With:

```typescript
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
    if (browser) await closeBrowser(browser);
```

- [ ] **Step 7: Commit collector integration**

```bash
git add src/features/scrapers/autoscout24_collector/collector.ts
git commit -m "feat(as24): conditional scrapling/playwright in collector"
```

---

### Task 6: Add CLI flags for scrapling control

**Files:**
- Modify: `src/features/scrapers/autoscout24_collector/cli.ts`

The spec mentions "minor flag additions" for CLI. Add `--forceScrapling` and `--disablePlaywright` flags that set the corresponding env vars before the collector runs.

- [ ] **Step 1: Add flag parsing in cli.ts**

In the `main()` function in `cli.ts`, after the existing flag parsing (around line 100, before the `runAutoScout24Collector` call), add:

```typescript
    // Scrapling control flags → set env vars consumed by scrapling.ts predicates
    if (hasFlag(argsMap, "forceScrapling")) {
      process.env.AS24_FORCE_SCRAPLING = "1";
    }
    if (argsMap.get("forceScrapling") === "0") {
      process.env.AS24_FORCE_SCRAPLING = "0";
    }
    if (hasFlag(argsMap, "disablePlaywright")) {
      process.env.AS24_DISABLE_PLAYWRIGHT_FALLBACK = "1";
    }
```

Also add these flags to the help text output.

- [ ] **Step 2: Commit**

```bash
git add src/features/scrapers/autoscout24_collector/cli.ts
git commit -m "feat(as24): add --forceScrapling and --disablePlaywright CLI flags"
```

---

### Task 7: Add `'as24-enrich'` to ScraperName type

**Files:**
- Modify: `src/features/scrapers/common/monitoring/types.ts`

- [ ] **Step 1: Add scraper name to union type**

In `src/features/scrapers/common/monitoring/types.ts`, add `'as24-enrich'` to the `ScraperName` union type (line 1). Add it after `'enrich-details-bulk'`.

- [ ] **Step 2: Commit**

```bash
git add src/features/scrapers/common/monitoring/types.ts
git commit -m "chore: add as24-enrich to ScraperName type"
```

---

## Chunk 3: Enrichment + GHA Workflows

### Task 8: Create Enrichment Script

**Files:**
- Create: `scripts/as24-enrich-scrapling.ts`

Modeled on `scripts/classic-enrich-scrapling.ts`. Queries AS24 listings where `trim IS NULL`, fetches detail pages via Scrapling, updates only null DB fields. Always sets `trim = ""` after attempting (sentinel to prevent re-processing).

- [ ] **Step 1: Create the enrichment script**

```typescript
/**
 * CLI: Enrich AutoScout24 listings via Scrapling.
 * Designed for GitHub Actions (20-minute budget).
 *
 * Finds listings where trim IS NULL (proxy for unenriched),
 * fetches detail pages with Scrapling, and updates only null fields.
 * Always sets trim="" after attempting (sentinel to prevent re-processing).
 *
 * Usage:
 *   npx tsx scripts/as24-enrich-scrapling.ts
 *   npx tsx scripts/as24-enrich-scrapling.ts --limit=100 --dryRun
 *   npx tsx scripts/as24-enrich-scrapling.ts --preflight
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local for local runs
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import { fetchAS24DetailWithScrapling } from "../src/features/scrapers/autoscout24_collector/scrapling";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 500,
    timeBudgetMs: 20 * 60 * 1000, // 20 minutes
    delayMs: 2000,
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

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== AutoScout24 Scrapling Enrichment ===`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Time budget: ${Math.round(opts.timeBudgetMs / 1000)}s`);
  console.log(`Delay: ${opts.delayMs}ms`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Pre-flight: ${opts.preflight}\n`);

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
  await markScraperRunStarted({
    scraperName: "as24-enrich",
    runId,
    startedAt: new Date(startTime).toISOString(),
    runtime,
  });

  // Query AS24 listings needing enrichment: trim IS NULL = never attempted
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, trim, transmission, body_style, engine, color_exterior, color_interior, vin, description_text, images")
    .eq("source", "AutoScout24")
    .eq("status", "active")
    .is("trim", null)
    .order("updated_at", { ascending: true })
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} AS24 listings needing enrichment\n`);

  if (listings.length === 0) {
    console.log("Nothing to enrich. Done!");
    await clearScraperRunActive("as24-enrich");
    return;
  }

  // ── Pre-flight check ──
  if (opts.preflight) {
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const sample = listings.slice(0, 5);
    let passed = 0;
    for (const listing of sample) {
      try {
        const detail = await fetchAS24DetailWithScrapling(listing.source_url);
        if (detail) {
          const hasData = !!(detail.trim || detail.vin || detail.engine || detail.description);
          console.log(`  ${listing.source_url}`);
          console.log(`    trim: ${detail.trim || "null"}, vin: ${detail.vin || "null"}, engine: ${detail.engine || "null"}, images: ${detail.images.length}`);
          if (hasData) passed++;
        } else {
          console.log(`  SKIP: ${listing.source_url} — Scrapling returned null`);
        }
        await new Promise((r) => setTimeout(r, opts.delayMs));
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`  ERROR: ${listing.source_url} — ${msg}`);
      }
    }
    console.log(`\nPre-flight: ${passed}/${sample.length} returned enriched data`);
    if (passed < 2) {
      console.error("WARNING: Pre-flight check failed (<2 enriched). Investigate before batch run.");
      process.exit(1);
    }
    console.log("Pre-flight PASSED.\n");
    await clearScraperRunActive("as24-enrich");
    return;
  }

  // ── Batch execution ──
  let detailsFetched = 0;
  let written = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const listing = listings[i];

    try {
      const detail = await fetchAS24DetailWithScrapling(listing.source_url);

      // Always set trim to mark as attempted (sentinel — prevents infinite re-processing)
      const updates: Record<string, unknown> = {
        trim: "",
        updated_at: new Date().toISOString(),
      };

      if (detail) {
        detailsFetched++;
        // Only update null/empty fields
        if (detail.trim) updates.trim = detail.trim;
        if (!listing.vin && detail.vin) updates.vin = detail.vin;
        if (!listing.transmission && detail.transmission) updates.transmission = detail.transmission;
        if (!listing.body_style && detail.bodyStyle) updates.body_style = detail.bodyStyle;
        if (!listing.engine && detail.engine) updates.engine = detail.engine;
        if (!listing.color_exterior && detail.colorExterior) updates.color_exterior = detail.colorExterior;
        if (!listing.color_interior && detail.colorInterior) updates.color_interior = detail.colorInterior;
        if (!listing.description_text && detail.description) updates.description_text = detail.description;
        if (detail.images.length > 0 && (!listing.images || listing.images.length <= 1)) {
          updates.images = detail.images;
          updates.photos_count = detail.images.length;
        }
      } else {
        skipped++;
      }

      if (!opts.dryRun) {
        const { error: updateErr } = await supabase
          .from("listings")
          .update(updates)
          .eq("id", listing.id);

        if (updateErr) {
          errors.push(`${listing.id}: ${updateErr.message}`);
        } else {
          written++;
        }
      } else {
        console.log(`  [DRY] ${listing.source_url}: trim=${detail?.trim || "null"}, vin=${detail?.vin || "null"}`);
        written++;
      }

      if (written > 0 && written % 25 === 0) {
        console.log(`  Progress: ${written} updated, ${i + 1}/${listings.length} processed`);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`${listing.source_url}: ${msg}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }

  // Record run
  await recordScraperRun({
    scraper_name: "as24-enrich",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length < listings.length / 2,
    runtime,
    duration_ms: Date.now() - startTime,
    discovered: listings.length,
    written,
    errors_count: errors.length,
    details_fetched: detailsFetched,
    error_messages: errors.length > 0 ? errors.slice(0, 50) : undefined,
  });
  await clearScraperRunActive("as24-enrich");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${listings.length}`);
  console.log(`Detail pages fetched: ${detailsFetched}`);
  console.log(`DB updates: ${written}`);
  console.log(`Skipped (no data): ${skipped}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
  if (errors.length > 0) {
    console.log(`\nFirst 10 errors:`);
    for (const err of errors.slice(0, 10)) console.log(`  - ${err}`);
  }
  console.log(`\nDone!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Validate enrichment preflight locally**

```bash
npx tsx scripts/as24-enrich-scrapling.ts --preflight --limit=5
```

Expected: 2+ of 5 listings return enriched data. Script should print trim/vin/engine per listing.

- [ ] **Step 3: Commit enrichment script**

```bash
git add scripts/as24-enrich-scrapling.ts
git commit -m "feat(as24): add scrapling-based enrichment script"
```

---

### Task 9: Update GHA Workflows

**Files:**
- Modify: `.github/workflows/autoscout24-collector.yml`
- Modify: `.github/workflows/autoscout24-enrich.yml`

#### Collector Workflow

- [ ] **Step 1: Add Python + scrapling setup to collector workflow**

In `.github/workflows/autoscout24-collector.yml`, add Python setup and scrapling install steps after `npm ci` (after line 47) and before the Playwright install step:

```yaml
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install scrapling
        run: pip install "scrapling[fetchers]"
```

- [ ] **Step 2: Make Playwright install conditional**

Replace the Playwright install step (lines 49-52):

```yaml
      - name: Install Playwright browsers
        run: |
          npx playwright install chromium --with-deps
          npx rebrowser-playwright install chromium || true
```

With:

```yaml
      - name: Install Playwright browsers
        if: env.AS24_DISABLE_PLAYWRIGHT_FALLBACK != '1'
        run: |
          npx playwright install chromium --with-deps
          npx rebrowser-playwright install chromium || true
```

- [ ] **Step 3: Add scrapling env vars to collector run step**

In the `Run collector` step env block (around line 54), add:

```yaml
          SCRAPLING_PYTHON: python
          AS24_DISABLE_PLAYWRIGHT_FALLBACK: "1"
```

- [ ] **Step 4: Commit collector workflow**

```bash
git add .github/workflows/autoscout24-collector.yml
git commit -m "ci(as24): add scrapling setup to collector workflow"
```

#### Enrichment Workflow

- [ ] **Step 5: Update enrichment workflow schedule and script**

In `.github/workflows/autoscout24-enrich.yml`:

1. Change schedule from `'30 6 * * *'` to `'30 7 * * *'` (07:30 UTC)

2. Add Python + scrapling setup steps after `npm ci` and before the enrichment run step:

```yaml
      - uses: actions/setup-python@v5
        with:
          python-version: "3.11"

      - name: Install scrapling
        run: pip install "scrapling[fetchers]"
```

3. Replace the enrichment run command. Change:

```yaml
          npx tsx scripts/enrich-as24-bulk.ts \
            --maxListings=${{ github.event.inputs.max_listings || '500' }} \
            --delayMs=${{ github.event.inputs.delay_ms || '1000' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

To:

```yaml
          npx tsx scripts/as24-enrich-scrapling.ts \
            --limit=${{ github.event.inputs.max_listings || '500' }} \
            --delayMs=${{ github.event.inputs.delay_ms || '2000' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

4. Add scrapling env var to the run step:

```yaml
          SCRAPLING_PYTHON: python
```

5. Update quality gate scraper name from `enrich-details-bulk` to `as24-enrich`:

```yaml
            --scraper=as24-enrich \
```

- [ ] **Step 6: Commit enrichment workflow**

```bash
git add .github/workflows/autoscout24-enrich.yml
git commit -m "ci(as24): switch enrichment workflow to scrapling"
```

---

### Task 10: End-to-End Validation

- [ ] **Step 1: Local collector test (limited scope)**

```bash
npx tsx src/features/scrapers/autoscout24_collector/cli.ts \
  --countries=D --maxListings=50 --maxPagesPerShard=2 --dryRun
```

Expected: Scrapling mode activates (`collector.mode=scrapling`), discovers >0 listings, no Akamai blocks.

- [ ] **Step 2: Local enrichment preflight**

```bash
npx tsx scripts/as24-enrich-scrapling.ts --preflight
```

Expected: 2+ of 5 listings return enriched data (trim/vin/engine).

- [ ] **Step 3: Local enrichment dry run**

```bash
npx tsx scripts/as24-enrich-scrapling.ts --limit=10 --dryRun
```

Expected: Processes 10 listings, prints `[DRY]` output per listing with extracted fields.

- [ ] **Step 4: Verify existing tests pass**

```bash
npx vitest run src/features/scrapers/autoscout24_collector/collector.test.ts
```

Expected: All existing `buildHardFailureError` tests pass (no changes to test file needed — the function still works with the existing `akamaiBlocked` counter).
