# Photo Coverage Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise gallery photo coverage per active listing for Elferspot (42% at ≤1 photo), Classic.com (100% at exactly 1 photo) and BeForward (~70% at 0 photos), so car cards and detail pages display rich galleries instead of a single hero image.

**Architecture:** Each source has its own scraper under `src/features/scrapers/<source>_collector/` that writes `listings.images` (text[]) at discovery + an enrichment/backfill cron under `src/app/api/cron/` that refills missing galleries. Root causes per source:
- **Elferspot:** no dedicated photo re-check cron; listings that got a description during enrichment but had their gallery fall back to the single `thumbnailUrl` are never revisited.
- **Classic.com:** detail parser at `classic_collector/detail.ts` only captures images whose `src` already contains `images.classic.com/vehicles/` — lazy-loaded gallery slides (which use `data-src`/`data-lazy`) are ignored, and the backfill query excludes listings that already have ≥1 image.
- **BeForward:** backfill query excludes listings with ≥1 photo and `maxListings=20` per run is too low for the 12k+ backlog.

Fixes extend each backfill to also target `photos_count < 2` (not only `images IS NULL/{}`), introduce a new `backfill-photos-elferspot` cron, broaden Classic.com's detail selectors, and raise BeForward's per-run budget.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Supabase JS client, cheerio (HTML parsing), Playwright (Classic.com only), Vitest.

---

## File Structure

### New files
- `src/app/api/cron/backfill-photos-elferspot/route.ts` — dedicated Elferspot photo re-check cron.
- `src/app/api/cron/backfill-photos-elferspot/route.test.ts` — happy path + error path tests for the new cron.
- `tests/fixtures/classic-com-gallery.html` — recorded HTML fixture of a real Classic.com detail page with a multi-image gallery (used for deterministic selector tests).

### Modified files
- `src/features/scrapers/classic_collector/detail.ts` — broaden image extraction to include `data-src`/`data-lazy-src` and URLs whose host is `classic.com`/`images.classic.com` regardless of path prefix.
- `src/features/scrapers/classic_collector/detail.test.ts` — add test covering the fixture above (asserting N>1 images extracted).
- `src/features/scrapers/classic_collector/backfill.ts` — expand query to include `photos_count < 2` in addition to empty images.
- `src/features/scrapers/classic_collector/backfill.test.ts` — add coverage for the `photos_count<2` branch.
- `src/features/scrapers/beforward_porsche_collector/backfill.ts` — same query expansion (include `photos_count < 2`); raise default `maxListings` to 60.
- `src/features/scrapers/beforward_porsche_collector/backfill.test.ts` — add coverage for the new branch.
- `src/features/scrapers/common/backfillImages.ts` — extend the empty-images query to also target `photos_count < 2` for BaT/AutoScout24/BeForward when called from the shared cron.
- `src/features/scrapers/common/backfillImages.test.ts` — add coverage for the new branch.
- `src/app/api/cron/backfill-images/route.ts` — raise BeForward's `maxListings` to 60 (keep BaT/AS24 at 20).
- `vercel.json` — register the new `backfill-photos-elferspot` cron schedule.

---

## Task 1: Broaden empty-images query to also target `photos_count < 2` in the shared backfill helper

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts:55-68`
- Test: `src/features/scrapers/common/backfillImages.test.ts`

- [ ] **Step 1: Read the current test file to understand its mocking style**

Run: `cat src/features/scrapers/common/backfillImages.test.ts | head -150`
Note the pattern used to mock the Supabase client (inline `vi.fn()` chain or a helper).

- [ ] **Step 2: Write the failing test**

Add this test to `src/features/scrapers/common/backfillImages.test.ts`:

```ts
it("selects listings with photos_count < 2 in addition to empty images", async () => {
  const orCalls: string[] = [];
  const mockClient = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(function self(this: unknown) { return this; }),
        or: vi.fn((expr: string) => {
          orCalls.push(expr);
          return {
            eq: vi.fn(function self(this: unknown) { return this; }),
            order: vi.fn(() => ({ limit: vi.fn(async () => ({ data: [], error: null })) })),
          };
        }),
      })),
      update: vi.fn(),
    })),
  };
  vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);

  await backfillImagesForSource({ source: "BaT", maxListings: 1 });

  expect(orCalls.some((e) =>
    e.includes("images.is.null") && e.includes("images.eq.{}") && e.includes("photos_count")
  )).toBe(true);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: FAIL — "expected false to be true" because current code only passes `images.is.null,images.eq.{}`.

- [ ] **Step 4: Update the query**

In `src/features/scrapers/common/backfillImages.ts`, change the `.or(...)` at line 60 from:

```ts
  .or("images.is.null,images.eq.{}");
```

to:

```ts
  .or("images.is.null,images.eq.{},photos_count.lt.2");
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: PASS (all tests, including the new one).

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/features/scrapers/common/backfillImages.test.ts
git commit -m "fix(backfill): also target listings with photos_count < 2 in shared helper"
```

---

## Task 2: Apply the same query expansion to BeForward's dedicated backfill + raise per-run budget

**Files:**
- Modify: `src/features/scrapers/beforward_porsche_collector/backfill.ts:24,46-53`
- Test: `src/features/scrapers/beforward_porsche_collector/backfill.test.ts`

- [ ] **Step 1: Write the failing test**

Add this test to `src/features/scrapers/beforward_porsche_collector/backfill.test.ts`:

```ts
it("queries listings with photos_count < 2 in addition to empty images", async () => {
  const orCalls: string[] = [];
  const mockClient = buildMockClient({ rows: [] }); // reuse existing helper in this file
  mockClient._orCalls = orCalls;
  // Replace the .or() inside the mock's query chain so it records its argument.
  // (See top of this file for the buildMockClient definition; add a passthrough
  //  that pushes the expression into orCalls before returning the chain.)

  await backfillMissingImages({ timeBudgetMs: 5_000, runId: "test" });

  expect(orCalls.some((e) =>
    e.includes("images.is.null") && e.includes("images.eq.{}") && e.includes("photos_count.lt.2")
  )).toBe(true);
});
```

If `buildMockClient` does not exist in the test file yet, define it at the top by refactoring the repeated `createClient` mock setup into one helper. Keep the new test's mock shape identical to the existing ones (same `from → select → eq → eq → or → order → limit` chain).

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/backfill.test.ts`
Expected: FAIL — `orCalls` never sees `photos_count.lt.2`.

- [ ] **Step 3: Update the query and bump maxListings default**

In `src/features/scrapers/beforward_porsche_collector/backfill.ts`:

Change line 24:
```ts
  const maxListings = opts.maxListings ?? 20;
```
to:
```ts
  const maxListings = opts.maxListings ?? 60;
```

Change line 51:
```ts
    .or("images.is.null,images.eq.{}")
```
to:
```ts
    .or("images.is.null,images.eq.{},photos_count.lt.2")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/beforward_porsche_collector/backfill.test.ts`
Expected: PASS.

- [ ] **Step 5: Raise BeForward's per-source budget in the shared cron**

In `src/app/api/cron/backfill-images/route.ts`, replace the single `maxListings: 20` (line 53) with a per-source map so BeForward gets 60 and the others stay at 20:

```ts
const MAX_LISTINGS_BY_SOURCE: Record<"BaT" | "BeForward" | "AutoScout24", number> = {
  BaT: 20,
  BeForward: 60,
  AutoScout24: 20,
};

// ...inside the for-loop:
const result = await backfillImagesForSource({
  source,
  maxListings: MAX_LISTINGS_BY_SOURCE[source],
  delayMs: 2000,
  timeBudgetMs: budget,
});
```

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/beforward_porsche_collector/backfill.ts \
        src/features/scrapers/beforward_porsche_collector/backfill.test.ts \
        src/app/api/cron/backfill-images/route.ts
git commit -m "fix(beforward): broaden backfill query to photos_count<2 and raise per-run budget"
```

---

## Task 3: Record a real Classic.com detail-page HTML fixture for deterministic selector testing

**Files:**
- Create: `tests/fixtures/classic-com-gallery.html`

- [ ] **Step 1: Pick a live Classic.com listing URL known to have a multi-photo gallery**

Pick the most recently scraped row from the DB (service-role key required, loaded from `.env.local`):

```bash
set -a && source .env.local && set +a && node -e "
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
c.from('listings').select('id,source_url,photos_count').eq('source','ClassicCom').eq('status','active').order('scrape_timestamp', { ascending: false }).limit(5).then(r => console.log(JSON.stringify(r.data, null, 2)));
"
```

Pick the first URL from the output. If every returned row has `photos_count = 1`, that is expected — we still want that page's HTML to diagnose the gallery.

- [ ] **Step 2: Save the rendered HTML to the fixtures directory**

Create the directory if it does not exist, then fetch:

```bash
mkdir -p tests/fixtures
curl -sSL \
  -H "User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  "<URL from step 1>" \
  > tests/fixtures/classic-com-gallery.html
```

- [ ] **Step 3: Verify the fixture contains multiple image references**

Run: `grep -o 'images\.classic\.com/vehicles/[^"'"'"']*' tests/fixtures/classic-com-gallery.html | sort -u | wc -l`
Expected: a number ≥ 2 (indicates the page does contain a gallery, just behind lazy-loading attrs).

Also run: `grep -oE '(data-src|data-lazy[-a-z]*|data-zoom-image)="[^"]*"' tests/fixtures/classic-com-gallery.html | head -30`
Record which attribute(s) hold the gallery URLs — you will use it in Task 4.

If `grep` returns zero URLs, the page uses client-side rendering only and this diagnostic/cheerio-based fix cannot work as designed. **Stop the plan** and escalate: the fix would need to move into `classic_collector/backfill.ts` (Playwright) instead of `detail.ts` (cheerio). Report findings before continuing.

- [ ] **Step 4: Commit the fixture**

```bash
git add tests/fixtures/classic-com-gallery.html
git commit -m "test(classic): add real detail-page HTML fixture for gallery selector work"
```

---

## Task 4: Broaden Classic.com detail parser to capture lazy-loaded gallery images

**Files:**
- Modify: `src/features/scrapers/classic_collector/detail.ts:126-145`
- Test: `src/features/scrapers/classic_collector/detail.test.ts`

- [ ] **Step 1: Write the failing test against the new fixture**

Add to `src/features/scrapers/classic_collector/detail.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

it("extracts multiple gallery images from a real Classic.com detail page", () => {
  const html = readFileSync(resolve(__dirname, "../../../../tests/fixtures/classic-com-gallery.html"), "utf-8");
  const parsed = parseDetailHtml(html); // export name from detail.ts — verify before writing

  expect(parsed.images.length).toBeGreaterThan(1);
  for (const url of parsed.images) {
    expect(url).toMatch(/^https?:\/\/[^/]*classic\.com\//);
  }
});
```

If `parseDetailHtml` is not currently exported from `detail.ts`, export it (it already exists as an internal helper — flip `function parseDetailHtml` to `export function parseDetailHtml`).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/features/scrapers/classic_collector/detail.test.ts`
Expected: FAIL with "expected 1 to be greater than 1" (current parser only finds the one eager-loaded hero image).

- [ ] **Step 3: Update the image-extraction block**

In `src/features/scrapers/classic_collector/detail.ts`, replace the block at lines 126-137:

```ts
// --- Images (only vehicle photos from images.classic.com) ---
const images: string[] = [];
const seen = new Set<string>();
$("img").each((_i, el) => {
  const src = $(el).attr("src") ?? "";
  if (src.includes("images.classic.com/vehicles/") && !seen.has(src)) {
    seen.add(src);
    images.push(src);
  }
});
```

with:

```ts
// --- Images ---
// Gallery slides on classic.com are lazy-loaded: the eager <img src=...>
// only ever holds the hero, the rest sit on data-src/data-lazy-src/data-zoom-image
// until they scroll into view. Read every image-bearing attribute and keep any
// URL hosted on *.classic.com.
const images: string[] = [];
const seen = new Set<string>();
const IMAGE_ATTRS = ["src", "data-src", "data-lazy-src", "data-lazy", "data-zoom-image"] as const;

$("img, source").each((_i, el) => {
  for (const attr of IMAGE_ATTRS) {
    const raw = $(el).attr(attr);
    if (!raw) continue;
    // <source srcset="..."> may hold multiple candidates — take the first.
    const firstCandidate = raw.split(",")[0]?.trim().split(/\s+/)[0];
    if (!firstCandidate) continue;

    let url: URL;
    try {
      url = new URL(firstCandidate, "https://classic.com");
    } catch {
      continue;
    }

    if (!/\bclassic\.com$/.test(url.hostname)) continue;
    if (!/\.(jpe?g|png|webp|avif)(\?|$)/i.test(url.pathname)) continue;

    const normalized = url.toString();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    images.push(normalized);
  }
});
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/features/scrapers/classic_collector/detail.test.ts`
Expected: PASS. Also re-run the full test file to confirm no existing assertion broke.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/classic_collector/detail.ts src/features/scrapers/classic_collector/detail.test.ts
git commit -m "fix(classic): extract lazy-loaded gallery images via data-src attrs"
```

---

## Task 5: Expand Classic.com's backfill query to include `photos_count < 2`

**Files:**
- Modify: `src/features/scrapers/classic_collector/backfill.ts:44-52`
- Test: `src/features/scrapers/classic_collector/backfill.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/scrapers/classic_collector/backfill.test.ts` (reuse the existing `createClient` mock pattern at the top of the file — search for `vi.mock("@supabase/supabase-js"` in this same file and mirror its setup):

```ts
it("queries listings with photos_count < 2 in addition to empty images", async () => {
  const orCalls: string[] = [];
  // The existing helper (see earlier tests in this file) must capture .or() arguments;
  // if not, extend it so `orCalls` receives the expression string.
  await backfillMissingImages({
    page: makeMockPage(), // existing helper at top of file
    timeBudgetMs: 5_000,
    runId: "test",
  });

  expect(orCalls.some((e) =>
    e.includes("images.is.null") && e.includes("images.eq.{}") && e.includes("photos_count.lt.2")
  )).toBe(true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/classic_collector/backfill.test.ts`
Expected: FAIL — current query passes only `images.is.null,images.eq.{}`.

- [ ] **Step 3: Update the query**

In `src/features/scrapers/classic_collector/backfill.ts` line 50, replace:

```ts
    .or("images.is.null,images.eq.{}")
```

with:

```ts
    .or("images.is.null,images.eq.{},photos_count.lt.2")
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/classic_collector/backfill.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/classic_collector/backfill.ts src/features/scrapers/classic_collector/backfill.test.ts
git commit -m "fix(classic): backfill re-checks listings with photos_count<2"
```

---

## Task 6: Add a dedicated Elferspot photo backfill cron

**Files:**
- Create: `src/app/api/cron/backfill-photos-elferspot/route.ts`
- Create: `src/app/api/cron/backfill-photos-elferspot/route.test.ts`

- [ ] **Step 1: Read the existing Elferspot enrichment route for reference**

Run: `cat src/app/api/cron/enrich-elferspot/route.ts`
Note: the new route mirrors its auth/monitoring/rate-limit scaffolding but swaps the query + update payload.

- [ ] **Step 2: Write the failing integration test**

Create `src/app/api/cron/backfill-photos-elferspot/route.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "./route";

vi.mock("@supabase/supabase-js", () => ({ createClient: vi.fn() }));
vi.mock("@/features/scrapers/elferspot_collector/detail", () => ({
  fetchDetailPage: vi.fn(),
}));
vi.mock("@/features/scrapers/common/monitoring", () => ({
  markScraperRunStarted: vi.fn(async () => undefined),
  recordScraperRun: vi.fn(async () => undefined),
  clearScraperRunActive: vi.fn(async () => undefined),
}));

import { createClient } from "@supabase/supabase-js";
import { fetchDetailPage } from "@/features/scrapers/elferspot_collector/detail";

const CRON_SECRET = "test-secret";

beforeEach(() => {
  vi.clearAllMocks();
  process.env.CRON_SECRET = CRON_SECRET;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
});

function buildRequest() {
  return new Request("https://example.com/api/cron/backfill-photos-elferspot", {
    headers: { authorization: `Bearer ${CRON_SECRET}` },
  });
}

it("rejects unauthorized requests", async () => {
  const res = await GET(new Request("https://example.com"));
  expect(res.status).toBe(401);
});

it("updates images for listings returned by the query", async () => {
  const updateArgs: unknown[] = [];
  const mockClient = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(function self(this: unknown) { return this; }),
        or: vi.fn(function self(this: unknown) { return this; }),
        order: vi.fn(() => ({
          limit: vi.fn(async () => ({
            data: [{ id: "row-1", source_url: "https://elferspot.com/en/ad/1" }],
            error: null,
          })),
        })),
      })),
      update: vi.fn((payload: unknown) => {
        updateArgs.push(payload);
        return { eq: vi.fn(async () => ({ error: null })) };
      }),
    })),
  };
  vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);
  vi.mocked(fetchDetailPage).mockResolvedValueOnce({
    images: ["https://cdn.elferspot.com/a.jpg", "https://cdn.elferspot.com/b.jpg"],
  } as unknown as Awaited<ReturnType<typeof fetchDetailPage>>);

  const res = await GET(buildRequest());
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.success).toBe(true);
  expect(body.backfilled).toBe(1);
  expect(updateArgs[0]).toMatchObject({
    images: ["https://cdn.elferspot.com/a.jpg", "https://cdn.elferspot.com/b.jpg"],
    photos_count: 2,
  });
});

it("skips listings whose detail returns 0 or 1 images", async () => {
  const updates: unknown[] = [];
  const mockClient = {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(function self(this: unknown) { return this; }),
        or: vi.fn(function self(this: unknown) { return this; }),
        order: vi.fn(() => ({
          limit: vi.fn(async () => ({
            data: [{ id: "row-1", source_url: "https://elferspot.com/en/ad/1" }],
            error: null,
          })),
        })),
      })),
      update: vi.fn((payload: unknown) => {
        updates.push(payload);
        return { eq: vi.fn(async () => ({ error: null })) };
      }),
    })),
  };
  vi.mocked(createClient).mockReturnValue(mockClient as unknown as ReturnType<typeof createClient>);
  vi.mocked(fetchDetailPage).mockResolvedValueOnce({ images: ["only-one.jpg"] } as unknown as Awaited<ReturnType<typeof fetchDetailPage>>);

  const res = await GET(buildRequest());
  const body = await res.json();

  expect(res.status).toBe(200);
  expect(body.backfilled).toBe(0);
  expect(updates).toHaveLength(0);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/backfill-photos-elferspot/route.test.ts`
Expected: FAIL — the `./route` import is missing.

- [ ] **Step 4: Implement the route**

Create `src/app/api/cron/backfill-photos-elferspot/route.ts`:

```ts
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchDetailPage } from "@/features/scrapers/elferspot_collector/detail";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const DELAY_MS = 2_500;
const TIME_BUDGET_MS = 270_000;
const MAX_LISTINGS = 80;

export async function GET(request: Request) {
  const startTime = Date.now();
  const startedAtIso = new Date(startTime).toISOString();
  const runId = crypto.randomUUID();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ success: false, error: "Missing Supabase env vars" }, { status: 500 });
  }

  await markScraperRunStarted({
    scraperName: "backfill-photos-elferspot",
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
      .eq("source", "Elferspot")
      .eq("status", "active")
      .or("images.is.null,images.eq.{},photos_count.lt.2")
      .order("updated_at", { ascending: true })
      .limit(MAX_LISTINGS);

    if (fetchErr || !rows) throw new Error(fetchErr?.message ?? "No rows returned");

    const discovered = rows.length;
    let backfilled = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      if (Date.now() - startTime > TIME_BUDGET_MS) {
        errors.push(`Time budget reached after ${backfilled} backfills`);
        break;
      }
      if (i > 0) await new Promise((r) => setTimeout(r, DELAY_MS));

      const row = rows[i];
      try {
        const detail = await fetchDetailPage(row.source_url);
        const images = detail?.images ?? [];

        // Only overwrite when we have MORE than the single thumbnail fallback.
        if (images.length < 2) continue;

        const { error: updateErr } = await client
          .from("listings")
          .update({
            images,
            photos_count: images.length,
            updated_at: new Date().toISOString(),
          })
          .eq("id", row.id);

        if (updateErr) errors.push(`Update failed (${row.id}): ${updateErr.message}`);
        else backfilled++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (/\b(404|410)\b/.test(msg)) {
          await client
            .from("listings")
            .update({ status: "delisted", updated_at: new Date().toISOString() })
            .eq("id", row.id);
          errors.push(`Delisted (${row.id}): ${msg}`);
          continue;
        }
        if (/\b(403|429)\b/.test(msg)) {
          errors.push(`Circuit-break: ${msg}`);
          break;
        }
        errors.push(`Failed ${row.source_url}: ${msg}`);
      }
    }

    await recordScraperRun({
      scraper_name: "backfill-photos-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written: backfilled,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
    await clearScraperRunActive("backfill-photos-elferspot");

    return NextResponse.json({
      success: true,
      runId,
      discovered,
      backfilled,
      errors,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    await recordScraperRun({
      scraper_name: "backfill-photos-elferspot",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Backfill failed"],
    });
    await clearScraperRunActive("backfill-photos-elferspot");
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Backfill failed" },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/backfill-photos-elferspot/route.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 6: Commit**

```bash
git add src/app/api/cron/backfill-photos-elferspot/
git commit -m "feat(cron): add backfill-photos-elferspot route for gallery re-checks"
```

---

## Task 7: Schedule the Elferspot photo-backfill cron

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Inspect the current cron schedule**

Run: `cat vercel.json`
Note: the existing crons (`enrich-elferspot`, `backfill-images`, etc.) — pick a slot that does not overlap with `enrich-elferspot` to avoid hammering the Elferspot origin.

- [ ] **Step 2: Add a schedule entry**

Add a new object to the `crons` array in `vercel.json`. Pattern — pick a time that is ≥15 minutes away from any existing Elferspot cron:

```json
{
  "path": "/api/cron/backfill-photos-elferspot",
  "schedule": "25 */6 * * *"
}
```

(Every 6 hours at :25 past the hour. Adjust if it collides with an existing entry.)

- [ ] **Step 3: Validate the JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json','utf-8'))"`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "chore(cron): schedule backfill-photos-elferspot every 6h"
```

---

## Task 8: Production verification — confirm coverage improves after one cron cycle

**Files:** (none — this is a DB read sanity check, not code)

- [ ] **Step 1: Record current baseline counts**

```bash
set -a && source .env.local && set +a && node -e "
const { createClient } = require('@supabase/supabase-js');
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
(async () => {
  for (const src of ['Elferspot','ClassicCom','BeForward']) {
    const { count: lowPhotos } = await c.from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('source', src).eq('status','active').lt('photos_count', 2);
    const { count: total } = await c.from('listings')
      .select('id', { count: 'exact', head: true })
      .eq('source', src).eq('status','active');
    console.log(src, 'active:', total, 'with <2 photos:', lowPhotos, '(' + (100*lowPhotos/total).toFixed(1) + '%)');
  }
})();
"
```

Save the output as the baseline.

- [ ] **Step 2: Trigger each cron manually after deployment**

After the PR merges and Vercel redeploys, trigger each cron with the bearer token. Replace `<CRON_SECRET>` with the value from Vercel env:

```bash
curl -H "Authorization: Bearer <CRON_SECRET>" https://<prod-domain>/api/cron/backfill-photos-elferspot
curl -H "Authorization: Bearer <CRON_SECRET>" https://<prod-domain>/api/cron/classic
curl -H "Authorization: Bearer <CRON_SECRET>" https://<prod-domain>/api/cron/backfill-images
```

Record the JSON response from each (`{ discovered, backfilled, errors }`).

- [ ] **Step 3: Re-run the baseline query**

Re-run the Step 1 command and diff the percentages against the baseline. Expected directional outcome per source:

| Source | Before | Expected after 1 cycle |
|---|---|---|
| ClassicCom | ~100% at <2 photos | ↓ by at least the `backfilled` count reported in step 2 |
| Elferspot | ~42% at ≤1 photo | ↓ by at least the `backfilled` count reported in step 2 |
| BeForward | ~70% at 0 photos | ↓ by at least the `backfilled` count reported in step 2 |

If any source shows `backfilled=0` with a non-zero `discovered`, inspect the `errors` array in the JSON response. Common failure modes and the task they point to:
- "Rate limited (3/3)" → backoff + retry later, or lower `maxListings`.
- "No images extracted" for ClassicCom → the fixture-based fix in Task 4 did not cover the live page layout; widen selectors further.
- "fetchDetailPage failed" for Elferspot → check whether Elferspot changed its HTML (re-record the fixture used by `elferspot_collector/detail.test.ts`).

- [ ] **Step 4: Record findings**

Paste the baseline, trigger response, and post-run numbers into the PR description so reviewers can see the impact.

---

## Self-Review Notes

- **Spec coverage:**
  - Elferspot (42% ≤1 photo): Tasks 6 + 7 (new route + schedule).
  - Classic.com (100% = 1 photo): Tasks 3, 4, 5 (fixture → selector fix → backfill query).
  - BeForward (70% = 0 photos): Tasks 1 + 2 (shared helper + dedicated backfill + cron budget).
  - All three verified in Task 8.
- **Known risk — Classic.com SSR:** Task 3 step 3 explicitly stops the plan if the fixture shows the page is client-rendered only, because the rest of Task 4 assumes cheerio can see gallery URLs.
- **Out of scope:** AutoTrader (avg 4, comment in `common/backfillImages.ts` says "not worth adding"); BaT/AutoScout24 already have healthy coverage.
