# 100% Data Quality Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Achieve >90% field completeness across all 5 scraper sources by building source-specific enrichment crons, scaling AS24 throughput 10x, and hardening title parsing.

**Architecture:** Independent enrichment cron per source, each following the proven `enrich-details` pattern (auth → query unenriched → fetch detail → parse → update DB → record monitoring). No shared dispatch layer.

**Tech Stack:** Next.js API routes, Supabase (PostgREST), Cheerio (HTML parsing), Vitest (testing), GitHub Actions (bulk enrichment)

**Spec:** `docs/superpowers/specs/2026-03-21-data-quality-100pct-design.md`

---

## File Structure

### New Files
| File | Responsibility |
|------|---------------|
| `src/app/api/cron/enrich-autotrader/route.ts` | AutoTrader enrichment cron |
| `src/app/api/cron/enrich-autotrader/route.test.ts` | Tests for AutoTrader enrichment |
| `src/app/api/cron/enrich-beforward/route.ts` | BeForward enrichment cron |
| `src/app/api/cron/enrich-beforward/route.test.ts` | Tests for BeForward enrichment |
| `src/features/scrapers/autotrader_collector/detail.ts` | Exported detail scraper (extracted from collector.ts) |
| `src/features/scrapers/autotrader_collector/detail.test.ts` | Tests for AutoTrader detail parser |
| `src/app/api/admin/scrapers/field-completeness/route.ts` | Field completeness API endpoint |
| `.github/workflows/autoscout24-enrich.yml` | Bulk AS24 enrichment via GH Actions |

### Modified Files
| File | Change |
|------|--------|
| `src/features/scrapers/common/monitoring/types.ts` | Add new ScraperName values |
| `src/app/api/cron/enrich-details/route.ts` | Scale 25→100, add "attempted" marker |
| `src/app/api/cron/enrich-details/route.test.ts` | Update test for new limit |
| `src/features/scrapers/autotrader_collector/collector.ts` | No change (future cleanup) |
| `src/features/scrapers/common/titleEnrichment.ts` | Context guards + word boundaries |
| `src/features/scrapers/common/titleEnrichment.test.ts` | 200+ test cases |
| `vercel.json` | Add new cron schedules |
| `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx` | Add field completeness heatmap |

---

### Task 1: Register New Scraper Names in Monitoring

**Files:**
- Modify: `src/features/scrapers/common/monitoring/types.ts`
- Modify: `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`

- [ ] **Step 1: Add new ScraperName values**

In `src/features/scrapers/common/monitoring/types.ts`, line 1, update the `ScraperName` type:

```typescript
export type ScraperName = 'porsche' | 'ferrari' | 'autotrader' | 'beforward' | 'classic' | 'autoscout24' | 'backfill-images' | 'enrich-vin' | 'enrich-titles' | 'enrich-details' | 'enrich-autotrader' | 'enrich-beforward' | 'enrich-details-bulk' | 'bat-detail' | 'validate' | 'cleanup';
```

- [ ] **Step 2: Update dashboard scraper list**

In `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`, add the new scrapers to `ALL_SCRAPERS` array (after `"enrich-details"`) and `SCRAPER_LABELS` object:

```typescript
// In ALL_SCRAPERS array, add after "enrich-details":
"enrich-autotrader",
"enrich-beforward",
"enrich-details-bulk",

// In SCRAPER_LABELS object, add:
"enrich-autotrader": "AutoTrader Enrichment",
"enrich-beforward": "BeForward Enrichment",
"enrich-details-bulk": "AS24 Bulk Enrichment",

// In SCRAPER_RUNTIME object, add:
"enrich-autotrader": "Vercel Cron",
"enrich-beforward": "Vercel Cron",
"enrich-details-bulk": "GitHub Actions",

// In SCRAPER_CADENCE_MS object, add:
"enrich-autotrader": 24 * 60 * 60 * 1000,
"enrich-beforward": 24 * 60 * 60 * 1000,
"enrich-details-bulk": 24 * 60 * 60 * 1000,
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors from the type changes.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/common/monitoring/types.ts src/app/\[locale\]/admin/scrapers/ScrapersDashboardClient.tsx
git commit -m "feat(monitoring): register new enrichment scrapers in type system and dashboard"
```

---

### Task 2: Scale AS24 Enrichment (25→100) + Attempted Marker

**Files:**
- Modify: `src/app/api/cron/enrich-details/route.ts`
- Modify: `src/app/api/cron/enrich-details/route.test.ts`

- [ ] **Step 1: Write test for attempted marker behavior**

Add to `src/app/api/cron/enrich-details/route.test.ts`:

```typescript
it("marks listing as attempted when no fields extracted", async () => {
  // Mock returning a listing
  mockSelect.mockReturnValueOnce({
    eq: vi.fn().mockReturnValue({
      eq: vi.fn().mockReturnValue({
        is: vi.fn().mockReturnValue({
          order: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue({
              data: [{ id: "test-id", source_url: "https://www.autoscout24.com/offers/test" }],
              error: null,
            }),
          }),
        }),
      }),
    }),
  });

  // Mock fetch returning valid HTML
  global.fetch = vi.fn().mockResolvedValue({
    ok: true,
    text: vi.fn().mockResolvedValue("<html><body>empty page</body></html>"),
  }) as unknown as typeof fetch;

  // Mock parseDetailHtml returning no useful fields
  const { parseDetailHtml } = await import("@/features/scrapers/autoscout24_collector/detail");
  vi.mocked(parseDetailHtml).mockReturnValue({
    title: "", price: null, currency: null, year: null, make: null, model: null,
    trim: null, mileageKm: null, transmission: null, fuelType: null, engine: null,
    power: null, bodyStyle: null, exteriorColor: null, interiorColor: null,
    vin: null, location: null, country: null, region: null, sellerType: null,
    sellerName: null, description: null, images: [], firstRegistration: null, features: [],
  });

  const response = await GET(makeRequest());
  const data = await response.json();
  expect(data.success).toBe(true);

  // Should have called update with trim = '' even though no fields extracted
  expect(mockUpdate).toHaveBeenCalled();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/enrich-details/route.test.ts --reporter=verbose`
Expected: New test FAILS (current code skips update when no fields extracted).

- [ ] **Step 3: Update route with new limits and attempted marker**

In `src/app/api/cron/enrich-details/route.ts`:

Change line 64 (`.limit(25)`) to:
```typescript
      .limit(100);
```

Change line 73 (`DELAY_MS = 2_000`) to:
```typescript
    const DELAY_MS = 1_000;
```

Replace lines 130-143 (the update block) with:
```typescript
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
        } else {
          // Mark as "attempted" — set trim to empty string to prevent re-processing
          const { error: markerErr } = await client
            .from("listings")
            .update({ trim: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          if (markerErr) {
            errors.push(`Marker failed (${row.id}): ${markerErr.message}`);
          }
        }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/enrich-details/route.test.ts --reporter=verbose`
Expected: ALL tests pass, including the new "attempted marker" test.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/cron/enrich-details/route.ts src/app/api/cron/enrich-details/route.test.ts
git commit -m "feat(enrich-details): scale 25→100 listings/run, add attempted marker for empty results"
```

---

### Task 3: Extract AutoTrader Detail Scraper to Shared Module

**Files:**
- Create: `src/features/scrapers/autotrader_collector/detail.ts`
- Modify: `src/features/scrapers/autotrader_collector/collector.ts`

- [ ] **Step 1: Create detail.ts with exported scraper function**

Create `src/features/scrapers/autotrader_collector/detail.ts`:

```typescript
import * as cheerio from "cheerio";
import { fetchHtml } from "./net";

export interface AutoTraderDetailParsed {
  title: string | null;
  price: number | null;
  priceText: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  description: string | null;
  images: string[];
  vin: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  transmission: string | null;
  engine: string | null;
  bodyStyle: string | null;
}

/**
 * Fetch an AutoTrader listing detail page and extract structured data via Cheerio.
 * Returns all-null fields on any error (does not throw).
 */
export async function fetchAutoTraderDetail(
  url: string,
  timeoutMs = 15_000
): Promise<AutoTraderDetailParsed> {
  const empty: AutoTraderDetailParsed = {
    title: null, price: null, priceText: null, mileage: null, mileageUnit: null,
    location: null, description: null, images: [], vin: null, exteriorColor: null,
    interiorColor: null, transmission: null, engine: null, bodyStyle: null,
  };

  try {
    const html = await fetchHtml(url, timeoutMs);
    return parseAutoTraderHtml(html);
  } catch {
    return empty;
  }
}

/** Parse AutoTrader HTML into structured fields. Exported for testing. */
export function parseAutoTraderHtml(html: string): AutoTraderDetailParsed {
  const $ = cheerio.load(html);

  const title = $("h1").first().text().trim()
    || $('[data-testid="vehicle-title"]').first().text().trim()
    || null;

  const priceText = $('[data-testid="price"]').first().text().trim()
    || $(".price").first().text().trim()
    || $('[class*="price"]').first().text().trim()
    || null;
  const price = priceText ? parsePrice(priceText) : null;

  const mileageText = $('[data-testid="mileage"]').first().text().trim()
    || $('[class*="mileage"]').first().text().trim()
    || null;
  const mileage = mileageText ? parseMileage(mileageText) : null;
  const mileageUnit = mileageText?.toLowerCase().includes("km") ? "km" : "miles";

  const location = $('[data-testid="location"]').first().text().trim()
    || $('[class*="location"]').first().text().trim()
    || null;

  const description = $('[data-testid="description"]').first().text().trim()
    || $('[class*="description"]').first().text().trim()
    || null;

  const transmission = $('[data-testid="transmission"]').first().text().trim()
    || $('[class*="transmission"]').first().text().trim()
    || null;

  const engine = $('[data-testid="engine"]').first().text().trim()
    || $('[class*="engine"]').first().text().trim()
    || null;

  const exteriorColor = $('[data-testid="exterior-color"]').first().text().trim()
    || $('[class*="exterior"]').first().text().trim()
    || null;

  // VIN: search full body text for 17-char ISO VIN pattern
  const bodyText = $("body").text();
  const vinMatch = bodyText.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
  const vin = vinMatch ? vinMatch[0].toUpperCase() : null;

  // Images: collect up to 20 image URLs
  const images: string[] = [];
  $("img").each((_, el) => {
    if (images.length >= 20) return false;
    const src = $(el).attr("src") || $(el).attr("data-src");
    if (src && src.includes("autotrader")) {
      images.push(src);
    }
  });

  return {
    title: title || null,
    price,
    priceText: priceText || null,
    mileage,
    mileageUnit: mileage ? mileageUnit : null,
    location: location || null,
    description: description || null,
    images,
    vin,
    exteriorColor: exteriorColor || null,
    interiorColor: null, // Not available on AutoTrader pages
    transmission: transmission || null,
    engine: engine || null,
    bodyStyle: null, // Not available on AutoTrader pages
  };
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? null : num;
}

function parseMileage(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}
```

- [ ] **Step 2: Write tests for parseAutoTraderHtml**

Create `src/features/scrapers/autotrader_collector/detail.test.ts`:

```typescript
import { describe, it, expect, vi } from "vitest";
import { parseAutoTraderHtml } from "./detail";

describe("parseAutoTraderHtml", () => {
  it("returns all-null for empty HTML", () => {
    const result = parseAutoTraderHtml("<html><body></body></html>");
    expect(result.title).toBeNull();
    expect(result.price).toBeNull();
    expect(result.engine).toBeNull();
    expect(result.vin).toBeNull();
  });

  it("extracts title from h1", () => {
    const html = '<html><body><h1>2023 Porsche 911 GT3</h1></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.title).toBe("2023 Porsche 911 GT3");
  });

  it("extracts price from data-testid", () => {
    const html = '<html><body><span data-testid="price">£85,000</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.price).toBe(85000);
  });

  it("extracts mileage and detects unit", () => {
    const html = '<html><body><span data-testid="mileage">12,500 miles</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.mileage).toBe(12500);
    expect(result.mileageUnit).toBe("miles");
  });

  it("extracts VIN from body text using word boundary", () => {
    const html = '<html><body><p>VIN: WP0ZZZ99ZTS392145</p></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.vin).toBe("WP0ZZZ99ZTS392145");
  });

  it("does not extract VIN from short strings", () => {
    const html = '<html><body><p>Reference: ABC123</p></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.vin).toBeNull();
  });

  it("extracts engine from data-testid", () => {
    const html = '<html><body><span data-testid="engine">3.0L</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.engine).toBe("3.0L");
  });

  it("extracts transmission from class selector", () => {
    const html = '<html><body><span class="spec-transmission">Automatic</span></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.transmission).toBe("Automatic");
  });

  it("always returns null for bodyStyle and interiorColor", () => {
    const html = '<html><body><h1>Test</h1></body></html>';
    const result = parseAutoTraderHtml(html);
    expect(result.bodyStyle).toBeNull();
    expect(result.interiorColor).toBeNull();
  });
});
```

- [ ] **Step 3: Run tests**

Run: `npx vitest run src/features/scrapers/autotrader_collector/detail.test.ts --reporter=verbose`
Expected: ALL tests PASS.

- [ ] **Step 4: Leave collector.ts as-is**

The existing `fetchAutoTraderData()` and `ScrapedAutoTraderData` in `collector.ts` remain untouched. The new `detail.ts` is a standalone module for the enrichment cron — it does NOT replace the collector's internal logic. This avoids risky refactoring of the 800-line collector. The enrichment cron (Task 4) imports from `detail.ts` directly.

Future cleanup: Once the enrichment cron is proven, `collector.ts` can be updated to use `detail.ts` internally. This is out of scope for this plan.

- [ ] **Step 5: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/autotrader_collector/detail.ts src/features/scrapers/autotrader_collector/detail.test.ts
git commit -m "feat(autotrader): add exported detail parser with fixed VIN selector and tests"
```

---

### Task 4: AutoTrader Enrichment Cron

**Files:**
- Create: `src/app/api/cron/enrich-autotrader/route.ts`
- Create: `src/app/api/cron/enrich-autotrader/route.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write tests first**

Create `src/app/api/cron/enrich-autotrader/route.test.ts`:

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
vi.mock("@/features/scrapers/autotrader_collector/detail", () => ({
  fetchAutoTraderDetail: vi.fn(),
}));

// Mock monitoring
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-autotrader", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-autotrader", () => {
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
        scraperName: "enrich-autotrader",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-autotrader",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-autotrader");
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/enrich-autotrader/route.test.ts --reporter=verbose`
Expected: FAIL — route module does not exist yet.

- [ ] **Step 3: Create the enrichment route**

Create `src/app/api/cron/enrich-autotrader/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchAutoTraderDetail } from "@/features/scrapers/autotrader_collector/detail";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
    scraperName: "enrich-autotrader",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "AutoTrader")
      .eq("status", "active")
      .is("engine", null)
      .order("updated_at", { ascending: true })
      .limit(100);

    if (fetchErr || !rows) {
      throw new Error(fetchErr?.message ?? "No rows returned");
    }

    const discovered = rows.length;
    let enriched = 0;
    const errors: string[] = [];
    const DELAY_MS = 1_000;
    const TIME_BUDGET_MS = 270_000;
    let consecutiveFailures = 0;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

      if (consecutiveFailures >= 5) {
        errors.push(`Circuit-break: ${consecutiveFailures} consecutive failures`);
        break;
      }

      if (i > 0) {
        await new Promise((r) => setTimeout(r, DELAY_MS));
      }

      try {
        const detail = await fetchAutoTraderDetail(row.source_url);

        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (detail.engine) update.engine = detail.engine;
        if (detail.transmission) update.transmission = detail.transmission;
        if (detail.mileage != null) {
          // Convert miles to km for consistency
          update.mileage_km = detail.mileageUnit === "km"
            ? detail.mileage
            : Math.round(detail.mileage * 1.609344);
        }
        if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
        if (detail.vin) update.vin = detail.vin;
        if (detail.description) update.description_text = detail.description;

        const newFieldCount = Object.keys(update).length - 1;
        if (newFieldCount > 0) {
          const { error: updateErr } = await client
            .from("listings")
            .update(update)
            .eq("id", row.id);

          if (updateErr) {
            errors.push(`Update failed (${row.id}): ${updateErr.message}`);
            consecutiveFailures++;
          } else {
            enriched++;
            consecutiveFailures = 0;
          }
        } else {
          // Mark as attempted
          await client
            .from("listings")
            .update({ engine: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          consecutiveFailures = 0;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        consecutiveFailures++;

        if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }

        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    await recordScraperRun({
      scraper_name: "enrich-autotrader",
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

    await clearScraperRunActive("enrich-autotrader");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      enriched,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-autotrader] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-autotrader",
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

    await clearScraperRunActive("enrich-autotrader");

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/cron/enrich-autotrader/route.test.ts --reporter=verbose`
Expected: ALL 5 tests PASS.

- [ ] **Step 5: Add to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{ "path": "/api/cron/enrich-autotrader", "schedule": "45 7 * * *" }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/enrich-autotrader/ vercel.json
git commit -m "feat(enrich-autotrader): new cron route for AutoTrader detail enrichment (100/run)"
```

---

### Task 5: BeForward Enrichment Cron

**Files:**
- Create: `src/app/api/cron/enrich-beforward/route.ts`
- Create: `src/app/api/cron/enrich-beforward/route.test.ts`
- Modify: `vercel.json`

- [ ] **Step 1: Write tests first**

Create `src/app/api/cron/enrich-beforward/route.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

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

vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring";

function makeRequest(secret = "test-secret") {
  return new Request("http://localhost:3000/api/cron/enrich-beforward", {
    method: "GET",
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/enrich-beforward", () => {
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
        scraperName: "enrich-beforward",
        runtime: "vercel_cron",
      })
    );
    expect(recordScraperRun).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "enrich-beforward",
        success: true,
      })
    );
    expect(clearScraperRunActive).toHaveBeenCalledWith("enrich-beforward");
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

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/enrich-beforward/route.test.ts --reporter=verbose`
Expected: FAIL — route module does not exist yet.

- [ ] **Step 3: Create the enrichment route**

Create `src/app/api/cron/enrich-beforward/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { parseDetailHtml } from "@/features/scrapers/beforward_porsche_collector/detail";
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
    scraperName: "enrich-beforward",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const client = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: rows, error: fetchErr } = await client
      .from("listings")
      .select("id,source_url")
      .eq("source", "BeForward")
      .eq("status", "active")
      .is("trim", null)
      .order("updated_at", { ascending: true })
      .limit(50);

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

      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${enriched} enrichments`);
        break;
      }

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

        const update: Record<string, unknown> = {
          updated_at: new Date().toISOString(),
        };

        if (detail.trim) update.trim = detail.trim;
        if (detail.engine) update.engine = detail.engine;
        if (detail.transmission) update.transmission = detail.transmission;
        if (detail.exteriorColor) update.color_exterior = detail.exteriorColor;
        if (detail.vin) update.vin = detail.vin;
        if (detail.fuel) update.fuel_type = detail.fuel;

        const newFieldCount = Object.keys(update).length - 1;
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
        } else {
          // Mark as attempted
          await client
            .from("listings")
            .update({ trim: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }

        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    await recordScraperRun({
      scraper_name: "enrich-beforward",
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

    await clearScraperRunActive("enrich-beforward");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      enriched,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/enrich-beforward] Error:", error);

    await recordScraperRun({
      scraper_name: "enrich-beforward",
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

    await clearScraperRunActive("enrich-beforward");

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

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/app/api/cron/enrich-beforward/route.test.ts --reporter=verbose`
Expected: ALL 5 tests PASS.

- [ ] **Step 5: Add to vercel.json**

Add to the `crons` array in `vercel.json`:

```json
{ "path": "/api/cron/enrich-beforward", "schedule": "0 8 * * *" }
```

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/enrich-beforward/ vercel.json
git commit -m "feat(enrich-beforward): new cron route for BeForward detail enrichment (50/run)"
```

---

### Task 6: Title Parsing Hardening

**Files:**
- Modify: `src/features/scrapers/common/titleEnrichment.ts`
- Modify: `src/features/scrapers/common/titleEnrichment.test.ts`

- [ ] **Step 1: Add context guard tests (negative cases)**

Add to `src/features/scrapers/common/titleEnrichment.test.ts`, new test cases for false positive rejection:

```typescript
// In parseEngineFromText describe block, add:
it("rejects engine-like text in non-engine context", () => {
  expect(parseEngineFromText("fuel capacity 3.8 liters")).toBeNull();
  expect(parseEngineFromText("3.0L fuel tank capacity")).toBeNull();
  expect(parseEngineFromText("12,500 miles driven")).toBeNull();
});

// In parseTransmissionFromText describe block, add:
it("rejects transmission-like text in non-transmission context", () => {
  expect(parseTransmissionFromText("Manual steering wheel")).toBeNull();
  expect(parseTransmissionFromText("Automatic window controls")).toBeNull();
});

// In parseBodyStyleFromText describe block, add:
it("rejects body style in non-body context", () => {
  expect(parseBodyStyleFromText("Coupe paint color")).toBeNull();
  expect(parseBodyStyleFromText("sedan finish quality")).toBeNull();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/scrapers/common/titleEnrichment.test.ts --reporter=verbose`
Expected: New negative cases should FAIL (current parsers match these incorrectly).

Note: Some may already pass if the parsers happen to reject them. Check which fail and focus on those.

- [ ] **Step 3: Add context guards to parsers**

In `src/features/scrapers/common/titleEnrichment.ts`:

Add negative-context check helper at the top of the file:

```typescript
/** Returns true if the match is preceded by a negative-context word */
function hasNegativeContext(text: string, matchIndex: number, negWords: string[]): boolean {
  const before = text.slice(Math.max(0, matchIndex - 30), matchIndex).toLowerCase();
  return negWords.some((w) => before.includes(w));
}
```

In `parseEngineFromText()`, after each regex match, add context check:

```typescript
// After finding a match, before returning:
if (match && hasNegativeContext(text, match.index!, ["fuel", "capacity", "tank", "gallon"])) {
  return null;
}
```

In `parseTransmissionFromText()`, the function already has a negative check for "Manual steering" etc. Verify it covers "Automatic window" patterns.

In `parseBodyStyleFromText()`, add context guard:

```typescript
if (match && hasNegativeContext(text, match.index!, ["color", "paint", "finish", "colour"])) {
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/common/titleEnrichment.test.ts --reporter=verbose`
Expected: ALL tests PASS including new negative cases.

- [ ] **Step 5: Add extended test suite with real listing titles**

Add more test cases to `titleEnrichment.test.ts`. Include titles from each source format:

```typescript
describe("real-world title parsing", () => {
  // BaT titles
  const batCases = [
    { input: "2019 Porsche 911 GT3 RS", expected: { engine: null, transmission: null, bodyStyle: null, trim: "GT3 RS" } },
    { input: "1973 Porsche 911 Carrera RS 2.7 Touring", expected: { engine: null, transmission: null, bodyStyle: null, trim: "Carrera" } },
    { input: "2022 Porsche 718 Cayman GT4 RS 6-Speed", expected: { engine: null, transmission: "6-Speed", bodyStyle: null, trim: "GT4 RS" } },
    { input: "2024 Porsche 911 Turbo S Cabriolet", expected: { engine: null, transmission: null, bodyStyle: "Cabriolet", trim: "Turbo S" } },
    { input: "1989 Porsche 911 Carrera 4 Targa G50 5-Speed", expected: { engine: null, transmission: "5-Speed", bodyStyle: "Targa", trim: "Carrera 4" } },
    { input: "No Reserve: 2015 Porsche Macan S", expected: { engine: null, transmission: null, bodyStyle: null, trim: null } },
    { input: "2023 Porsche 911 Carrera GTS 7-Speed Manual", expected: { engine: null, transmission: "7-Speed Manual", bodyStyle: null, trim: "Carrera GTS" } },
  ];

  // AS24 titles (European format)
  const as24Cases = [
    { input: "Porsche 911 992 Carrera 4S Coupe PDK", expected: { transmission: "PDK", bodyStyle: "Coupe", trim: "Carrera 4S" } },
    { input: "Porsche 718 Boxster GTS 4.0", expected: { engine: null, transmission: null, bodyStyle: null, trim: "GTS" } },
    { input: "Porsche Cayenne E-Hybrid Coupe", expected: { bodyStyle: "Coupe", trim: null } },
    { input: "Porsche 911 3.0 Turbo", expected: { engine: "3.0L Turbo", trim: "Turbo" } },
  ];

  // AutoTrader UK titles
  const autotraderCases = [
    { input: "Porsche 911 3.0 992 Carrera S PDK Euro 6 (s/s) 2dr", expected: { engine: "3.0L", transmission: "PDK", trim: "Carrera S" } },
    { input: "Porsche Cayenne 4.0 V8 Turbo GT Tiptronic 4WD", expected: { engine: "4.0L V8 Turbo", transmission: "Tiptronic", trim: "Turbo" } },
    { input: "Porsche 718 2.0 Cayman T PDK 2dr", expected: { transmission: "PDK", trim: null } },
  ];

  // BeForward titles
  const beforwardCases = [
    { input: "PORSCHE 911 CARRERA 4 GTS", expected: { trim: "Carrera 4 GTS" } },
    { input: "PORSCHE CAYENNE", expected: { trim: null } },
    { input: "PORSCHE 718 CAYMAN", expected: { trim: null } },
  ];

  for (const { input, expected } of [...batCases, ...as24Cases, ...autotraderCases, ...beforwardCases]) {
    it(`parses: "${input.slice(0, 60)}..."`, () => {
      if ("engine" in expected && expected.engine !== undefined) {
        expect(parseEngineFromText(input)).toBe(expected.engine);
      }
      if ("transmission" in expected && expected.transmission !== undefined) {
        expect(parseTransmissionFromText(input)).toBe(expected.transmission);
      }
      if ("bodyStyle" in expected && expected.bodyStyle !== undefined) {
        expect(parseBodyStyleFromText(input)).toBe(expected.bodyStyle);
      }
      if ("trim" in expected && expected.trim !== undefined) {
        expect(parseTrimFromText(input)).toBe(expected.trim);
      }
    });
  }
});
```

- [ ] **Step 6: Run full test suite**

Run: `npx vitest run src/features/scrapers/common/titleEnrichment.test.ts --reporter=verbose`
Expected: ALL tests PASS. Fix any failing regex patterns.

- [ ] **Step 7: Commit**

```bash
git add src/features/scrapers/common/titleEnrichment.ts src/features/scrapers/common/titleEnrichment.test.ts
git commit -m "feat(title-parsing): add context guards, word boundaries, and extended test suite"
```

---

### Task 7: AS24 Bulk Enrichment GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/autoscout24-enrich.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/autoscout24-enrich.yml`:

```yaml
name: AutoScout24 Bulk Enrichment (Daily)

on:
  schedule:
    - cron: '30 6 * * *'     # 06:30 UTC daily (after AS24 collector at 05:00)
  workflow_dispatch:
    inputs:
      max_listings:
        description: 'Max listings to enrich'
        default: '500'
      delay_ms:
        description: 'Delay between requests (ms)'
        default: '1000'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'

concurrency:
  group: autoscout24-enrich
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

      - run: npm ci

      - name: Run bulk enrichment
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          npx tsx scripts/enrich-as24-bulk.ts \
            --maxListings=${{ github.event.inputs.max_listings || '500' }} \
            --delayMs=${{ github.event.inputs.delay_ms || '1000' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

- [ ] **Step 2: Create the CLI script**

Create `scripts/enrich-as24-bulk.ts`:

```typescript
/**
 * Bulk AS24 enrichment script — runs under GitHub Actions with 30-minute budget.
 * Reuses parseDetailHtml from the AS24 collector.
 */
import { createClient } from "@supabase/supabase-js";
import { parseDetailHtml } from "../src/features/scrapers/autoscout24_collector/detail";
import { recordScraperRun } from "../src/features/scrapers/common/monitoring";

const args = process.argv.slice(2);
function getFlag(name: string, defaultVal: string): string {
  const flag = args.find((a) => a.startsWith(`--${name}=`));
  return flag ? flag.split("=")[1] : defaultVal;
}

const MAX_LISTINGS = parseInt(getFlag("maxListings", "500"), 10);
const DELAY_MS = parseInt(getFlag("delayMs", "1000"), 10);
const DRY_RUN = args.includes("--dryRun");
const TIME_BUDGET_MS = 25 * 60 * 1000; // 25 minutes (within 30-min GH Actions timeout)

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function main() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const client = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const startedAtIso = new Date(startTime).toISOString();

  console.log(`[enrich-as24-bulk] Starting: max=${MAX_LISTINGS}, delay=${DELAY_MS}ms, dryRun=${DRY_RUN}`);

  const { data: rows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url")
    .eq("source", "AutoScout24")
    .eq("status", "active")
    .is("trim", null)
    .order("updated_at", { ascending: true })
    .limit(MAX_LISTINGS);

  if (fetchErr || !rows) {
    console.error("Query failed:", fetchErr?.message);
    process.exit(1);
  }

  console.log(`[enrich-as24-bulk] Found ${rows.length} listings to enrich`);

  let enriched = 0;
  const errors: string[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    if (Date.now() - startTime > TIME_BUDGET_MS) {
      console.log(`Time budget reached after ${enriched} enrichments`);
      break;
    }

    if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

    try {
      const response = await fetch(row.source_url, {
        headers: FETCH_HEADERS,
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        if (response.status === 404 || response.status === 410) {
          if (!DRY_RUN) {
            await client.from("listings")
              .update({ status: "delisted", updated_at: new Date().toISOString() })
              .eq("id", row.id);
          }
          continue;
        }
        throw new Error(`HTTP ${response.status}`);
      }

      const html = await response.text();
      const detail = parseDetailHtml(html);

      const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
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

      const newFieldCount = Object.keys(update).length - 1;
      if (!DRY_RUN) {
        if (newFieldCount > 0) {
          const { error: updateErr } = await client.from("listings").update(update).eq("id", row.id);
          if (!updateErr) enriched++;
          else errors.push(`Update failed (${row.id}): ${updateErr.message}`);
        } else {
          await client.from("listings")
            .update({ trim: "", updated_at: new Date().toISOString() })
            .eq("id", row.id);
        }
      } else {
        if (newFieldCount > 0) enriched++;
      }

      if ((i + 1) % 50 === 0) {
        console.log(`[enrich-as24-bulk] Progress: ${i + 1}/${rows.length} processed, ${enriched} enriched`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
        errors.push(`Circuit-break: ${msg}`);
        break;
      }
      errors.push(`Failed ${row.source_url}: ${msg}`);
    }
  }

  if (!DRY_RUN) {
    await recordScraperRun({
      scraper_name: "enrich-details-bulk",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "github_actions",
      duration_ms: Date.now() - startTime,
      discovered: rows.length,
      written: enriched,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
  }

  console.log(`[enrich-as24-bulk] Done: ${enriched}/${rows.length} enriched, ${errors.length} errors, ${Date.now() - startTime}ms`);
  if (errors.length > 0) console.log("Errors:", errors.slice(0, 10));
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Verify script compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No errors from the new script.

- [ ] **Step 4: Commit**

```bash
git add .github/workflows/autoscout24-enrich.yml scripts/enrich-as24-bulk.ts
git commit -m "feat(as24-bulk): GitHub Actions workflow for bulk AS24 detail enrichment (500/run)"
```

---

### Task 8: Field Completeness Monitoring API

**Files:**
- Create: `src/app/api/admin/scrapers/field-completeness/route.ts`
- Modify: `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`

- [ ] **Step 1: Create the field completeness API route**

Create `src/app/api/admin/scrapers/field-completeness/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const ADMIN_EMAILS = ["caposk8@hotmail.com"];

export const dynamic = "force-dynamic";

const FIELDS = [
  "vin", "trim", "engine", "transmission", "mileage_km",
  "color_exterior", "color_interior", "body_style",
] as const;

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json(
      { status: 401, code: "AUTH_REQUIRED", message: "Admin access required" },
      { status: 401 }
    );
  }

  // Query field completeness per source (active listings only)
  // Note: For ~30k rows this is acceptable. If listings grow significantly,
  // migrate to a Supabase RPC function (see spec Section 6A).
  const { data: rows, error } = await supabase
    .from("listings")
    .select("source,vin,trim,engine,transmission,mileage_km,color_exterior,color_interior,body_style,current_bid,images")
    .eq("status", "active");

  if (error) {
    return NextResponse.json(
      { status: 500, code: "QUERY_ERROR", message: error.message },
      { status: 500 }
    );
  }

  // Aggregate by source
  const bySource: Record<string, {
    total: number;
    fields: Record<string, number>;
  }> = {};

  for (const row of rows ?? []) {
    const src = row.source as string;
    if (!bySource[src]) {
      bySource[src] = { total: 0, fields: {} };
      for (const f of [...FIELDS, "price", "images"]) {
        bySource[src].fields[f] = 0;
      }
    }
    bySource[src].total++;

    for (const f of FIELDS) {
      if (row[f] != null && row[f] !== "") bySource[src].fields[f]++;
    }
    if (row.current_bid != null && row.current_bid > 0) bySource[src].fields.price++;
    if (row.images != null && Array.isArray(row.images) && row.images.length > 0) {
      bySource[src].fields.images++;
    }
  }

  // Convert to percentages
  const result = Object.entries(bySource).map(([source, { total, fields }]) => ({
    source,
    total,
    ...Object.fromEntries(
      Object.entries(fields).map(([k, v]) => [k, total > 0 ? Math.round((v / total) * 1000) / 10 : 0])
    ),
  }));

  result.sort((a, b) => a.source.localeCompare(b.source));

  return NextResponse.json({
    status: 200,
    code: "OK",
    data: result,
    generatedAt: new Date().toISOString(),
  });
}
```

- [ ] **Step 2: Add field completeness heatmap to dashboard**

In `src/app/[locale]/admin/scrapers/ScrapersDashboardClient.tsx`, add a new tab or card section for field completeness. Add state and fetch logic:

```typescript
// Add state
const [fieldCompleteness, setFieldCompleteness] = useState<FieldCompletenessRow[] | null>(null);

interface FieldCompletenessRow {
  source: string;
  total: number;
  vin: number;
  trim: number;
  engine: number;
  transmission: number;
  mileage_km: number;
  color_exterior: number;
  color_interior: number;
  body_style: number;
  price: number;
  images: number;
}

// Fetch on mount (inside existing useEffect or new one)
fetch("/api/admin/scrapers/field-completeness")
  .then((r) => r.json())
  .then((d) => { if (d.data) setFieldCompleteness(d.data); })
  .catch(console.error);
```

Add the heatmap component rendering (inside a new Card):

```tsx
{fieldCompleteness && (
  <Card>
    <CardHeader>
      <CardTitle>Field Completeness by Source</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b">
              <th className="text-left p-2">Source</th>
              <th className="p-2">Total</th>
              {["VIN","Trim","Engine","Trans.","Mileage","Ext. Color","Int. Color","Body","Price","Images"].map(h => (
                <th key={h} className="p-2">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {fieldCompleteness.map((row) => (
              <tr key={row.source} className="border-b">
                <td className="p-2 font-medium">{row.source}</td>
                <td className="p-2 text-center">{row.total.toLocaleString()}</td>
                {[row.vin, row.trim, row.engine, row.transmission, row.mileage_km,
                  row.color_exterior, row.color_interior, row.body_style, row.price, row.images
                ].map((pct, i) => (
                  <td key={i} className={`p-2 text-center font-mono ${
                    pct >= 90 ? "bg-green-100 text-green-800" :
                    pct >= 50 ? "bg-yellow-100 text-yellow-800" :
                    "bg-red-100 text-red-800"
                  }`}>
                    {pct}%
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </CardContent>
  </Card>
)}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`
Expected: No new errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/scrapers/field-completeness/route.ts src/app/\[locale\]/admin/scrapers/ScrapersDashboardClient.tsx
git commit -m "feat(monitoring): field completeness heatmap on admin dashboard"
```

---

### Task 9: Final Verification

- [ ] **Step 1: Run all enrichment tests**

Run: `npx vitest run src/app/api/cron/enrich --reporter=verbose`
Expected: All tests in enrich-details, enrich-autotrader, enrich-beforward pass.

- [ ] **Step 2: Run title enrichment tests**

Run: `npx vitest run src/features/scrapers/common/titleEnrichment.test.ts --reporter=verbose`
Expected: All tests pass.

- [ ] **Step 3: Verify TypeScript compilation**

Run: `npx tsc --noEmit --pretty 2>&1 | tail -5`
Expected: No new errors.

- [ ] **Step 4: Verify vercel.json has all new crons**

Run: `cat vercel.json | grep enrich`
Expected output should include:
```
enrich-details (30 7)
enrich-autotrader (45 7)
enrich-beforward (0 8)
```

- [ ] **Step 5: Final commit if needed**

If any fixes were needed during verification, commit them.

---

## Out of Scope (Deferred)

These items from the spec require external dependencies or investigation and should be separate tasks:

1. **ClassicCom Price Fix (Section 3)** — Requires running the fixed GH Actions collector first to diagnose root cause. Defer until after the March 18 path-fix commit propagates and we can observe results.

2. **Supabase RPC function `field_completeness_by_source()`** — The API route above computes this in-app. A Supabase function would be more efficient at scale but requires manual SQL execution in the Supabase dashboard. Create this as a follow-up task.

3. **Daily completeness snapshots** — Phase 2 per spec. Implement after the heatmap is validated.
