# BeForward AWS WAF Bypass via Scrapling

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace plain `fetch()` with Scrapling (headless browser) in the BeForward collector to bypass AWS WAF bot protection that has been blocking the daily cron since 2026-05-09.

**Architecture:** HTML-passthrough approach — Python script fetches raw HTML via StealthyFetcher and returns it to TypeScript. Existing cheerio parsers in `discover.ts` and `detail.ts` remain untouched. Follows the same pattern as the AutoTrader scrapling integration (`scripts/autotrader_scrapling_fetch.py` + `autotrader_collector/scrapling.ts`).

**Tech Stack:** Python 3.11, Scrapling (StealthyFetcher), Node.js `child_process.execFile`, GitHub Actions

---

## File Structure

### New files
| File | Responsibility |
|------|---------------|
| `scripts/beforward_scrapling_fetch.py` | Python script: takes URL(s), fetches via StealthyFetcher, returns raw HTML as JSON on stdout |
| `src/features/scrapers/beforward_porsche_collector/scrapling.ts` | TS wrapper: spawns Python script, returns HTML string or `null` |

### Modified files
| File | Change |
|------|--------|
| `src/features/scrapers/beforward_porsche_collector/discover.ts` | Try scrapling before plain `fetchHtml` in `discoverPage()` |
| `src/features/scrapers/beforward_porsche_collector/detail.ts` | Try scrapling before plain `fetchHtml` in `fetchAndParseDetail()` |
| `.github/workflows/beforward-collector.yml` | Add Python 3.11 + Scrapling setup, set env vars, increase timeout |

### Unchanged files (parsing stays in TS)
- `net.ts` — still used as fallback
- `normalize.ts`, `supabase_writer.ts`, `collector.ts`, `types.ts`, `checkpoint.ts` — no changes needed

---

## Chunk 1: Python Scrapling Fetch Script + TypeScript Wrapper

### Task 1: Create the Python scrapling fetch script

**Files:**
- Create: `scripts/beforward_scrapling_fetch.py`

**Context:** This script is much simpler than `autotrader_scrapling_fetch.py` because it does NOT parse — it only fetches raw HTML and returns it. The existing TypeScript cheerio parsers handle all parsing.

**Protocol (JSON on stdout):**
- Single URL success: `{"ok": true, "html": "<full HTML>", "url": "..."}`
- Single URL error: `{"ok": false, "error": "waf_blocked", "url": "..."}`
- Multiple URLs: `{"ok": true, "results": [...]}`

- [ ] **Step 1: Create the Python script**

```python
#!/usr/bin/env python3
"""Fetch BeForward pages through Scrapling StealthyFetcher.

Returns raw HTML for TypeScript cheerio parsers to handle.
Does NOT parse — just fetches and bypasses AWS WAF.

Usage:
  python3.11 beforward_scrapling_fetch.py <url>
  python3.11 beforward_scrapling_fetch.py <url1> <url2> ...

Output (JSON on stdout):
  Single:   {"ok": true, "html": "...", "url": "..."}
  Multiple: {"ok": true, "results": [{"ok": true, "html": "...", "url": "..."}, ...]}
  Error:    {"ok": false, "error": "...", "url": "..."}
"""
from __future__ import annotations

import io
import json
import os
import sys

if sys.platform == "win32":
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")
    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

from scrapling.fetchers import StealthyFetcher


# ── WAF Detection ────────────────────────────────────────────────────

WAF_BLOCK_MARKERS = [
    "awswafcoo",
    "awswaf",
    "access denied",
    "captcha",
    "_challenge",
    "security service to protect",
]


def _is_waf_blocked(html: str) -> bool:
    """Detect AWS WAF challenge pages (typically ~2KB JS challenge)."""
    if len(html) > 10_000:
        return False
    lower = html.lower()
    return any(marker in lower for marker in WAF_BLOCK_MARKERS)


# ── Proxy ────────────────────────────────────────────────────────────

def _get_proxy_config() -> dict | None:
    """Build Playwright proxy dict from BF_PROXY_URL env var."""
    proxy_url = os.environ.get("BF_PROXY_URL", "").strip()
    if not proxy_url:
        return None

    from urllib.parse import urlparse
    parsed = urlparse(proxy_url)
    config: dict = {"server": f"{parsed.scheme}://{parsed.hostname}:{parsed.port}"}
    if parsed.username:
        config["username"] = parsed.username
    if parsed.password:
        config["password"] = parsed.password
    sys.stderr.write(f"[bf-scrapling] Using proxy: {parsed.hostname}:{parsed.port}\n")
    return config


# ── HTML Extraction ──────────────────────────────────────────────────

def _get_html_source(page) -> str:
    """Extract raw HTML string from a Scrapling Adaptor.

    Tries public API methods first, then falls back to private internals.
    The Scrapling API may vary between versions, so we try multiple approaches.
    """
    # Approach 1: Public properties (preferred — stable across versions)
    for attr in ('html_content', 'html', 'body'):
        val = getattr(page, attr, None)
        if val and isinstance(val, str) and len(val) > 100:
            return val

    # Approach 2: str() or prettify() (common in scraping libraries)
    for method_name in ('prettify',):
        method = getattr(page, method_name, None)
        if callable(method):
            try:
                result = method()
                if result and isinstance(result, str) and len(result) > 100:
                    return result
            except Exception:
                pass

    # Approach 3: Private attribute (Scrapling stores original HTML here)
    raw = getattr(page, '_Adaptor__text', None)
    if raw and isinstance(raw, str) and len(raw) > 100:
        return raw

    # Approach 4: selectolax element's .html property
    elem = getattr(page, '_Adaptor__element', None)
    if elem:
        h = getattr(elem, 'html', None)
        if h and isinstance(h, str):
            return h

    return ""


# ── Fetch ────────────────────────────────────────────────────────────

def fetch_html(url: str) -> dict:
    """Fetch a single URL and return raw HTML."""
    try:
        proxy = _get_proxy_config()
        kwargs: dict = {"headless": True, "network_idle": True, "timeout": 30000}
        if proxy:
            kwargs["proxy"] = proxy
        page = StealthyFetcher.fetch(url, **kwargs)
        html = _get_html_source(page)

        if not html:
            return {"ok": False, "error": "empty_html", "url": url, "htmlSize": 0}

        if _is_waf_blocked(html):
            return {"ok": False, "error": "waf_blocked", "url": url, "htmlSize": len(html)}

        return {"ok": True, "html": html, "url": url}
    except Exception as exc:
        return {"ok": False, "error": str(exc), "url": url}


# ── CLI ──────────────────────────────────────────────────────────────

def main() -> int:
    if len(sys.argv) < 2:
        sys.stderr.write("Usage: beforward_scrapling_fetch.py <url> [<url>...]\n")
        sys.stdout.write(json.dumps({"ok": False, "error": "URL required"}))
        return 1

    urls = sys.argv[1:]

    if len(urls) == 1:
        result = fetch_html(urls[0])
        sys.stdout.write(json.dumps(result, ensure_ascii=False))
        return 0 if result["ok"] else 1

    results = []
    for u in urls:
        try:
            results.append(fetch_html(u))
        except Exception as exc:
            results.append({"ok": False, "error": str(exc), "url": u})

    all_ok = all(r["ok"] for r in results)
    sys.stdout.write(json.dumps({"ok": all_ok, "results": results}, ensure_ascii=False))
    return 0 if all_ok else 1


if __name__ == "__main__":
    raise SystemExit(main())
```

- [ ] **Step 2: Verify script syntax**

Run: `python3.11 -c "import ast; ast.parse(open('scripts/beforward_scrapling_fetch.py').read()); print('OK')"`

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add scripts/beforward_scrapling_fetch.py
git commit -m "feat(beforward): add scrapling fetch script for AWS WAF bypass"
```

---

### Task 2: Create the TypeScript scrapling wrapper

**Files:**
- Create: `src/features/scrapers/beforward_porsche_collector/scrapling.ts`

**Context:** Follows the exact same pattern as `src/features/scrapers/autotrader_collector/scrapling.ts`. Key differences:
- Only returns raw HTML (no parsing — AutoTrader's wrapper parses into typed objects)
- Uses `BF_FORCE_SCRAPLING` env var — **opt-in** (requires `=1`) instead of AutoTrader's opt-out pattern, to avoid noisy warnings on dev machines where Python/Scrapling aren't installed
- Uses `console.warn` for logging (BeForward's `logEvent` requires `runId` which the wrapper doesn't have)
- Sets `maxBuffer: 10MB` since raw HTML can be 700KB+ (AutoTrader returns small JSON, so default 1MB is fine there)

- [ ] **Step 1: Create the wrapper module**

```typescript
/**
 * BeForward Scrapling wrapper — spawns Python fetcher, returns raw HTML.
 * Follows the AutoTrader pattern (autotrader_collector/scrapling.ts).
 *
 * Unlike the AutoTrader wrapper which returns parsed data, this returns
 * raw HTML so the existing cheerio parsers in discover.ts / detail.ts
 * can handle parsing unchanged.
 */
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const SCRIPT_PATH = "scripts/beforward_scrapling_fetch.py";

// BeForward pages can be 700KB+; default maxBuffer (1MB) is too tight for raw HTML.
const MAX_BUFFER = 10 * 1024 * 1024; // 10 MB

/* ── Predicates ────────────────────────────────────────────────────── */

export function canUseScrapling(): boolean {
  if (process.env.VERCEL) return false;
  // Opt-in: only use scrapling when explicitly enabled (avoids noise on dev machines
  // where Python 3.11 / Scrapling may not be installed)
  return process.env.BF_FORCE_SCRAPLING === "1";
}

/* ── Internals ─────────────────────────────────────────────────────── */

function resolveScraplingPython(): string {
  return process.env.SCRAPLING_PYTHON || "python3.11";
}

/* ── Fetch ─────────────────────────────────────────────────────────── */

/**
 * Fetch a BeForward page via Scrapling (headless browser).
 * Returns the raw HTML string, or `null` if scrapling is unavailable or fails.
 */
export async function fetchBFHtmlWithScrapling(url: string): Promise<string | null> {
  if (!canUseScrapling()) return null;

  const scriptPath = path.resolve(process.cwd(), SCRIPT_PATH);
  let stdout = "";
  try {
    const python = resolveScraplingPython();
    const result = await execFileAsync(python, [scriptPath, url], {
      encoding: "utf8",
      timeout: 60_000,
      maxBuffer: MAX_BUFFER,
      env: { ...process.env, PYTHONUNBUFFERED: "1" },
    });
    stdout = typeof result === "string" ? result : result.stdout ?? "";
    const stderr = typeof result === "string" ? "" : result.stderr ?? "";
    if (stderr) {
      console.warn(`[bf-scrapling] stderr for ${url}: ${stderr.slice(0, 500)}`);
    }
  } catch (err: unknown) {
    const errObj = err as { stderr?: string; message?: string };
    console.warn(
      `[bf-scrapling] Error fetching ${url}: ${errObj.message ?? String(err)}`,
    );
    return null;
  }

  const trimmed = stdout.trim();
  if (!trimmed) return null;

  try {
    const parsed = JSON.parse(trimmed);
    if (!parsed.ok) {
      console.warn(`[bf-scrapling] Fetch failed for ${url}: ${parsed.error}`);
      return null;
    }
    return typeof parsed.html === "string" ? parsed.html : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit src/features/scrapers/beforward_porsche_collector/scrapling.ts`

Expected: No errors (or only pre-existing project-wide errors)

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/beforward_porsche_collector/scrapling.ts
git commit -m "feat(beforward): add TypeScript scrapling wrapper"
```

---

## Chunk 2: Integration into Discovery + Detail Fetch

### Task 3: Integrate scrapling into discover.ts

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/discover.ts:46-57`

**Context:** The `discoverPage()` function currently calls `fetchHtml()` directly (plain HTTP). We add a scrapling-first strategy: try scrapling, fall back to plain fetch if scrapling is unavailable or fails. When scrapling succeeds, we skip the rate limiter (the browser launch provides natural rate limiting).

- [ ] **Step 1: Add scrapling import to discover.ts**

At the top of `discover.ts`, add the import:

```typescript
import { fetchBFHtmlWithScrapling } from "./scrapling";
```

- [ ] **Step 2: Modify `discoverPage()` to try scrapling first**

Replace the current fetch block in `discoverPage()` (lines 52-57):

```typescript
  const domain = getDomainFromUrl(pageUrl);
  await input.limiter.waitForDomain(domain);
  const { value: html } = await withRetry(() => fetchHtml(pageUrl, input.timeoutMs), {
    retries: 5,
    baseDelayMs: 2000,
  });
```

With:

```typescript
  let html: string;
  // Try scrapling first (bypasses AWS WAF); retry once on failure
  const scraplingHtml = await fetchBFHtmlWithScrapling(pageUrl)
    ?? await fetchBFHtmlWithScrapling(pageUrl);
  if (scraplingHtml) {
    html = scraplingHtml;
  } else {
    // Scrapling unavailable or failed — fall back to plain fetch
    const domain = getDomainFromUrl(pageUrl);
    await input.limiter.waitForDomain(domain);
    const { value } = await withRetry(() => fetchHtml(pageUrl, input.timeoutMs), {
      retries: 5,
      baseDelayMs: 2000,
    });
    html = value;
  }
```

- [ ] **Step 3: Run existing discover tests to verify no regressions**

Run: `npx jest --testPathPattern beforward_porsche_collector/discover --no-coverage`

Expected: All existing tests pass (they use mocked HTML, don't hit the network)

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/beforward_porsche_collector/discover.ts
git commit -m "feat(beforward): use scrapling for discovery page fetch"
```

---

### Task 4: Integrate scrapling into detail.ts

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/detail.ts:6-17`

**Context:** Same pattern as discover.ts — try scrapling first, fall back to plain fetch.

- [ ] **Step 1: Add scrapling import to detail.ts**

At the top of `detail.ts`, add the import:

```typescript
import { fetchBFHtmlWithScrapling } from "./scrapling";
```

- [ ] **Step 2: Modify `fetchAndParseDetail()` to try scrapling first**

Replace the current fetch block in `fetchAndParseDetail()` (lines 11-16):

```typescript
  const domain = getDomainFromUrl(input.url);
  await input.limiter.waitForDomain(domain);
  const { value: html } = await withRetry(() => fetchHtml(input.url, input.timeoutMs), {
    retries: 5,
    baseDelayMs: 2000,
  });
```

With:

```typescript
  let html: string;
  // Try scrapling first (bypasses AWS WAF); retry once on failure
  const scraplingHtml = await fetchBFHtmlWithScrapling(input.url)
    ?? await fetchBFHtmlWithScrapling(input.url);
  if (scraplingHtml) {
    html = scraplingHtml;
  } else {
    // Scrapling unavailable or failed — fall back to plain fetch
    const domain = getDomainFromUrl(input.url);
    await input.limiter.waitForDomain(domain);
    const { value } = await withRetry(() => fetchHtml(input.url, input.timeoutMs), {
      retries: 5,
      baseDelayMs: 2000,
    });
    html = value;
  }
```

- [ ] **Step 3: Run existing detail tests to verify no regressions**

Run: `npx jest --testPathPattern beforward_porsche_collector/detail --no-coverage`

Expected: All existing tests pass (they test `parseDetailHtml()` directly with mock HTML)

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/beforward_porsche_collector/detail.ts
git commit -m "feat(beforward): use scrapling for detail page fetch"
```

---

## Chunk 3: GitHub Actions Workflow Update

### Task 5: Update the beforward-collector workflow

**Files:**
- Modify: `.github/workflows/beforward-collector.yml`

**Context:** Add Python 3.11 + Scrapling installation steps (same as `autotrader-collector.yml`), set environment variables, and increase timeout to 45 minutes to accommodate the slower headless browser fetches.

- [ ] **Step 1: Update the workflow file**

The full updated workflow:

```yaml
name: BeForward Collector (Daily)

on:
  schedule:
    - cron: '0 3 * * *'        # 03:00 UTC daily
  workflow_dispatch:
    inputs:
      max_pages:
        description: 'Max discovery pages (25 listings/page)'
        default: '5'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'
      summary_only:
        description: 'Skip detail page fetches (faster, less data)'
        default: 'false'
      concurrency:
        description: 'Parallel fetch workers (each spawns a Chromium instance via scrapling)'
        default: '2'
      rate_limit_ms:
        description: 'Min ms between requests per domain'
        default: '4000'

concurrency:
  group: beforward-collector
  cancel-in-progress: false

jobs:
  collect:
    runs-on: ubuntu-latest
    timeout-minutes: 45
    # RAM budget: ~2 concurrent Chromium instances (~400MB) + Node.js (~200MB) = ~600MB of 7GB

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: npm

      - uses: actions/setup-python@v5
        with:
          python-version: '3.11'

      - name: Install Scrapling
        run: |
          python3.11 -m pip install --upgrade pip
          python3.11 -m pip install "scrapling[fetchers,shell]"
          scrapling install

      - run: npm ci

      - name: Run BeForward collector
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
          SCRAPLING_PYTHON: python3.11
          BF_FORCE_SCRAPLING: '1'
        run: |
          npx tsx scripts/bf-collector-cli.ts \
            --maxPages=${{ github.event.inputs.max_pages || '5' }} \
            --concurrency=${{ github.event.inputs.concurrency || '2' }} \
            --rateLimitMs=${{ github.event.inputs.rate_limit_ms || '4000' }} \
            ${{ github.event.inputs.summary_only == 'true' && '--summaryOnly' || '' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}

      - name: Upload output artifact
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: beforward-collector-output
          path: var/beforward_porsche_collector/
          retention-days: 7
          if-no-files-found: ignore
```

**Key changes from the original:**
- `timeout-minutes`: 30 → 45 (scrapling is slower per-page due to browser launch)
- `max_pages` default: 10 → 5 (fewer pages to stay within timeout)
- `concurrency` default: 3 → 2 (fewer Chromium instances, safer on 2-core CI runner)
- Added: `actions/setup-python@v5` step with Python 3.11
- Added: `Install Scrapling` step (pip install + `scrapling install` for browser binaries)
- Added env vars: `SCRAPLING_PYTHON=python3.11`, `BF_FORCE_SCRAPLING=1`

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/beforward-collector.yml
git commit -m "feat(beforward): add scrapling to collector workflow for WAF bypass"
```

---

### Task 6: Smoke test — manual workflow dispatch

- [ ] **Step 1: Push changes and trigger the workflow manually**

```bash
git push origin main
gh workflow run beforward-collector.yml --field max_pages=2 --field dry_run=true
```

- [ ] **Step 2: Watch the run**

```bash
gh run watch
```

Expected: The run should complete successfully with scrapling fetching HTML through AWS WAF.

- [ ] **Step 3: If `_get_html_source()` returns empty HTML**

The Python script tries multiple approaches to extract HTML from the Scrapling Adaptor. If all fail (empty HTML error), debug by running locally:

```bash
python3.11 -c "
from scrapling.fetchers import StealthyFetcher
page = StealthyFetcher.fetch('https://www.beforward.jp/stocklist/sortkey=n/keyword=porsche/kmode=and/', headless=True, network_idle=True, timeout=30000)
print(type(page))
print(dir(page))
print('__text' in dir(page) or '_Adaptor__text' in [k for k in page.__dict__])
"
```

Then update `_get_html_source()` to use the correct attribute/method.

- [ ] **Step 4: If the run succeeds, re-run without dry_run**

```bash
gh workflow run beforward-collector.yml --field max_pages=3
```

Verify listings are written to Supabase.

---

## Performance Considerations

| Metric | Plain fetch (before) | Scrapling (after) |
|--------|---------------------|-------------------|
| Per-page fetch time | ~1-2s | ~25-35s (browser launch + render + WAF solve) |
| Concurrency | 3 | 2 (2 Chromium instances, ~400MB RAM + ~200MB Node) |
| Discovery (5 pages) | ~10s | ~3 min |
| Detail (125 listings, concurrency=2) | ~4 min | ~31 min |
| Total estimated | ~5 min | ~34 min |
| Workflow timeout | 30 min | 45 min |

**Tuning knobs if runs are too slow:**
- Reduce `max_pages` (fewer discovery pages — 3 instead of 5)
- Use `--summaryOnly` (skip detail fetch, use listing row data only)
- Increase `concurrency` to 3 if RAM allows (monitor via Actions logs)

**Future optimization:** Skip detail fetch for listings already in DB with complete data (check `sourceId` before fetching). This would dramatically reduce scrapling calls on subsequent runs.
