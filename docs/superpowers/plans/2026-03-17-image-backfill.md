# Image Backfill System — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a daily cron + CLI script to backfill images for active listings that have empty image arrays.

**Architecture:** A shared image scraper module calls platform-specific detail scrapers (BaT via cheerio, ClassicCom via Playwright, BeForward via cheerio) to extract images from listing URLs. A Vercel cron processes ~50/day; a CLI script handles the initial bulk backfill. ClassicCom and BeForward already have `backfill.ts` modules we'll reuse.

**Tech Stack:** TypeScript, Cheerio, Playwright (ClassicCom only), Supabase, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-03-17-image-backfill-design.md`

---

### Task 1: Create BaT image-only scraper function

BaT is the biggest offender (4,930 missing, ~93%). The existing `scrapeDetail` in `bringATrailer.ts` extracts images but also extracts description, specs, etc. We need a lightweight function that ONLY fetches images from a BaT URL.

**Files:**
- Create: `src/features/scrapers/auctions/bringATrailerImages.ts`
- Create: `src/features/scrapers/auctions/bringATrailerImages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scrapers/auctions/bringATrailerImages.test.ts`:

```typescript
import { describe, it, expect } from "vitest";
import { extractBaTImages } from "./bringATrailerImages";

describe("extractBaTImages", () => {
  it("extracts gallery images from BaT HTML", () => {
    const html = `
      <html><body>
        <div class="gallery">
          <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg" width="620" />
          <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo2.jpg" width="620" />
        </div>
        <div class="related-listings">
          <img src="https://bringatrailer.com/wp-content/uploads/2024/01/unrelated.jpg" width="620" />
        </div>
        <img src="/wp-includes/icon.png" width="16" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toEqual([
      "https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg",
      "https://bringatrailer.com/wp-content/uploads/2024/01/photo2.jpg",
    ]);
  });

  it("extracts content images with CDN URLs", () => {
    const html = `
      <html><body>
        <img src="https://cdn.bringatrailer.com/uploads/photo1.jpg" width="800" />
        <img src="https://cdn.bringatrailer.com/uploads/photo2.jpg" width="800" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toHaveLength(2);
  });

  it("filters out small thumbnails and icons", () => {
    const html = `
      <html><body>
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/big.jpg" width="620" />
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/thumb.jpg?resize=235" width="235" />
        <img src="https://bringatrailer.com/wp-content/uploads/icon.jpg" width="50" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toEqual([
      "https://bringatrailer.com/wp-content/uploads/2024/01/big.jpg",
    ]);
  });

  it("deduplicates URLs", () => {
    const html = `
      <html><body>
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg" width="620" />
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg" width="620" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toHaveLength(1);
  });

  it("returns empty array for pages with no gallery images", () => {
    const html = `<html><body><p>No images here</p></body></html>`;
    const images = extractBaTImages(html);
    expect(images).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/auctions/bringATrailerImages.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `src/features/scrapers/auctions/bringATrailerImages.ts`:

```typescript
import * as cheerio from "cheerio";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Extract gallery image URLs from BaT HTML.
 * Replicates the image logic from bringATrailer.ts:scrapeDetail (lines 730-770)
 * without all the other field extraction overhead.
 */
export function extractBaTImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images: string[] = [];

  $("img").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";

    const isContentImage =
      src.includes("wp-content/uploads") ||
      src.includes("cdn.bringatrailer.com");
    const isGalleryImage =
      $(el).closest('.gallery, .carousel, [class*="gallery"]').length > 0;

    if (
      (!isContentImage && !isGalleryImage) ||
      !/\.(jpg|jpeg|png|webp)/i.test(src)
    ) {
      return;
    }

    // Skip tiny thumbnails and icons
    if (
      src.includes("resize=235") ||
      src.includes("resize=144") ||
      src.includes("icon")
    ) {
      return;
    }

    // Skip images in related sections
    const $parent = $(el).closest(
      '.related-listings, .recent-listings, .sidebar, .footer, [class*="related"]'
    );
    if ($parent.length > 0) return;

    // Skip small images
    const width = $(el).attr("width");
    if (width && parseInt(width) < 300) return;

    if (!images.includes(src)) {
      images.push(src);
    }
  });

  return images;
}

/**
 * Fetch a BaT listing URL and extract only image URLs.
 */
export async function fetchBaTImages(url: string): Promise<string[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const html = await response.text();
    return extractBaTImages(html);
  } finally {
    clearTimeout(timeoutId);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/auctions/bringATrailerImages.test.ts`
Expected: All 5 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/auctions/bringATrailerImages.ts src/features/scrapers/auctions/bringATrailerImages.test.ts
git commit -m "feat(scrapers): add BaT image-only extraction module"
```

---

### Task 2: Create unified image backfill core module

This module orchestrates image backfilling across all platforms. It queries Supabase for active listings with empty images, dispatches to the appropriate scraper, and writes results back.

**Files:**
- Create: `src/features/scrapers/common/backfillImages.ts`
- Create: `src/features/scrapers/common/backfillImages.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/features/scrapers/common/backfillImages.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

describe("backfillImages module", () => {
  it("exports backfillImagesForSource function", async () => {
    const mod = await import("./backfillImages");
    expect(typeof mod.backfillImagesForSource).toBe("function");
  });

  it("returns error when Supabase env vars are missing", async () => {
    // Temporarily remove env vars
    const origUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const origKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "BaT",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 5000,
    });

    expect(result.errors).toContain("Missing Supabase env vars");
    expect(result.discovered).toBe(0);

    // Restore
    if (origUrl) process.env.NEXT_PUBLIC_SUPABASE_URL = origUrl;
    if (origKey) process.env.SUPABASE_SERVICE_ROLE_KEY = origKey;
  });
});
```

> Note: Full integration testing of the Supabase query + scrape + update cycle is done in Task 5 (end-to-end test with real data). Unit tests here focus on module exports and error handling.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write implementation**

Create `src/features/scrapers/common/backfillImages.ts`:

```typescript
import { createClient } from "@supabase/supabase-js";

export interface BackfillResult {
  source: string;
  discovered: number;
  backfilled: number;
  errors: string[];
  durationMs: number;
}

export interface BackfillOptions {
  source: "BaT" | "BeForward" | "AutoScout24" | "all";
  maxListings?: number;
  delayMs?: number;
  timeBudgetMs?: number;
  dryRun?: boolean;
}

/**
 * Backfill images for active listings from a specific source.
 * Queries listings with empty images, fetches their detail pages,
 * extracts images, and updates the DB.
 */
export async function backfillImagesForSource(
  opts: BackfillOptions
): Promise<BackfillResult> {
  const startMs = Date.now();
  const maxListings = opts.maxListings ?? 50;
  const delayMs = opts.delayMs ?? 2000;
  const timeBudgetMs = opts.timeBudgetMs ?? 280_000;
  const safetyMarginMs = 15_000;

  const result: BackfillResult = {
    source: opts.source,
    discovered: 0,
    backfilled: 0,
    errors: [],
    durationMs: 0,
  };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    result.errors.push("Missing Supabase env vars");
    result.durationMs = Date.now() - startMs;
    return result;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Query active listings with empty images for this source
  let query = client
    .from("listings")
    .select("id,source,source_url")
    .eq("status", "active")
    .or("images.is.null,images.eq.{}");

  if (opts.source !== "all") {
    query = query.eq("source", opts.source);
  }

  const { data: rows, error: fetchErr } = await query
    .order("updated_at", { ascending: true })
    .limit(maxListings);

  if (fetchErr || !rows) {
    result.errors.push(fetchErr?.message ?? "No rows returned");
    result.durationMs = Date.now() - startMs;
    return result;
  }

  result.discovered = rows.length;
  if (rows.length === 0) {
    result.durationMs = Date.now() - startMs;
    return result;
  }

  // Get the image fetcher for each source
  const getImageFetcher = await buildImageFetcherMap();

  for (const row of rows) {
    // Time budget check
    if (Date.now() - startMs > timeBudgetMs - safetyMarginMs) {
      console.log(
        `[backfill-images] Time budget exceeded after ${result.backfilled} backfills`
      );
      break;
    }

    const source = row.source as string;
    const fetcher = getImageFetcher[source];
    if (!fetcher) {
      result.errors.push(`No image fetcher for source: ${source}`);
      continue;
    }

    try {
      // Rate limit
      if (delayMs > 0) {
        await new Promise((r) => setTimeout(r, delayMs));
      }

      const images = await fetcher(row.source_url);

      if (!images || images.length === 0) {
        continue; // No images found — skip, don't update
      }

      if (opts.dryRun) {
        console.log(
          `[backfill-images][dry-run] ${row.id} (${source}): ${images.length} images found`
        );
        result.backfilled++;
        continue;
      }

      const { error: updateErr } = await client
        .from("listings")
        .update({
          images,
          photos_count: images.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateErr) {
        result.errors.push(
          `Update failed for ${row.id}: ${updateErr.message}`
        );
      } else {
        result.backfilled++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Circuit-break on 403/429
      if (/\b(403|429)\b/.test(msg) || /cloudflare/i.test(msg)) {
        result.errors.push(`Circuit-break (${source}): ${msg}`);
        break;
      }

      result.errors.push(`Failed ${row.source_url}: ${msg}`);
    }
  }

  result.durationMs = Date.now() - startMs;
  return result;
}

type ImageFetcher = (url: string) => Promise<string[]>;

const FETCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
};

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: FETCH_HEADERS,
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
  return response.text();
}

async function buildImageFetcherMap(): Promise<Record<string, ImageFetcher>> {
  const { fetchBaTImages } = await import(
    "@/features/scrapers/auctions/bringATrailerImages"
  );

  // AutoScout24: use parseDetailHtml (cheerio-only export) with a simple fetch
  const fetchAutoScout24Images: ImageFetcher = async (url) => {
    const { parseDetailHtml } = await import(
      "@/features/scrapers/autoscout24_collector/detail"
    );
    const html = await fetchHtml(url);
    const detail = parseDetailHtml(html);
    return detail.images ?? [];
  };

  // BeForward: use parseDetailHtml (cheerio-only export) with a simple fetch
  const fetchBeForwardImages: ImageFetcher = async (url) => {
    const { parseDetailHtml } = await import(
      "@/features/scrapers/beforward_porsche_collector/detail"
    );
    const html = await fetchHtml(url);
    const detail = parseDetailHtml(html);
    return detail.images ?? [];
  };

  return {
    BaT: fetchBaTImages,
    AutoScout24: fetchAutoScout24Images,
    BeForward: fetchBeForwardImages,
    // ClassicCom requires Playwright — already handled by its own backfill
    // module in classic_collector/backfill.ts (runs as part of /api/cron/classic)
    // AutoTrader has very few missing (14) — not worth adding
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/features/scrapers/common/backfillImages.test.ts
git commit -m "feat(scrapers): add unified image backfill core module"
```

---

### Task 3: Create Vercel cron endpoint

**Files:**
- Create: `src/app/api/cron/backfill-images/route.ts`
- Modify: `vercel.json` (add cron entry)

- [ ] **Step 1: Create the cron route**

Create `src/app/api/cron/backfill-images/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { backfillImagesForSource } from "@/features/scrapers/common/backfillImages";
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

  await markScraperRunStarted({
    scraperName: "backfill-images",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    // Process BaT first (biggest backlog), then BeForward, then AutoScout24
    const sources = ["BaT", "BeForward", "AutoScout24"] as const;
    const results = [];
    let totalBackfilled = 0;
    let totalDiscovered = 0;
    const allErrors: string[] = [];
    const timeBudgetMs = 270_000; // Leave 30s margin for overhead
    const perSourceBudget = Math.floor(timeBudgetMs / sources.length);

    for (const source of sources) {
      // Check if we still have time
      if (Date.now() - startTime > timeBudgetMs) break;

      const remainingMs = timeBudgetMs - (Date.now() - startTime);
      const budget = Math.min(perSourceBudget, remainingMs);

      const result = await backfillImagesForSource({
        source,
        maxListings: 20,
        delayMs: 2000,
        timeBudgetMs: budget,
      });

      results.push(result);
      totalBackfilled += result.backfilled;
      totalDiscovered += result.discovered;
      allErrors.push(...result.errors);
    }

    await recordScraperRun({
      scraper_name: "backfill-images",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: totalDiscovered,
      written: totalBackfilled,
      errors_count: allErrors.length,
      error_messages: allErrors.length > 0 ? allErrors : undefined,
    });

    await clearScraperRunActive("backfill-images");

    return NextResponse.json({
      success: true,
      runId,
      totalDiscovered,
      totalBackfilled,
      results: results.map((r) => ({
        source: r.source,
        discovered: r.discovered,
        backfilled: r.backfilled,
        errors: r.errors,
        durationMs: r.durationMs,
      })),
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/backfill-images] Error:", error);

    await recordScraperRun({
      scraper_name: "backfill-images",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [
        error instanceof Error ? error.message : "Backfill failed",
      ],
    });

    await clearScraperRunActive("backfill-images");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Backfill failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Add cron entry to vercel.json**

Add to `vercel.json` crons array (after cleanup at 6 AM, before validate at 5:30):

```json
{ "path": "/api/cron/backfill-images", "schedule": "30 6 * * *" }
```

This runs at 6:30 AM UTC daily, after cleanup finishes.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/cron/backfill-images/route.ts vercel.json
git commit -m "feat(cron): add daily image backfill endpoint"
```

---

### Task 4: Create CLI backfill script

**Files:**
- Modify: `scripts/backfill-images.ts` (replace diagnostic script with full backfill)

- [ ] **Step 1: Write the CLI script**

Replace `scripts/backfill-images.ts` (the current file is the diagnostic script from the exploration phase):

```typescript
/**
 * CLI script for bulk image backfill.
 *
 * Usage:
 *   npx tsx scripts/backfill-images.ts
 *   npx tsx scripts/backfill-images.ts --source BaT --limit 100
 *   npx tsx scripts/backfill-images.ts --dry-run
 *   npx tsx scripts/backfill-images.ts --source BaT --delay 3000
 */
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
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

import { createClient } from "@supabase/supabase-js";

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  const opts: {
    source: string;
    limit: number;
    dryRun: boolean;
    delay: number;
  } = {
    source: "all",
    limit: 0, // 0 = no limit
    dryRun: false,
    delay: 2000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--source":
        opts.source = args[++i];
        break;
      case "--limit":
        opts.limit = parseInt(args[++i], 10);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--delay":
        opts.delay = parseInt(args[++i], 10);
        break;
      case "--help":
        console.log(`
Usage: npx tsx scripts/backfill-images.ts [options]

Options:
  --source <name>   Filter by source (BaT, BeForward, AutoScout24, all)
  --limit <n>       Max listings to process (default: all active with empty images)
  --dry-run         Preview without writing to DB
  --delay <ms>      Delay between requests (default: 2000)
  --help            Show this help
        `);
        process.exit(0);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n=== Image Backfill CLI ===`);
  console.log(`Source: ${opts.source}`);
  console.log(`Limit: ${opts.limit || "unlimited"}`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Delay: ${opts.delay}ms\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Count missing
  let countQuery = client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("images", "{}");

  if (opts.source !== "all") {
    countQuery = countQuery.eq("source", opts.source);
  }

  const { count } = await countQuery;
  console.log(`Found ${count ?? 0} active listings with empty images\n`);

  if ((count ?? 0) === 0) {
    console.log("Nothing to do!");
    return;
  }

  // Import the backfill function
  const { backfillImagesForSource } = await import(
    "../src/features/scrapers/common/backfillImages"
  );

  // For "all" mode, process each source separately
  const sources =
    opts.source === "all"
      ? ["BaT", "BeForward", "AutoScout24"]
      : [opts.source];

  let grandTotal = 0;
  let grandBackfilled = 0;
  let grandErrors = 0;

  for (const source of sources) {
    console.log(`\n--- Processing ${source} ---`);

    const result = await backfillImagesForSource({
      source: source as any,
      maxListings: opts.limit || 10_000,
      delayMs: opts.delay,
      timeBudgetMs: 24 * 60 * 60 * 1000, // No real time limit for CLI
      dryRun: opts.dryRun,
    });

    grandTotal += result.discovered;
    grandBackfilled += result.backfilled;
    grandErrors += result.errors.length;

    console.log(`  Discovered: ${result.discovered}`);
    console.log(`  Backfilled: ${result.backfilled}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Duration: ${result.durationMs}ms`);

    if (result.errors.length > 0) {
      console.log(`  Error details:`);
      for (const err of result.errors.slice(0, 10)) {
        console.log(`    - ${err}`);
      }
      if (result.errors.length > 10) {
        console.log(`    ... and ${result.errors.length - 10} more`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total discovered: ${grandTotal}`);
  console.log(`Total backfilled: ${grandBackfilled}`);
  console.log(`Total errors: ${grandErrors}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 2: Test the script with --dry-run and --limit 2**

Run: `npx tsx scripts/backfill-images.ts --source BaT --limit 2 --dry-run`
Expected: Shows 2 BaT listings, reports images found without writing to DB

- [ ] **Step 3: Commit**

```bash
git add scripts/backfill-images.ts
git commit -m "feat(scripts): add CLI image backfill script"
```

---

### Task 5: End-to-end test with real data

- [ ] **Step 1: Run backfill for 5 BaT listings (real data)**

Run: `npx tsx scripts/backfill-images.ts --source BaT --limit 5 --delay 3000`
Expected: Should show images discovered and written for active BaT listings

- [ ] **Step 2: Verify in Supabase that images were updated**

Run: `npx tsx scripts/check-missing-images.ts`
Expected: Total missing should decrease by ~5 (the ones we just backfilled)

- [ ] **Step 3: Test the cron endpoint locally**

Run: `curl -H "Authorization: Bearer $(grep CRON_SECRET .env.local | cut -d= -f2)" http://localhost:3000/api/cron/backfill-images`
Expected: JSON response with success=true and backfill results

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(backfill-images): complete image backfill system with cron + CLI"
```
