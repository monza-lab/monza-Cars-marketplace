# AutoScout24 Detail Enrichment + AutoTrader Header Hardening

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** (1) Enrich AutoScout24 listings with detail-page fields (trim, colors, bodyStyle, engine, VIN, description) via a Vercel cron that processes small batches. (2) Replace AutoTrader's hardcoded `x-sauron-app-version` header with dynamic version detection from page source.

**Architecture:** Both features follow the existing cron/scraper patterns. The AS24 enrichment adds a new cron route (`/api/cron/enrich-details`) that queries listings missing detail fields, fetches their detail pages with plain `fetch()` + `parseDetailHtml()` (cheerio, no Playwright needed), and updates Supabase. The AutoTrader hardening extracts the version into a `detectAppVersion()` function that pre-flights the search page, with fallback to the known value.

**Tech Stack:** Next.js API routes, Supabase, Vitest, cheerio (existing AS24 detail parser), `fetch()`.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/app/api/cron/enrich-details/route.ts` | Create | Cron route: enrich AS24 listings with detail-page data |
| `src/app/api/cron/enrich-details/route.test.ts` | Create | Tests for enrichment cron |
| `src/features/scrapers/common/monitoring/types.ts` | Modify | Add `enrich-details` to ScraperName union |
| `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx` | Modify | Add `enrich-details` label/runtime/cadence |
| `src/features/scrapers/autotrader_collector/discover.ts` | Modify:169-177 | Extract headers, add version detection |
| `src/features/scrapers/autotrader_collector/discover.test.ts` | Modify | Add version detection tests |
| `docs/scrapers/next-steps.md` | Modify | Mark items as fixed |

---

### Task 1: Create the AS24 detail enrichment cron route

This cron route queries AutoScout24 listings missing detail fields (trim, vin, etc.), fetches their detail pages with a simple HTTP fetch (no Playwright), parses with the existing `parseDetailHtml()`, and updates the DB.

**Files:**
- Create: `src/app/api/cron/enrich-details/route.ts`

- [ ] **Step 1: Write the cron route**

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDetailHtml } from "@/features/scrapers/autoscout24_collector/detail";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json(
      { success: false, error: "Missing Supabase env vars" },
      { status: 500 }
    );
  }

  await markScraperRunStarted({
    scraperName: "enrich-details",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Query AS24 active listings missing detail fields (trim IS NULL as proxy)
    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "AutoScout24")
      .eq("status", "active")
      .is("trim", null)
      .order("updated_at", { ascending: true })
      .limit(25);

    if (fetchErr || !rows) {
      throw new Error(fetchErr?.message ?? "No rows returned");
    }

    const discovered = rows.length;
    let enriched = 0;
    const errors: string[] = [];
    const DELAY_MS = 2_000;
    const TIME_BUDGET_MS = 270_000;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      // Time budget check
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

      // Rate limit
      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      try {
        const response = await fetch(row.source_url, {
          headers: FETCH_HEADERS,
          signal: AbortSignal.timeout(15_000),
        });

        if (!response.ok) {
          if (response.status === 404 || response.status === 410) {
            // Mark as delisted
            await client
              .from("listings")
              .update({ status: "delisted", updated_at: new Date().toISOString() })
              .eq("id", row.id);
            errors.push(`Dead URL (${row.id}): HTTP ${response.status}`);
            continue;
          }
          throw new Error(`HTTP ${response.status} for ${row.source_url}`);
        }

        const html = await response.text();
        const detail = parseDetailHtml(html);

        // Build update payload — only set non-null fields from detail
        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (detail.trim) update.trim = detail.trim;
        if (detail.transmission) update.transmission = detail.transmission;
        if (detail.bodyStyle) update.body_style = detail.bodyStyle;
        if (detail.engine) update.engine = detail.engine;
        if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
        if (detail.interiorColor) update.color_interior = detail.interiorColor;
        if (detail.vin) update.vin = detail.vin;
        if (detail.description) update.description_text = detail.description;
        if (detail.images && detail.images.length > 0) {
          update.images = detail.images;
          update.photos_count = detail.images.length;
        }

        // Only update if we got at least one new field
        const newFieldCount = Object.keys(update).length - 1; // minus updated_at
        if (newFieldCount > 0) {
          const { error: updateErr } = await client
            .from("listings")
            .update(update)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`Update failed (${row.id}): ${updateErr.message}`);
          } else {
            enriched++;
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        // Circuit-break on 403/429
        if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }

        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    await recordScraperRun({
      scraper_name: "enrich-details",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: enriched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });

    await clearScraperRunActive("enrich-details");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      enriched,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-details] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-details",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Enrichment failed"],
    });

    await clearScraperRunActive("enrich-details");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Enrichment failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/enrich-details/route.ts
git commit -m "feat(enrich-details): add AS24 detail enrichment cron route"
```

---

### Task 2: Register `enrich-details` in monitoring + dashboard

**Files:**
- Modify: `src/features/scrapers/common/monitoring/types.ts`
- Modify: `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`

- [ ] **Step 1: Add `enrich-details` to ScraperName union**

In `types.ts`, add `'enrich-details'` to the ScraperName union type.

- [ ] **Step 2: Add dashboard entries**

In `ScrapersDashboardClient.tsx`, add to all three Record objects and the display array:

```typescript
// SCRAPER_LABELS
"enrich-details": "AS24 Detail Enrichment",

// SCRAPER_RUNTIME
"enrich-details": "vercel_cron",

// SCRAPER_CADENCE_MS
"enrich-details": 24 * 60 * 60 * 1000, // daily
```

Also add `"enrich-details"` to the `ALL_SCRAPERS` array.

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/common/monitoring/types.ts src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx
git commit -m "feat(monitoring): register enrich-details scraper in monitoring + dashboard"
```

---

### Task 3: Write tests for the enrichment cron

**Files:**
- Create: `src/app/api/cron/enrich-details/route.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

// Mock Supabase
const mockUpdate = vi.fn().mockReturnValue({
  eq: vi.fn().mockResolvedValue({ error: null }),
});
const mockSelect = vi.fn().mockReturnValue({
  eq: vi.fn().mockReturnValue({
    eq: vi.fn().mockReturnValue({
      is: vi.fn().mockReturnValue({
        order: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
    }),
  }),
});

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: mockSelect,
      update: mockUpdate,
    })),
  })),
}));

// Mock detail parser
vi.mock("@/features/scrapers/autoscout24_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));

// Mock monitoring
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { parseDetailHtml } from "@/features/scrapers/autoscout24_collector/detail";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-details", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-details", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const response = await GET(makeRequest("wrong"));
    expect(response.status).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
  });

  it("returns 200 with empty results when no listings need enrichment", async () => {
    const response = await GET(makeRequest());
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.discovered).toBe(0);
    expect(data.enriched).toBe(0);
  });

  it("calls monitoring lifecycle functions", async () => {
    await GET(makeRequest());

    expect(markScraperRunStarted).toHaveBeenCalledWith(
      expect.objectContaining({
        scraperName: "enrich-details",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-details",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-details");
  });

  it("returns 500 when Supabase env vars missing", async () => {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;

    const response = await GET(makeRequest());
    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toContain("Supabase");
  });

  it("includes duration in response", async () => {
    const response = await GET(makeRequest());
    const data = await response.json();
    expect(data.duration).toMatch(/^\d+ms$/);
  });
});
```

- [ ] **Step 2: Run tests**

Run: `npx vitest run src/app/api/cron/enrich-details/route.test.ts --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/enrich-details/route.test.ts
git commit -m "test(enrich-details): add cron route tests"
```

---

### Task 4: Add dynamic version detection to AutoTrader discover

Replace the hardcoded `x-sauron-app-version: "6c9dff0561"` with a function that:
1. Fetches the AutoTrader search page HTML
2. Searches for build hashes in `<script>` tags (webpack chunk filenames like `app.{HASH}.js`)
3. Falls back to the hardcoded value if detection fails
4. Caches the result for the duration of the process (no need to re-detect per request)

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/discover.ts:169-177`

- [ ] **Step 1: Add the version detection function**

Add before `fetchAutoTraderGatewayPage()` (around line 120):

```typescript
// ─── Dynamic version detection ───

const FALLBACK_APP_VERSION = "6c9dff0561";
let _cachedAppVersion: string | null = null;

/**
 * Detects the current AutoTrader app version by parsing the search page HTML
 * for webpack chunk filenames or build metadata. Falls back to the hardcoded
 * version if detection fails.
 *
 * The result is cached for the lifetime of the process.
 */
export async function detectAppVersion(): Promise<string> {
  if (_cachedAppVersion) return _cachedAppVersion;

  try {
    const res = await fetch("https://www.autotrader.co.uk/car-search?postcode=SW1A+1AA&make=Porsche", {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      console.warn(`[AutoTrader] Version detection HTTP ${res.status}, using fallback`);
      _cachedAppVersion = FALLBACK_APP_VERSION;
      return _cachedAppVersion;
    }

    const html = await res.text();

    // Strategy 1: Look for sauron-app-version in inline scripts or meta tags
    const metaMatch = html.match(/sauron-app-version["']\s*[:,]\s*["']([a-f0-9]{8,12})["']/i);
    if (metaMatch) {
      _cachedAppVersion = metaMatch[1];
      console.log(`[AutoTrader] Detected app version (meta): ${_cachedAppVersion}`);
      return _cachedAppVersion;
    }

    // Strategy 2: Look for buildId or appVersion in __NEXT_DATA__ or similar JSON
    const jsonMatch = html.match(/"(?:buildId|appVersion|version)"\s*:\s*"([a-f0-9]{8,12})"/i);
    if (jsonMatch) {
      _cachedAppVersion = jsonMatch[1];
      console.log(`[AutoTrader] Detected app version (json): ${_cachedAppVersion}`);
      return _cachedAppVersion;
    }

    // Strategy 3: Look for webpack chunk patterns like _app-6c9dff0561.js
    const chunkMatch = html.match(/_app-([a-f0-9]{8,12})\./i);
    if (chunkMatch) {
      _cachedAppVersion = chunkMatch[1];
      console.log(`[AutoTrader] Detected app version (chunk): ${_cachedAppVersion}`);
      return _cachedAppVersion;
    }

    console.warn("[AutoTrader] Could not detect app version, using fallback");
    _cachedAppVersion = FALLBACK_APP_VERSION;
    return _cachedAppVersion;
  } catch (err) {
    console.warn("[AutoTrader] Version detection failed:", err instanceof Error ? err.message : err);
    _cachedAppVersion = FALLBACK_APP_VERSION;
    return _cachedAppVersion;
  }
}

/** Reset cached version (for testing or forced refresh) */
export function resetCachedAppVersion(): void {
  _cachedAppVersion = null;
}
```

- [ ] **Step 2: Update `fetchAutoTraderGatewayPage` to use dynamic version**

Change the function signature to be async (it already is) and replace the hardcoded header. At line 169-177, change from:

```typescript
  const res = await fetch("https://www.autotrader.co.uk/at-gateway?opname=SearchResultsListingsGridQuery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sauron-app-name": "sauron-search-results-app",
      "x-sauron-app-version": "6c9dff0561",
      Origin: "https://www.autotrader.co.uk",
      Referer: refererUrl,
      Accept: "*/*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
```

To:

```typescript
  const appVersion = await detectAppVersion();
  const res = await fetch("https://www.autotrader.co.uk/at-gateway?opname=SearchResultsListingsGridQuery", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-sauron-app-name": "sauron-search-results-app",
      "x-sauron-app-version": appVersion,
      Origin: "https://www.autotrader.co.uk",
      Referer: refererUrl,
      Accept: "*/*",
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
```

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/autotrader_collector/discover.ts
git commit -m "feat(autotrader): replace hardcoded app-version with dynamic detection + fallback"
```

---

### Task 5: Add tests for AutoTrader version detection

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/discover.test.ts`

- [ ] **Step 1: Add version detection tests**

Append to the existing test file:

```typescript
import { detectAppVersion, resetCachedAppVersion } from "./discover";

describe("detectAppVersion", () => {
  beforeEach(() => {
    resetCachedAppVersion();
    vi.restoreAllMocks();
  });

  it("returns fallback version when fetch fails", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValueOnce(new Error("Network error"));
    const version = await detectAppVersion();
    expect(version).toBe("6c9dff0561");
  });

  it("returns fallback version when page returns non-200", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("Forbidden", { status: 403 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("6c9dff0561");
  });

  it("detects version from webpack chunk pattern", async () => {
    const html = `<html><head><script src="/_next/static/chunks/_app-abc1234def.js"></script></head></html>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("abc1234def");
  });

  it("detects version from JSON metadata", async () => {
    const html = `<html><script>{"buildId":"ff00112233"}</script></html>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("ff00112233");
  });

  it("caches the result across calls", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(`<script src="/_app-aabbccddee.js"></script>`, { status: 200 })
    );
    const v1 = await detectAppVersion();
    const v2 = await detectAppVersion();
    expect(v1).toBe("aabbccddee");
    expect(v2).toBe("aabbccddee");
    expect(fetchSpy).toHaveBeenCalledTimes(1); // Only fetched once
  });

  it("returns fallback when no patterns match", async () => {
    const html = `<html><body><h1>AutoTrader</h1></body></html>`;
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(html, { status: 200 })
    );
    const version = await detectAppVersion();
    expect(version).toBe("6c9dff0561");
  });
});
```

- [ ] **Step 2: Run all AutoTrader tests**

Run: `npx vitest run src/features/scrapers/autotrader_collector/discover.test.ts --reporter=verbose`
Expected: ALL PASS (existing + new tests)

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/autotrader_collector/discover.test.ts
git commit -m "test(autotrader): add version detection tests with mocked fetch"
```

---

### Task 6: Run all tests and update docs

**Files:**
- All test files
- `docs/scrapers/next-steps.md`

- [ ] **Step 1: Run all cron tests**

Run: `npx vitest run src/app/api/cron/ --reporter=verbose`
Expected: ALL PASS across all 7 cron route test files (including new enrich-details)

- [ ] **Step 2: Run AutoTrader tests**

Run: `npx vitest run src/features/scrapers/autotrader_collector/ --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 3: Update next-steps.md**

Mark items 8 (AutoScout24 detail scraping) and 9 (AutoTrader headers) as FIXED.

- [ ] **Step 4: Commit**

```bash
git add docs/scrapers/next-steps.md
git commit -m "docs(scrapers): mark AS24 detail enrichment and AutoTrader hardening as fixed"
```

---

## Summary

| Task | What it does | Effort |
|------|-------------|--------|
| 1. Enrich-details cron | New `/api/cron/enrich-details` route — processes 25 AS24 listings/run | 15 min |
| 2. Register in monitoring | Add `enrich-details` to ScraperName + dashboard | 5 min |
| 3. Enrich-details tests | Auth, empty results, monitoring calls, env vars | 10 min |
| 4. AutoTrader version detection | `detectAppVersion()` with 3 strategies + fallback + cache | 15 min |
| 5. Version detection tests | Fetch mocking, cache behavior, pattern matching | 10 min |
| 6. Full verification + docs | Run all tests, update docs | 5 min |
