# Dead URL Delisting Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** When a listing's source URL returns 404/410 (removed from marketplace), mark it as `unsold` instead of leaving it `active` with a dead image sentinel.

**Architecture:** Two changes: (1) `backfillImages.ts` sets `status = 'unsold'` alongside `images = ['__dead_url__']` on 404/410, (2) a new cleanup step in `cron/cleanup` retroactively marks existing `__dead_url__` listings as `unsold`. We use `unsold` (not `delisted`) because the existing cleanup step already uses `unsold` for expired listings without bids — same semantic: the car left the marketplace without a confirmed sale.

**Tech Stack:** TypeScript, Supabase, Vitest

---

## Context

### The Problem

When backfill-images fetches a listing's source URL and gets 404/410, it currently:
1. Sets `images = ['__dead_url__']` to stop re-querying
2. **Does NOT change `status`** — the listing stays `active`
3. The listing remains in the frontend feed with broken/missing images indefinitely

Last night's run hit 12 dead BeForward URLs and 10 dead AutoScout24 URLs — all still showing as `active`.

### The Fix

Two-part fix:
1. **Forward fix** — `backfillImages.ts`: on 404/410, also set `status = 'unsold'`
2. **Retroactive fix** — `cron/cleanup`: new Step 1c that finds existing `__dead_url__` listings still marked `active` and sets them to `unsold`

### Files

| File | Action | Purpose |
|------|--------|---------|
| `src/features/scrapers/common/backfillImages.ts:146-154` | Modify | Add `status: 'unsold'` to the 404/410 update |
| `src/features/scrapers/common/backfillImages.test.ts` | Modify | Add test for dead URL → unsold behavior |
| `src/app/api/cron/cleanup/route.ts:183` | Modify | Add Step 1c: mark `__dead_url__` listings as unsold |
| `src/app/api/cron/cleanup/route.test.ts` | Modify | Add test for dead URL cleanup step |

---

### Task 1: Update backfillImages to mark dead URLs as unsold

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts:146-154`
- Test: `src/features/scrapers/common/backfillImages.test.ts`

- [ ] **Step 1: Write the failing test**

Replace the entire file `src/features/scrapers/common/backfillImages.test.ts` with:

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock Supabase
const mockUpdate = vi.fn();
const mockLimit = vi.fn();

vi.mock("@supabase/supabase-js", () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockReturnValue({
          or: vi.fn().mockReturnValue({
            order: vi.fn().mockReturnValue({
              limit: mockLimit,
            }),
          }),
        }),
      }),
      update: mockUpdate,
    })),
  })),
}));

// Mock scraper detail modules (required by buildImageFetcherMap)
vi.mock("@/features/scrapers/auctions/bringATrailerImages", () => ({
  fetchBaTImages: vi.fn(),
}));
vi.mock("@/features/scrapers/autoscout24_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));
vi.mock("@/features/scrapers/beforward_porsche_collector/detail", () => ({
  parseDetailHtml: vi.fn(),
}));

describe("backfillImages module", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://test.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-key";
  });

  it("exports backfillImagesForSource function", async () => {
    const mod = await import("./backfillImages");
    expect(typeof mod.backfillImagesForSource).toBe("function");
  });

  it("returns error when Supabase env vars are missing", async () => {
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
  });

  it("marks dead URLs as unsold when source returns 404", async () => {
    // Mock global.fetch to return a 404 response.
    // backfillImages calls fetchHtml(url) → fetch(url) → checks response.ok.
    // A 404 causes fetchHtml to throw Error("HTTP 404 for ..."),
    // which matches /\b(404|410)\b/ and triggers the dead URL path.
    vi.spyOn(global, "fetch").mockResolvedValueOnce(
      new Response(null, { status: 404 })
    );

    // Mock: one active listing with no images
    mockLimit.mockResolvedValueOnce({
      data: [{ id: "dead-1", source: "BeForward", source_url: "https://example.com/404" }],
      error: null,
    });

    // Mock: the update call — capture what it receives
    const updateEq = vi.fn().mockResolvedValue({ error: null });
    mockUpdate.mockReturnValue({ eq: updateEq });

    const { backfillImagesForSource } = await import("./backfillImages");
    const result = await backfillImagesForSource({
      source: "BeForward",
      maxListings: 1,
      delayMs: 0,
      timeBudgetMs: 30000,
    });

    // The update should include status: 'unsold'
    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        images: ["__dead_url__"],
        status: "unsold",
      })
    );
    expect(result.errors[0]).toContain("Dead URL");
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: The "marks dead URLs as unsold" test FAILS because the current code only sets `images` but not `status`.

- [ ] **Step 3: Implement the fix in backfillImages.ts**

In `src/features/scrapers/common/backfillImages.ts`, change lines 146-154 from:

```ts
      if (/\b(404|410)\b/.test(msg)) {
        if (!opts.dryRun) {
          await client
            .from("listings")
            .update({
              images: ["__dead_url__"],
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
```

to:

```ts
      if (/\b(404|410)\b/.test(msg)) {
        if (!opts.dryRun) {
          await client
            .from("listings")
            .update({
              images: ["__dead_url__"],
              status: "unsold",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
```

One line added: `status: "unsold",`

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/features/scrapers/common/backfillImages.test.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/features/scrapers/common/backfillImages.test.ts
git commit -m "fix(backfill-images): mark dead URL listings as unsold on 404/410"
```

---

### Task 2: Add cleanup step for existing dead URL listings

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts:183`
- Test: `src/app/api/cron/cleanup/route.test.ts`

- [ ] **Step 1: Update Supabase mock to support `.contains()` chain**

The new Step 1c query uses `.update().eq().contains().select()`. The existing mock chain only supports `.update().eq().lt()...`. Add `.contains()` to the `eqReturn` object.

In `src/app/api/cron/cleanup/route.test.ts`, find the `eqReturn` object inside the mock factory (around line 28-30):

```ts
        const eqReturn = {
          lt: vi.fn().mockReturnValue(ltReturn),
        };
```

Replace with:

```ts
        // contains() is used by Step 1c (dead-url → unsold)
        const containsReturn = {
          select: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        };

        const eqReturn = {
          lt: vi.fn().mockReturnValue(ltReturn),
          contains: vi.fn().mockReturnValue(containsReturn),
        };
```

- [ ] **Step 2: Write the failing test**

Add a new test in `src/app/api/cron/cleanup/route.test.ts` inside the describe block:

```ts
  it("includes deadUrlFixed in response (Step 1c)", async () => {
    const request = new Request("http://localhost:3000/api/cron/cleanup", {
      method: "GET",
      headers: {
        authorization: "Bearer test-secret",
      },
    });

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    // The response should include the deadUrlFixed count
    expect(body).toHaveProperty("deadUrlFixed");
    expect(typeof body.deadUrlFixed).toBe("number");
  });
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run src/app/api/cron/cleanup/route.test.ts`
Expected: FAIL — `body` does not have property `deadUrlFixed` (and possibly TypeError for missing `.contains()` if Step 1 wasn't applied yet)

- [ ] **Step 4: Implement Step 1c in the cleanup route**

The cleanup route has TWO response paths: an early return (line 256) and a normal return (line 323). **Both must include `deadUrlFixed`.**

**4a. Add Step 1c query** — In `src/app/api/cron/cleanup/route.ts`, after line 183 (after the `totalStaleFixed` log), add:

```ts
    // ── Step 1c: Mark __dead_url__ listings as unsold ──
    // Listings whose source URL returned 404/410 during image backfill
    // were marked with images=['__dead_url__'] but kept status='active'.
    // Mark them as 'unsold' so they leave the active feed.
    const { data: deadUrlFixed, error: deadUrlErr } = await supabase
      .from("listings")
      .update({ status: "unsold", updated_at: now })
      .eq("status", "active")
      .contains("images", ["__dead_url__"])
      .select("id");

    if (deadUrlErr) {
      console.error("[cron/cleanup] dead-url→unsold error:", deadUrlErr.message);
    }
    const deadUrlFixedCount = deadUrlFixed?.length ?? 0;
    if (deadUrlFixedCount > 0) {
      console.log(`[cron/cleanup] Marked ${deadUrlFixedCount} dead-URL listings as unsold`);
    }
```

**4b. Update early-return path** (around line 234-264) — Add `deadUrlFixed` to monitoring and response:

In the early-return `earlyMessages` block (line 235-236), add:
```ts
      if (deadUrlFixedCount > 0) earlyMessages.push(`dead-url-unsold: ${deadUrlFixedCount}`);
```

In the early-return `recordScraperRun` call, update `written` and `refresh_updated`:
```ts
      written: totalStaleFixed + reclassified + deadUrlFixedCount,
      refresh_updated: totalStaleFixed + deadUrlFixedCount,
```

In the early-return `NextResponse.json` (line 256), add the field:
```ts
      return NextResponse.json({
        success: true,
        scanned: allListings.length,
        deleted: 0,
        staleFixed: 0,
        deadUrlFixed: deadUrlFixedCount,
        reclassified,
        items: [],
        duration: `${Date.now() - startTime}ms`,
      });
```

**4c. Update normal-return path** (around line 298-334) — Same changes:

In the `allMessages` block (line 298-303), add:
```ts
    if (deadUrlFixedCount > 0) allMessages.push(`dead-url-unsold: ${deadUrlFixedCount}`);
```

In the normal `recordScraperRun` call (line 305-319), update:
```ts
      written: totalStaleFixed + reclassified + deadUrlFixedCount,
      refresh_updated: totalStaleFixed + deadUrlFixedCount,
```

In the normal `NextResponse.json` (line 323), add the field:
```ts
      deadUrlFixed: deadUrlFixedCount,
```
(Add after `staleUnsold: staleUnsoldCount,`)

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run src/app/api/cron/cleanup/route.test.ts`
Expected: ALL tests PASS

- [ ] **Step 6: Run all scraper tests**

Run: `npx vitest run src/features/scrapers/ src/app/api/cron/`
Expected: ALL tests PASS — no regressions

- [ ] **Step 7: Commit**

```bash
git add src/app/api/cron/cleanup/route.ts src/app/api/cron/cleanup/route.test.ts
git commit -m "fix(cleanup): mark existing __dead_url__ listings as unsold"
```

---

### Task 3: Verify with TypeScript and existing tests

- [ ] **Step 1: Type check**

Run: `npx tsc --noEmit`
Expected: No new errors

- [ ] **Step 2: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 3: Final commit (if any adjustments needed)**

---

## Verification

After deployment, the next cron cycle should:
1. **cleanup** (06:00 UTC): Step 1c marks any existing `__dead_url__` + `active` listings as `unsold`. Check the response for `deadUrlFixed > 0`.
2. **backfill-images** (06:30 UTC): Any new 404/410 hits now set `status = 'unsold'` immediately. Dead URL errors should still appear in logs but the listings will no longer be `active`.
3. The frontend feed should stop showing listings with dead source URLs.

## Out of Scope

- **Cars & Bids / Collecting Cars 403s**: These need Playwright (like Classic.com uses) — separate project.
- **BaT scraper**: Already working correctly (discovered 1,030 listings last night).
- **URL liveness checking for classifieds** (proactively pinging source URLs for all active listings): Would be valuable but is a larger effort — filed separately.
