# Bring a Trailer Detail Enrichment with Scrapling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover BaT `mileage`, `vin`, `color_exterior`, `color_interior`, `engine`, `transmission`, and `body_style` more reliably by adding a field-scored detail parser with a Scrapling fallback for incomplete or blocked pages.

**Architecture:** Keep the current BaT scraper as the primary HTTP path, but refactor detail extraction into a reusable field-candidate pipeline that can run on both raw HTML and Scrapling-rendered HTML. The scraper should keep the best valid candidate per field, reject cross-field contamination like mileage text being misread as transmission, and only invoke Scrapling when the normal fetch still leaves high-value fields missing. Because `scrapeDetail()` is already consumed by the BaT backfill script and the Porsche/Ferrari historical backfills, the improvement will propagate to all BaT enrichment callers without extra plumbing.

**Tech Stack:** TypeScript, Node `spawnSync`, Cheerio, Vitest, Scrapling CLI (`scrapling extract stealthy-fetch`), Next.js cron/script tooling.

**Plan Budget:** `{files: 3 modified + 2 created, LOC/file: 120-320 target, deps: 0 new npm deps, 1 external Python tool already used elsewhere (Scrapling)}`

---

## File Structure

### Existing files to modify

- `src/features/scrapers/auctions/bringATrailer.ts`
  Purpose: BaT detail parsing, field scoring, fallback orchestration, and the final merge into `BaTAuction`.
- `scripts/bat-detail-scraper.ts`
  Purpose: Batch enrichment job for BaT listings; expands the candidate query and records the richer field set.
- `docs/scrapers/SCRAPERS.md`
  Purpose: Human-facing runbook for the new BaT enrichment flow and manual recovery commands.

### New files to create

- `src/features/scrapers/auctions/batScrapling.ts`
  Purpose: Thin BaT-only Scrapling wrapper that fetches rendered HTML when the HTTP path is incomplete.
- `src/features/scrapers/auctions/bringATrailer.test.ts`
  Purpose: Regression coverage for BaT field recovery and Scrapling fallback behavior.

### Callers that benefit automatically

- `scripts/backfill-detail-scrape.ts`
- `src/features/scrapers/porsche_collector/historical_backfill.ts`
- `src/features/scrapers/ferrari_collector/historical_backfill.ts`

These callers already use `scrapeDetail()`, so they will inherit the new recovery path once `bringATrailer.ts` is updated.

---

## Task 1: Refactor BaT detail parsing into a field-candidate pipeline

**Files:**
- Modify: `src/features/scrapers/auctions/bringATrailer.ts`
- Create: `src/features/scrapers/auctions/bringATrailer.test.ts`

- [ ] **Step 1: Write the failing regression tests**

```ts
import { describe, expect, it, vi } from "vitest";
import { scrapeDetail } from "./bringATrailer";

const baseAuction = {
  externalId: "bat-test",
  platform: "BRING_A_TRAILER",
  title: "1998 Ferrari 550 Maranello Spider",
  make: "Ferrari",
  model: "550 Maranello",
  year: 1998,
  mileage: null,
  mileageUnit: "miles",
  transmission: null,
  engine: null,
  exteriorColor: null,
  interiorColor: null,
  location: null,
  currentBid: null,
  bidCount: 0,
  endTime: null,
  url: "https://bringatrailer.com/listing/test/",
  imageUrl: null,
  description: null,
  sellerNotes: null,
  status: "active",
  vin: null,
  images: [],
  reserveStatus: null,
  bodyStyle: null,
};

vi.mock("./batScrapling", () => ({
  canUseBaTScraplingFallback: () => true,
  fetchBaTDetailHtmlWithScrapling: vi.fn(),
}));

describe("BaT detail recovery", () => {
  it("does not let mileage-like text overwrite transmission", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(`
      <html><body>
        <div class="essentials">
          <li>17k Miles Shown on Replacement Speedometer</li>
          <li>Transmission: 6-Speed Manual</li>
          <li>Chassis: WP0AA299XYS123456</li>
          <li>Rosso Corsa Paint</li>
          <li>Black Leather Upholstery</li>
          <li>4.9L Flat-12</li>
          <li>Spider</li>
        </div>
      </body></html>
    `, { status: 200 })) as any);

    const out = await scrapeDetail(baseAuction);

    expect(out.mileage).toBe(17000);
    expect(out.transmission).toBe("6-Speed Manual");
    expect(out.vin).toBe("WP0AA299XYS123456");
    expect(out.exteriorColor).toBe("Rosso Corsa");
    expect(out.interiorColor).toBe("Black Leather");
    expect(out.bodyStyle).toBe("Spider");
  });
});
```

- [ ] **Step 2: Run the test to verify the current implementation fails**

Run: `npx vitest run src/features/scrapers/auctions/bringATrailer.test.ts -v`
Expected: FAIL because `scrapeDetail()` does not yet have a field-candidate model or Scrapling fallback.

- [ ] **Step 3: Implement the minimal field-scoring parser**

```ts
type BaTDetailSignals = {
  mileage: number | null;
  mileageUnit: "miles" | "km";
  vin: string | null;
  colorExterior: string | null;
  colorInterior: string | null;
  engine: string | null;
  transmission: string | null;
  bodyStyle: string | null;
};

function extractBaTDetailSignals(html: string, title: string, description: string | null): BaTDetailSignals {
  // Parse essentials, JSON-LD, title, and description into candidates.
  // Keep the highest-confidence valid candidate per field.
  // Reject text that contains mileage/odometer/speedometer before accepting transmission.
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/scrapers/auctions/bringATrailer.test.ts -v`
Expected: PASS, with mileage recovered from the essentials line and transmission kept clean.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/auctions/bringATrailer.ts src/features/scrapers/auctions/bringATrailer.test.ts
git commit -m "test(bat): lock down detail field recovery"
```

---

## Task 2: Add a Scrapling fallback adapter and wire it into BaT detail scraping

**Files:**
- Create: `src/features/scrapers/auctions/batScrapling.ts`
- Modify: `src/features/scrapers/auctions/bringATrailer.ts`
- Modify: `scripts/bat-detail-scraper.ts`

- [ ] **Step 1: Write the failing test for fallback enrichment**

```ts
it("uses Scrapling when the HTTP fetch leaves key BaT fields missing", async () => {
  const { fetchBaTDetailHtmlWithScrapling } = await import("./batScrapling");
  const mockFallback = vi.mocked(fetchBaTDetailHtmlWithScrapling);

  vi.stubGlobal("fetch", vi.fn(async () => new Response("<html><body><div class='post-content'>no specs here</div></body></html>", { status: 200 })) as any);
  mockFallback.mockResolvedValueOnce(`
    <html><body>
      <div class="essentials">
        <li>Chassis: WP0AA299XYS123456</li>
        <li>Guards Red Paint</li>
        <li>Black Leather Upholstery</li>
        <li>4.9L Flat-12</li>
        <li>6-Speed Manual</li>
        <li>Spider</li>
      </div>
    </body></html>
  `);

  const out = await scrapeDetail(baseAuction);
  expect(out.vin).toBe("WP0AA299XYS123456");
  expect(out.exteriorColor).toBe("Guards Red");
  expect(out.interiorColor).toBe("Black Leather");
  expect(out.engine).toBe("4.9L Flat-12");
  expect(out.transmission).toBe("6-Speed Manual");
  expect(out.bodyStyle).toBe("Spider");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/scrapers/auctions/bringATrailer.test.ts -v`
Expected: FAIL until the fallback wrapper exists and `scrapeDetail()` calls it only when the primary HTML is incomplete.

- [ ] **Step 3: Implement the Scrapling wrapper**

```ts
import { mkdtempSync, readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export function canUseBaTScraplingFallback(): boolean {
  return !process.env.VERCEL;
}

export async function fetchBaTDetailHtmlWithScrapling(url: string): Promise<string | null> {
  if (!canUseBaTScraplingFallback()) return null;
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "bat-scrapling-"));
  const htmlPath = path.join(tempDir, "page.html");
  const result = spawnSync("scrapling", ["extract", "stealthy-fetch", url, htmlPath, "--solve-cloudflare"], {
    encoding: "utf8",
    timeout: 180_000,
    env: { ...process.env, PYTHONUNBUFFERED: "1" },
  });
  if (result.error || result.status !== 0) return null;
  return readFileSync(htmlPath, "utf8");
}
```

- [ ] **Step 4: Wire fallback only when it matters**

```ts
const primarySignals = extractBaTDetailSignals(primaryHtml, auction.title, description);
const needsFallback = [primarySignals.mileage, primarySignals.vin, primarySignals.colorExterior, primarySignals.colorInterior, primarySignals.engine, primarySignals.transmission, primarySignals.bodyStyle].some((value) => value == null);

if (needsFallback) {
  const fallbackHtml = await fetchBaTDetailHtmlWithScrapling(auction.url);
  if (fallbackHtml) {
    const fallbackSignals = extractBaTDetailSignals(fallbackHtml, auction.title, description);
    // Merge only missing fields from fallbackSignals into the final auction object.
  }
}
```

- [ ] **Step 5: Expand the BaT detail backfill query**

```ts
const { data: listings, error } = await supabase
  .from("listings")
  .select("id, source_url, title, images, engine, mileage, vin, transmission, color_exterior, color_interior, body_style")
  .eq("source", "BaT")
  .or("engine.is.null,mileage.is.null,vin.is.null,transmission.is.null,color_exterior.is.null,color_interior.is.null,body_style.is.null")
  .order("scrape_timestamp", { ascending: true })
  .limit(opts.limit);
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npx vitest run src/features/scrapers/auctions/bringATrailer.test.ts -v`
Expected: PASS, and the fallback is only used for incomplete pages.

- [ ] **Step 7: Commit**

```bash
git add src/features/scrapers/auctions/batScrapling.ts src/features/scrapers/auctions/bringATrailer.ts scripts/bat-detail-scraper.ts
git commit -m "feat(bat): add scrapling fallback enrichment"
```

---

## Task 3: Update the runbook and verify the end-to-end backfill path

**Files:**
- Modify: `docs/scrapers/SCRAPERS.md`

- [ ] **Step 1: Update the BaT detail scraper section**

Add a short description that says the BaT detail scraper now recovers all high-value fields, not just images/specs, and that Scrapling is used as a fallback when the primary HTML path leaves the page incomplete.

- [ ] **Step 2: Document the exact manual validation commands**

```bash
npx vitest run src/features/scrapers/auctions/bringATrailer.test.ts -v
npx tsx scripts/bat-detail-scraper.ts --preflight --limit=5 --dryRun
npx tsx scripts/bat-detail-scraper.ts --limit=100 --timeBudgetMs=1800000
```

Expected:
- The unit test passes.
- The preflight run reports recovered fields on at least 3 of 5 samples.
- The batch run updates rows where the primary HTML was incomplete and logs which fields were filled.

- [ ] **Step 3: Add the fallback contract to the docs**

Document the field order explicitly:
1. structured page data
2. essentials / visible text
3. title and description fallbacks
4. Scrapling-rendered HTML only when key fields are still missing

- [ ] **Step 4: Run the doc-aligned validation commands**

Run the same three commands above after the code lands, and compare the before/after counts for:
- `mileage`
- `vin`
- `color_exterior`
- `color_interior`
- `engine`
- `transmission`
- `body_style`

Expected: the null rate drops for each field without introducing mileage-into-transmission regressions.

- [ ] **Step 5: Commit**

```bash
git add docs/scrapers/SCRAPERS.md
git commit -m "docs(scrapers): describe bat detail recovery flow"
```

---

## Self-Review Checklist

- Spec coverage: every requirement is covered by a task.
  - Field recovery: Task 1.
  - Scrapling fallback: Task 2.
  - Backfill script expansion: Task 2.
  - Runbook and operator guidance: Task 3.
- Placeholder scan: no TBD/TODO/implement later markers remain.
- Type consistency: `BaTDetailSignals`, `scrapeDetail()`, `fetchBaTDetailHtmlWithScrapling()`, and the existing `BaTAuction` fields use the same names in all tasks.
- Scope check: this stays BaT-specific and does not spread into unrelated scrapers.
