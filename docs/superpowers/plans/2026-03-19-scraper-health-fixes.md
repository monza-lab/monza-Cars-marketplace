# Scraper Health & Monitoring Fixes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix all identified scraper issues: silent failures on Ferrari/BeForward crons, missing monitoring on validate/cleanup, dead-listing cleanup for backfill efficiency, and comprehensive test coverage for all maintenance crons.

**Architecture:** Add `recordScraperRun()` to validate & cleanup crons (same pattern as backfill-images). Add a dead-listing purge step to backfill-images to skip 404/410 URLs. Investigate Ferrari/BeForward scheduling. Write Vitest tests with `vi.mock()` for all untested cron routes.

**Tech Stack:** TypeScript, Vitest, Supabase JS client, Next.js API routes

**Out of Scope:** Classic.com low quality (48.2%, near-zero images/prices) and BeForward zero images/prices are known data quality issues but require deeper scraper architecture changes (Playwright proxy improvements, detail-page enrichment). These should be addressed in a separate plan.

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/app/api/cron/validate/route.ts` | Add `recordScraperRun()` monitoring |
| Modify | `src/app/api/cron/cleanup/route.ts` | Add `recordScraperRun()` monitoring |
| Modify | `src/features/scrapers/common/backfillImages.ts` | Mark dead listings (404/410) so they stop being retried |
| Modify | `src/app/api/cron/backfill-images/route.ts` | Minor: pass new option for dead-listing marking |
| Create | `src/app/api/cron/validate/route.test.ts` | Tests for validate cron |
| Create | `src/app/api/cron/cleanup/route.test.ts` | Tests for cleanup cron |
| Create | `src/app/api/cron/backfill-images/route.test.ts` | Tests for backfill-images cron |
| Create | `src/features/scrapers/common/listingValidator.test.ts` | Tests for listing validator logic |
| Create | `src/app/api/cron/ferrari/route.test.ts` | Tests for ferrari cron |
| Create | `src/app/api/cron/beforward/route.test.ts` | Tests for beforward cron |

---

## Task 1: Add Monitoring to Validate Cron

**Files:**
- Modify: `src/app/api/cron/validate/route.ts`

The validate cron currently only logs to console. It should record runs to `scraper_runs` like all other scrapers do.

- [ ] **Step 1: Add monitoring imports and run tracking to validate route**

Add `recordScraperRun`, `markScraperRunStarted`, and `clearScraperRunActive` imports. Wrap the existing logic with run tracking. Use `scraper_name: "validate"`.

```typescript
// At top of file, add:
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

// Inside GET(), after auth check, before try block:
const runId = crypto.randomUUID();
const startedAtIso = new Date(startTime).toISOString();

await markScraperRunStarted({
  scraperName: "validate",
  runId,
  startedAt: startedAtIso,
  runtime: "vercel_cron",
});
```

In the success path (before the `return NextResponse.json`):

```typescript
await recordScraperRun({
  scraper_name: "validate",
  run_id: runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: true,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered: recentListings.length,
  written: fixed,
  errors_count: deleted, // deleted = invalid listings removed
  error_messages: Object.keys(deletedReasons).length > 0
    ? Object.entries(deletedReasons).map(([r, c]) => `${r}: ${c}`)
    : undefined,
});

await clearScraperRunActive("validate");
```

In the catch block (before the error `return`):

```typescript
await recordScraperRun({
  scraper_name: "validate",
  run_id: runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: false,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered: 0,
  written: 0,
  errors_count: 1,
  error_messages: [error instanceof Error ? error.message : "Validation failed"],
});

await clearScraperRunActive("validate");
```

- [ ] **Step 2: Add "validate" to ScraperName type**

In `src/features/scrapers/common/monitoring/types.ts`, the `ScraperName` type is currently a single-line union. Append `| 'validate' | 'cleanup'` to the end:

```typescript
// Current (single line):
// export type ScraperName = 'porsche' | 'ferrari' | ... | 'bat-detail';
// Change to:
export type ScraperName = 'porsche' | 'ferrari' | 'autotrader' | 'beforward' | 'classic' | 'autoscout24' | 'backfill-images' | 'enrich-vin' | 'enrich-titles' | 'bat-detail' | 'validate' | 'cleanup';
```

- [ ] **Step 3: Verify locally**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/validate
```

Check that the response includes `runId` and that `scraper_runs` table has a new row with `scraper_name = 'validate'`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/validate/route.ts src/features/scrapers/common/monitoring/types.ts
git commit -m "feat(monitoring): add recordScraperRun to validate cron"
```

---

## Task 2: Add Monitoring to Cleanup Cron

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts`

Same pattern as Task 1 but for the cleanup cron.

- [ ] **Step 1: Add monitoring imports and run tracking to cleanup route**

Add the same three monitoring imports. Use `scraper_name: "cleanup"`.

```typescript
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
```

After auth check:

```typescript
const runId = crypto.randomUUID();
const startedAtIso = new Date(startTime).toISOString();

await markScraperRunStarted({
  scraperName: "cleanup",
  runId,
  startedAt: startedAtIso,
  runtime: "vercel_cron",
});
```

In the success return (replace the existing `return NextResponse.json` — keep the same JSON payload but add the recording before it):

```typescript
const allMessages: string[] = [];
if (totalStaleFixed > 0) allMessages.push(`stale: ${staleSoldCount} sold, ${staleUnsoldCount} unsold`);
if (reclassified > 0) allMessages.push(`reclassified: ${reclassified}`);
if (deletedCount > 0) {
  allMessages.push(...Object.entries(byReason).map(([r, c]) => `junk-${r}: ${c}`));
}

await recordScraperRun({
  scraper_name: "cleanup",
  run_id: runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: true,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered: allListings.length,
  written: totalStaleFixed + reclassified,
  errors_count: deletedCount,
  refresh_checked: allListings.length,
  refresh_updated: totalStaleFixed,
  error_messages: allMessages.length > 0 ? allMessages : undefined,
});

await clearScraperRunActive("cleanup");
```

In the catch block (before the error `return`):

```typescript
await recordScraperRun({
  scraper_name: "cleanup",
  run_id: runId,
  started_at: startedAtIso,
  finished_at: new Date().toISOString(),
  success: false,
  runtime: "vercel_cron",
  duration_ms: Date.now() - startTime,
  discovered: 0,
  written: 0,
  errors_count: 1,
  error_messages: [error instanceof Error ? error.message : "Cleanup failed"],
});

await clearScraperRunActive("cleanup");
```

- [ ] **Step 2: Verify locally**

```bash
curl -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/cleanup
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/cleanup/route.ts
git commit -m "feat(monitoring): add recordScraperRun to cleanup cron"
```

---

## Task 3: Stop Retrying Dead Listings in Backfill

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts`

The backfill-images cron wastes time retrying listings whose source URLs return 404/410. When we get these responses, mark the listing so it won't be retried.

- [ ] **Step 1: Add dead-listing marking on 404/410 errors**

In `backfillImagesForSource()`, in the catch block that handles per-listing errors, when the error is a 404 or 410, update the listing's `images` field to a sentinel value (`['__dead_url__']`) so the query `images.eq.{}` no longer matches it:

```typescript
// Inside the per-listing catch block, before the existing circuit-break check:
if (/\b(404|410)\b/.test(msg)) {
  // Mark listing so it stops being queried for backfill
  if (!opts.dryRun) {
    await client
      .from("listings")
      .update({
        images: ["__dead_url__"],
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);
  }
  result.errors.push(`Dead URL (${row.id}): ${msg}`);
  continue;
}
```

**Note:** No query change is needed. The sentinel `['__dead_url__']` is a non-empty array, so the existing filter `images.eq.{}` (empty array) already excludes it.

- [ ] **Step 2: Add test for dead-URL marking to `backfillImages.test.ts`**

Add the following test to the existing `src/features/scrapers/common/backfillImages.test.ts` file. This requires restructuring the file to use `vi.mock()` for Supabase:

```typescript
// Add to the existing describe block in backfillImages.test.ts:

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockUpdate = vi.fn();
const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

// Mock the dynamic imports used by buildImageFetcherMap
vi.mock("@/features/scrapers/auctions/bringATrailerImages", () => ({
  fetchBaTImages: vi.fn().mockRejectedValue(new Error("HTTP 404 for url")),
}));

import { backfillImagesForSource } from "./backfillImages";

describe("backfillImagesForSource", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("marks listings with 404 errors as dead URLs", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [{ id: "dead-1", source: "BaT", source_url: "https://bat.com/listing/1" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
          update: (data: Record<string, unknown>) => {
            mockUpdate(data);
            return { eq: () => Promise.resolve({ error: null }) };
          },
        };
      }
      return {};
    });

    const result = await backfillImagesForSource({
      source: "BaT",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 10000,
    });

    // Verify the listing was marked with __dead_url__ sentinel
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ images: ["__dead_url__"] })
    );
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining("Dead URL")])
    );
  });

  it("skips dead-URL marking in dry-run mode", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          select: () => ({
            eq: () => ({
              or: () => ({
                order: () => ({
                  limit: () => Promise.resolve({
                    data: [{ id: "dead-2", source: "BaT", source_url: "https://bat.com/listing/2" }],
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        };
      }
      return {};
    });

    const result = await backfillImagesForSource({
      source: "BaT",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 10000,
      dryRun: true,
    });

    expect(mockUpdate).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Run all backfill tests**

```bash
npx vitest run src/features/scrapers/common/backfillImages.test.ts
```

Ensure both existing and new tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/features/scrapers/common/backfillImages.test.ts
git commit -m "fix(backfill): mark 404/410 listings as dead to stop retrying"
```

---

## Task 4: Test the Listing Validator

**Files:**
- Create: `src/features/scrapers/common/listingValidator.test.ts`

The `validateListing()` function is pure logic (no I/O) — ideal for unit tests. It imports from `brandConfig.ts` which is also pure.

- [ ] **Step 1: Write tests for validateListing**

```typescript
import { describe, it, expect } from "vitest";
import { validateListing, isNonCar, tryExtractModel } from "./listingValidator";

describe("listingValidator", () => {
  describe("validateListing", () => {
    it("accepts a valid Porsche listing", () => {
      const result = validateListing({
        make: "Porsche",
        model: "911 Carrera",
        title: "2020 Porsche 911 Carrera S",
        year: 2020,
      });
      expect(result.valid).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("rejects non-Porsche makes", () => {
      const result = validateListing({
        make: "BMW",
        model: "M3",
        title: "2020 BMW M3",
        year: 2020,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("non-porsche-make");
    });

    it("rejects Porsche diesel tractors", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Diesel Standard",
        title: "1958 Porsche Diesel Standard Tractor",
        year: 1958,
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:diesel");
    });

    it("allows Cayenne Diesel (not a tractor)", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Cayenne Diesel",
        title: "2015 Porsche Cayenne Diesel",
        year: 2015,
      });
      expect(result.valid).toBe(true);
    });

    it("rejects boats", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Craft boat",
        title: "Porsche Craft speedboat",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:craft");
    });

    it("rejects kit cars", () => {
      const result = validateListing({
        make: "Porsche",
        model: "APAL Speedster",
        title: "APAL Porsche Speedster Kit",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:apal");
    });

    it("rejects bikes", () => {
      const result = validateListing({
        make: "Porsche",
        model: "bike",
        title: "Porsche bike",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toBe("non-car:bike");
    });

    it("fixes listings with color-as-model when title has real model", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Guards Red",
        title: "1987 Porsche 911 Turbo Guards Red",
        year: 1987,
      });
      expect(result.valid).toBe(true);
      expect(result.fixedModel).toBeDefined();
    });

    it("rejects listings with generic model and no extractable title", () => {
      const result = validateListing({
        make: "Porsche",
        model: "Others",
        title: "Porsche item",
      });
      expect(result.valid).toBe(false);
      expect(result.reason).toContain("unresolvable-model");
    });
  });

  describe("isNonCar", () => {
    it("detects tractor", () => {
      expect(isNonCar("tractor", "")).not.toBeNull();
    });

    it("detects literature", () => {
      expect(isNonCar("literature set", "")).not.toBeNull();
    });

    it("passes valid models", () => {
      expect(isNonCar("911 Carrera", "")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/features/scrapers/common/listingValidator.test.ts
```

Expected: All tests pass.

- [ ] **Step 3: Commit**

```bash
git add src/features/scrapers/common/listingValidator.test.ts
git commit -m "test(validator): add unit tests for listingValidator"
```

---

## Task 5: Test the Validate Cron Route

**Files:**
- Create: `src/app/api/cron/validate/route.test.ts`

Tests the full cron route handler with mocked Supabase and monitoring.

- [ ] **Step 1: Write tests for validate cron**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// -- Mocks --
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/features/scrapers/common/listingValidator", () => ({
  validateListing: vi.fn(),
}));

import { GET } from "./route";
import { validateListing } from "@/features/scrapers/common/listingValidator";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const mockValidate = vi.mocked(validateListing);
const mockRecord = vi.mocked(recordScraperRun);

function makeRequest(secret: string) {
  return new Request("http://localhost:3000/api/cron/validate", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/validate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("scans recent listings and records the run", async () => {
    // Mock Supabase to return 1 listing
    mockFrom.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          select: () => ({
            gte: () => ({
              range: () => Promise.resolve({
                data: [{ id: "1", make: "Porsche", model: "911", year: 2020, title: "2020 Porsche 911" }],
                error: null,
              }),
            }),
          }),
          update: (data: unknown) => {
            mockUpdate(data);
            return { eq: () => Promise.resolve({ error: null }) };
          },
          delete: () => ({
            in: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      if (table === "price_history") {
        return { delete: () => ({ in: () => Promise.resolve({ error: null }) }) };
      }
      return {};
    });

    mockValidate.mockReturnValue({ valid: true });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.scanned).toBe(1);
    expect(mockRecord).toHaveBeenCalledOnce();
  });

  it("deletes invalid listings and records deletion reasons", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          select: () => ({
            gte: () => ({
              range: () => Promise.resolve({
                data: [{ id: "bad-1", make: "BMW", model: "M3", year: 2020, title: "BMW M3" }],
                error: null,
              }),
            }),
          }),
          delete: () => ({
            in: () => ({ select: () => Promise.resolve({ data: [{ id: "bad-1" }], error: null }) }),
          }),
        };
      }
      if (table === "price_history") {
        return { delete: () => ({ in: () => Promise.resolve({ error: null }) }) };
      }
      return {};
    });

    mockValidate.mockReturnValue({ valid: false, reason: "non-porsche-make:BMW" });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.deleted).toBe(1);
    expect(body.deletedReasons).toHaveProperty("non-porsche-make:BMW");
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/app/api/cron/validate/route.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/validate/route.test.ts
git commit -m "test(validate): add cron route tests with mocked Supabase"
```

---

## Task 6: Test the Cleanup Cron Route

**Files:**
- Create: `src/app/api/cron/cleanup/route.test.ts`

- [ ] **Step 1: Write tests for cleanup cron**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: mockFrom }),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/brandConfig", () => ({
  extractSeries: vi.fn().mockReturnValue("992"),
  getSeriesConfig: vi.fn().mockReturnValue(null),
}));

import { GET } from "./route";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const mockRecord = vi.mocked(recordScraperRun);

function makeRequest(secret: string) {
  return new Request("http://localhost:3000/api/cron/cleanup", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/cleanup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("returns 401 without valid auth", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("marks stale auctions as sold/unsold", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          update: () => ({
            eq: () => ({
              lt: () => ({
                gt: () => ({
                  select: () => Promise.resolve({
                    data: [{ id: "sold-1" }],
                    error: null,
                  }),
                }),
                select: () => Promise.resolve({
                  data: [{ id: "unsold-1" }],
                  error: null,
                }),
              }),
            }),
          }),
          select: () => ({
            range: () => Promise.resolve({ data: [], error: null }),
          }),
          delete: () => ({
            in: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
          }),
        };
      }
      if (table === "price_history") {
        return { delete: () => ({ in: () => Promise.resolve({ error: null }) }) };
      }
      return {};
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.staleSold).toBe(1);
    expect(body.staleUnsold).toBe(1);
    expect(body.staleFixed).toBe(2);
    expect(mockRecord).toHaveBeenCalledOnce();
  });

  it("detects and deletes junk listings (non-Porsche)", async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === "listings") {
        return {
          update: () => ({
            eq: () => ({
              lt: () => ({
                gt: () => ({ select: () => Promise.resolve({ data: [], error: null }) }),
                select: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
          select: () => ({
            range: () => Promise.resolve({
              data: [{ id: "junk-1", make: "BMW", model: "M3", year: 2020, title: "BMW M3" }],
              error: null,
            }),
          }),
          delete: () => ({
            in: () => ({ select: () => Promise.resolve({ data: [{ id: "junk-1" }], error: null }) }),
          }),
        };
      }
      if (table === "price_history") {
        return { delete: () => ({ in: () => Promise.resolve({ error: null }) }) };
      }
      return {};
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.deleted).toBe(1);
    expect(body.byReason).toHaveProperty("non-porsche-make:BMW");
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/app/api/cron/cleanup/route.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/cleanup/route.test.ts
git commit -m "test(cleanup): add cron route tests with mocked Supabase"
```

---

## Task 7: Test the Backfill-Images Cron Route

**Files:**
- Create: `src/app/api/cron/backfill-images/route.test.ts`

- [ ] **Step 1: Write tests for backfill-images cron**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/scrapers/common/backfillImages", () => ({
  backfillImagesForSource: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";
import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const mockBackfill = vi.mocked(backfillImagesForSource);
const mockRecord = vi.mocked(recordScraperRun);

function makeRequest(secret: string) {
  return new Request("http://localhost:3000/api/cron/backfill-images", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/backfill-images", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("processes all three sources and records success", async () => {
    mockBackfill.mockResolvedValue({
      source: "BaT",
      discovered: 10,
      backfilled: 3,
      errors: [],
      durationMs: 5000,
    });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.results).toHaveLength(3); // BaT, BeForward, AutoScout24
    expect(body.totalBackfilled).toBe(9); // 3 per source × 3 sources
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        scraper_name: "backfill-images",
        success: true,
      })
    );
  });

  it("records failure when backfill throws", async () => {
    mockBackfill.mockRejectedValue(new Error("Network timeout"));

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({
        success: false,
        error_messages: ["Network timeout"],
      })
    );
  });

  it("handles partial errors from sources", async () => {
    mockBackfill
      .mockResolvedValueOnce({
        source: "BaT",
        discovered: 5,
        backfilled: 2,
        errors: ["HTTP 403 for listing-1"],
        durationMs: 3000,
      })
      .mockResolvedValueOnce({
        source: "BeForward",
        discovered: 0,
        backfilled: 0,
        errors: [],
        durationMs: 1000,
      })
      .mockResolvedValueOnce({
        source: "AutoScout24",
        discovered: 3,
        backfilled: 3,
        errors: [],
        durationMs: 4000,
      });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.totalBackfilled).toBe(5);
    expect(body.totalDiscovered).toBe(8);
  });
});
```

- [ ] **Step 2: Run the tests**

```bash
npx vitest run src/app/api/cron/backfill-images/route.test.ts
```

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/backfill-images/route.test.ts
git commit -m "test(backfill-images): add cron route tests"
```

---

## Task 8: Test Ferrari and BeForward Cron Routes

**Files:**
- Create: `src/app/api/cron/ferrari/route.test.ts`
- Create: `src/app/api/cron/beforward/route.test.ts`

These crons are still scheduled in `vercel.json` but haven't run since March 15. The tests will verify the route logic works so any deployment issue can be isolated.

- [ ] **Step 1: Write Ferrari cron tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/scrapers/ferrari_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/ferrari_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
}));

vi.mock("@/features/scrapers/ferrari_collector/historical_backfill", () => ({
  runLightBackfill: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";
import { runCollector } from "@/features/scrapers/ferrari_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/ferrari_collector/supabase_writer";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const mockCollector = vi.mocked(runCollector);
const mockRefresh = vi.mocked(refreshActiveListings);
const mockRecord = vi.mocked(recordScraperRun);

function makeRequest(secret: string) {
  return new Request("http://localhost:3000/api/cron/ferrari", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/ferrari", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("runs collector pipeline and records success", async () => {
    mockRefresh.mockResolvedValue({ checked: 10, updated: 2, errors: [] });
    mockCollector.mockResolvedValue({
      runId: "test-run",
      sourceCounts: { BaT: { discovered: 50, written: 10 } },
      errors: [],
    } as any);

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.refresh.checked).toBe(10);
    expect(body.discovered).toBe(50);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ scraper_name: "ferrari", success: true })
    );
  });

  it("records failure when collector throws", async () => {
    mockRefresh.mockResolvedValue({ checked: 0, updated: 0, errors: [] });
    mockCollector.mockRejectedValue(new Error("BaT is down"));

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});
```

- [ ] **Step 2: Write BeForward cron tests**

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/features/scrapers/beforward_porsche_collector/collector", () => ({
  runCollector: vi.fn(),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/supabase_writer", () => ({
  refreshActiveListings: vi.fn(),
}));

vi.mock("@/features/scrapers/beforward_porsche_collector/backfill", () => ({
  backfillMissingImages: vi.fn(),
}));

vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn().mockResolvedValue(undefined),
  recordScraperRun: vi.fn().mockResolvedValue(undefined),
  clearScraperRunActive: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "./route";
import { runCollector } from "@/features/scrapers/beforward_porsche_collector/collector";
import { refreshActiveListings } from "@/features/scrapers/beforward_porsche_collector/supabase_writer";
import { backfillMissingImages } from "@/features/scrapers/beforward_porsche_collector/backfill";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const mockCollector = vi.mocked(runCollector);
const mockRefresh = vi.mocked(refreshActiveListings);
const mockBackfill = vi.mocked(backfillMissingImages);
const mockRecord = vi.mocked(recordScraperRun);

function makeRequest(secret: string) {
  return new Request("http://localhost:3000/api/cron/beforward", {
    headers: { authorization: `Bearer ${secret}` },
  });
}

describe("GET /api/cron/beforward", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = "test-secret";
  });

  it("returns 401 without valid auth", async () => {
    const res = await GET(makeRequest("wrong"));
    expect(res.status).toBe(401);
  });

  it("runs collector with capped config and records success", async () => {
    mockRefresh.mockResolvedValue({ checked: 5, updated: 1, errors: [] });
    mockCollector.mockResolvedValue({
      runId: "bf-run",
      totalResults: 75,
      pageCount: 3,
      processedPages: 3,
      counts: { discovered: 75, written: 20, errors: 0 },
      errors: [],
    } as any);
    mockBackfill.mockResolvedValue({ discovered: 5, backfilled: 2, errors: [] });

    const res = await GET(makeRequest("test-secret"));
    const body = await res.json();

    expect(body.success).toBe(true);
    expect(body.counts.discovered).toBe(75);
    expect(body.backfill.backfilled).toBe(2);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ scraper_name: "beforward", success: true })
    );
  });

  it("records failure when collector throws", async () => {
    mockRefresh.mockResolvedValue({ checked: 0, updated: 0, errors: [] });
    mockCollector.mockRejectedValue(new Error("BeForward 429"));

    const res = await GET(makeRequest("test-secret"));

    expect(res.status).toBe(500);
    expect(mockRecord).toHaveBeenCalledWith(
      expect.objectContaining({ success: false })
    );
  });
});
```

- [ ] **Step 3: Run both test files**

```bash
npx vitest run src/app/api/cron/ferrari/route.test.ts src/app/api/cron/beforward/route.test.ts
```

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/ferrari/route.test.ts src/app/api/cron/beforward/route.test.ts
git commit -m "test(crons): add ferrari and beforward cron route tests"
```

---

## Task 9: Investigate Ferrari/BeForward Silent Failures

**Files:**
- No code changes — investigation task

Both crons are scheduled in `vercel.json` and the route code looks correct. The issue is likely a Vercel deployment or runtime error.

- [ ] **Step 1: Check Vercel deployment logs**

Go to Vercel Dashboard → Project → Deployments. Check:
- Was there a deployment after March 15?
- Are the cron jobs enabled? (Settings → Crons)

- [ ] **Step 2: Check Vercel function logs**

Go to Vercel Dashboard → Logs → filter by `/api/cron/ferrari` and `/api/cron/beforward`. Look for:
- 500 errors
- Timeout errors (maxDuration exceeded)
- Missing env vars

- [ ] **Step 3: Test locally**

```bash
npm run dev
# In separate terminal:
curl -v -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/ferrari
curl -v -H "Authorization: Bearer YOUR_CRON_SECRET" http://localhost:3000/api/cron/beforward
```

If they work locally, the issue is Vercel-specific (env vars, deployment, or billing limits on cron jobs).

- [ ] **Step 4: Document findings**

Note any issues found and whether a code fix is needed.

---

## Task 10: Run All Tests and Final Verification

- [ ] **Step 1: Run the full test suite**

```bash
npx vitest run
```

Expected: All new and existing tests pass.

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Final commit with all fixes**

```bash
git add -A
git commit -m "chore: scraper health fixes — monitoring, dead-url marking, test coverage"
```
