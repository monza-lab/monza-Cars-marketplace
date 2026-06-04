# Porsche BaT Live Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep active Porsche listings from Bring a Trailer fresh by updating current bid, bid count, end time, and terminal status every few minutes after the discovery scraper finds them.

**Architecture:** Add a Porsche collector vertical slice for BaT live refresh. The job queries active Porsche BaT rows from Supabase, fetches each source page with polite pacing, parses live auction fields from rendered BaT HTML, updates only changed listing columns, and writes a price-history point only when the bid changes.

**Tech Stack:** Next.js 16.1.6, TypeScript, Vitest, Supabase JS, Cheerio already present in `dependencies`, GitHub Actions scheduler. New dependencies: 0.

---

## Phase Zero Context

Environment matrix:
- OS: Windows workspace, PowerShell shell.
- Runtime observed locally: Node `v24.5.0`, npm `11.5.2`, pnpm `10.12.4`, Bun unavailable.
- App runtime: Next.js `16.1.6`, React `19.2.3`, TypeScript `^5`.
- Database: Supabase tables already include `listings.current_bid`, `listings.bid_count`, `listings.end_time`, `listings.status`, `listings.final_price`, `listings.hammer_price`, and `price_history`.
- Existing relevant files: `src/features/scrapers/porsche_collector/supabase_writer.ts`, `src/features/scrapers/common/scraper.ts`, `scripts/bat-detail-scraper.ts`, `.github/workflows/bat-detail-scraper.yml`.

Non-functional requirements:
- Latency target: one scheduled run should finish within 8 minutes for the default active BaT Porsche set.
- Rate limit: default one BaT listing request every 2.5 seconds; no parallel requests to BaT in first release.
- Reliability: no overlapping workflow runs; partial failure records per-listing errors and continues.
- Security boundary: use `SUPABASE_SERVICE_ROLE_KEY` only in GitHub Actions secrets or local `.env.local`; never log secrets.
- Observability: every run emits `runId`, checked count, changed count, price-history insert count, terminal count, and per-listing error messages.

## Scheduler Research Decision

Default to GitHub Actions for this first version.

Evidence:
- GitHub Actions scheduled workflows support a shortest interval of once every 5 minutes and run from the latest default-branch commit: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-syntax#onschedule
- GitHub warns scheduled workflows can be delayed or dropped during high load, especially at the top of the hour, and scheduled workflows on public repos can disable after 60 days of inactivity: https://docs.github.com/en/actions/writing-workflows/choosing-when-your-workflow-runs/events-that-trigger-workflows#schedule
- Vercel Cron on Hobby is daily-only with hourly precision; Vercel Pro supports once-per-minute and per-minute precision: https://vercel.com/docs/cron-jobs/usage-and-pricing
- Vercel Cron invokes Vercel Functions, has function duration limits, no automatic retry, and can overlap without a lock: https://vercel.com/docs/cron-jobs/manage-cron-jobs

Decision:
- Use GitHub Actions `*/5 * * * *` with an off-minute schedule if needed later.
- Use workflow `concurrency` with `cancel-in-progress: false` so only one live refresh runs at a time.
- Keep `workflow_dispatch` inputs for urgent manual refreshes.

Locality envelope:
- Files: 4 created, 1 modified.
- LOC/file target: `live_refresh.ts` ~260 LOC, `live_refresh.test.ts` ~260 LOC, `bat-live-refresh.ts` ~90 LOC, workflow ~45 LOC, `package.json` +1 script line.
- Dependencies: 0 new dependencies; use existing `@supabase/supabase-js`, `cheerio`, `tsx`, `vitest`.

## File Structure

- Create `src/features/scrapers/porsche_collector/live_refresh.ts`
  - Owns Porsche-only BaT live refresh contracts, parsing, changed-field computation, Supabase querying, Supabase updates, price-history inserts, and run summary.
- Create `src/features/scrapers/porsche_collector/live_refresh.test.ts`
  - Covers pure parser behavior, update-shaping behavior, and fake Supabase runner behavior.
- Create `scripts/bat-live-refresh.ts`
  - CLI wrapper for local runs and GitHub Actions.
- Create `.github/workflows/bat-live-refresh.yml`
  - Runs every 5 minutes and supports manual dispatch.
- Modify `package.json`
  - Add `scrapers:bat-live-refresh` script.

## Task 1: Pure BaT Live Snapshot Parser

**Files:**
- Create: `src/features/scrapers/porsche_collector/live_refresh.ts`
- Create: `src/features/scrapers/porsche_collector/live_refresh.test.ts`

- [ ] **Step 1: Write parser tests**

Add this test block to `src/features/scrapers/porsche_collector/live_refresh.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildLiveListingMutation,
  parseBaTLiveSnapshotHtml,
  type LiveListingRow,
  type LiveSnapshot,
} from "./live_refresh";

describe("parseBaTLiveSnapshotHtml", () => {
  it("extracts current bid, bid count, end time, and active status from BaT listing markup", () => {
    const html = `
      <body class="single-bat-listing postid-113297346">
        <span data-listing-currently="113297346">
          <span class="info-label">Current Bid:</span>
          <strong class="info-value">USD $508,888</strong>
        </span>
        <span class="listing-available-countdown" data-countdown="113297346" data-until="1778778300"></span>
        <td class="listing-stats-value number-bids-value" data-listing-count="113297346">11</td>
      </body>
    `;

    expect(parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T16:00:00.000Z"))).toEqual({
      currentBid: 508888,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ACTIVE",
      rawPriceText: "USD $508,888",
    });
  });

  it("extracts fallback bid and timestamp from listing stats markup", () => {
    const html = `
      <table id="listing-bid" data-listing-bid-id="113297346">
        <tr id="current-bid-row">
          <td class="listing-stats-value current-bid-value">
            <span data-listing-current="113297346"><strong>USD $512,000</strong></span>
          </td>
        </tr>
        <span class="listing-end-time" data-auction-ends-id="113297346" data-timestamp="1778778420"></span>
        <td class="number-bids-value">12</td>
      </table>
    `;

    const snapshot = parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T16:00:00.000Z"));

    expect(snapshot.currentBid).toBe(512000);
    expect(snapshot.bidCount).toBe(12);
    expect(snapshot.endTime?.toISOString()).toBe("2026-05-14T17:07:00.000Z");
    expect(snapshot.sourceStatus).toBe("ACTIVE");
  });

  it("marks an auction ended when the parsed end timestamp is in the past", () => {
    const html = `
      <span data-listing-current="113297346">USD $508,888</span>
      <span data-countdown="113297346" data-until="1778778300"></span>
      <td class="number-bids-value">11</td>
    `;

    const snapshot = parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T17:08:30.000Z"));

    expect(snapshot.sourceStatus).toBe("ENDED");
  });
});
```

- [ ] **Step 2: Run the parser tests and verify they fail**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: fail because `./live_refresh` does not exist.

- [ ] **Step 3: Implement the parser**

Create `src/features/scrapers/porsche_collector/live_refresh.ts` with these exports and parser implementation:

```ts
import * as cheerio from "cheerio";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export type LiveSourceStatus = "ACTIVE" | "ENDED";

export type LiveSnapshot = {
  currentBid: number | null;
  bidCount: number | null;
  endTime: Date | null;
  sourceStatus: LiveSourceStatus;
  rawPriceText: string | null;
};

export type LiveListingRow = {
  id: string;
  source_url: string;
  current_bid: number | null;
  bid_count: number | null;
  end_time: string | null;
  status: string;
  hammer_price: number | null;
  final_price: number | null;
  original_currency: string | null;
};

export type LiveListingMutation = {
  listingUpdates: Record<string, unknown>;
  priceHistoryRow: Record<string, unknown> | null;
  changed: boolean;
  terminal: boolean;
};

export type LiveRefreshConfig = {
  limit: number;
  timeBudgetMs: number;
  delayMs: number;
  dryRun: boolean;
  now?: Date;
};

export type LiveRefreshResult = {
  runId: string;
  checked: number;
  changed: number;
  terminal: number;
  priceHistoryInserted: number;
  errors: string[];
  durationMs: number;
  dryRun: boolean;
};

function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseInteger(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\d[\d,]*/);
  if (!match) return null;
  const value = Number.parseInt(match[0].replace(/,/g, ""), 10);
  return Number.isFinite(value) ? value : null;
}

function parseUnixSeconds(value: string | null | undefined): Date | null {
  if (!value) return null;
  const seconds = Number.parseInt(value, 10);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  const date = new Date(seconds * 1000);
  return Number.isFinite(date.getTime()) ? date : null;
}

function firstText($: cheerio.CheerioAPI, selectors: string[]): string | null {
  for (const selector of selectors) {
    const text = $(selector).first().text().trim();
    if (text) return text;
  }
  return null;
}

export function parseBaTLiveSnapshotHtml(html: string, now = new Date()): LiveSnapshot {
  const $ = cheerio.load(html);

  const rawPriceText = firstText($, [
    "[data-listing-current] strong",
    "[data-listing-current]",
    "[data-listing-currently] .info-value",
    ".current-bid-value strong",
    ".current-bid-value",
  ]);

  const bidCountText = firstText($, [
    ".number-bids-value[data-listing-count]",
    ".number-bids-value",
    ".bid-count",
  ]);

  const endTime =
    parseUnixSeconds($("[data-countdown][data-until]").first().attr("data-until")) ??
    parseUnixSeconds($("[data-auction-ends-id][data-timestamp]").first().attr("data-timestamp")) ??
    parseUnixSeconds($("[data-ends-id][data-timestamp]").first().attr("data-timestamp")) ??
    parseUnixSeconds($("[data-ends]").first().attr("data-ends"));

  const sourceStatus: LiveSourceStatus =
    endTime && endTime.getTime() <= now.getTime() ? "ENDED" : "ACTIVE";

  return {
    currentBid: parsePrice(rawPriceText),
    bidCount: parseInteger(bidCountText),
    endTime,
    sourceStatus,
    rawPriceText,
  };
}
```

- [ ] **Step 4: Re-run parser tests**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: parser tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/porsche_collector/live_refresh.ts src/features/scrapers/porsche_collector/live_refresh.test.ts
git commit -m "feat: parse bat live auction snapshots"
```

## Task 2: Change Detection and Price-History Contract

**Files:**
- Modify: `src/features/scrapers/porsche_collector/live_refresh.ts`
- Modify: `src/features/scrapers/porsche_collector/live_refresh.test.ts`

- [ ] **Step 1: Add mutation-shaping tests**

Append these tests to `src/features/scrapers/porsche_collector/live_refresh.test.ts`:

```ts
describe("buildLiveListingMutation", () => {
  const row: LiveListingRow = {
    id: "listing-1",
    source_url: "https://bringatrailer.com/listing/2003-porsche-911-turbo/",
    current_bid: 500000,
    bid_count: 10,
    end_time: "2026-05-14T17:05:00.000Z",
    status: "active",
    hammer_price: null,
    final_price: null,
    original_currency: "USD",
  };

  it("updates changed bid, bid count, and end time, and records price history only on bid change", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 508888,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:07:00.000Z"),
      sourceStatus: "ACTIVE",
      rawPriceText: "USD $508,888",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T16:30:05.000Z");

    expect(mutation.changed).toBe(true);
    expect(mutation.terminal).toBe(false);
    expect(mutation.listingUpdates).toMatchObject({
      current_bid: 508888,
      bid_count: 11,
      end_time: "2026-05-14T17:07:00.000Z",
      status: "active",
      updated_at: "2026-05-14T16:30:05.000Z",
      last_verified_at: "2026-05-14T16:30:05.000Z",
      original_currency: "USD",
    });
    expect(mutation.priceHistoryRow).toEqual({
      listing_id: "listing-1",
      time: "2026-05-14T16:30:05.000Z",
      status: "active",
      price_usd: 508888,
      price_eur: null,
      price_gbp: null,
    });
  });

  it("does not insert price history when the bid is unchanged", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 500000,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ACTIVE",
      rawPriceText: "USD $500,000",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T16:31:00.000Z");

    expect(mutation.changed).toBe(true);
    expect(mutation.priceHistoryRow).toBeNull();
    expect(mutation.listingUpdates.current_bid).toBeUndefined();
    expect(mutation.listingUpdates.bid_count).toBe(11);
  });

  it("marks terminal listings sold when BaT has ended with a current bid", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 508888,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ENDED",
      rawPriceText: "USD $508,888",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T17:08:00.000Z");

    expect(mutation.terminal).toBe(true);
    expect(mutation.listingUpdates).toMatchObject({
      status: "sold",
      current_bid: 508888,
      hammer_price: 508888,
      final_price: 508888,
    });
  });
});
```

- [ ] **Step 2: Run mutation tests and verify they fail**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: fail because `buildLiveListingMutation` is not implemented.

- [ ] **Step 3: Implement mutation shaping**

Append this implementation to `src/features/scrapers/porsche_collector/live_refresh.ts`:

```ts
function sameIso(a: string | null, b: Date | null): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return new Date(a).getTime() === b.getTime();
}

function normalizeNumber(value: number | null): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function buildLiveListingMutation(
  row: LiveListingRow,
  snapshot: LiveSnapshot,
  nowIso: string,
): LiveListingMutation {
  const listingUpdates: Record<string, unknown> = {
    last_verified_at: nowIso,
  };

  const nextBid = normalizeNumber(snapshot.currentBid);
  const previousBid = normalizeNumber(row.current_bid);
  const bidChanged = nextBid !== null && nextBid !== previousBid;

  if (bidChanged) listingUpdates.current_bid = nextBid;
  if (snapshot.bidCount !== null && snapshot.bidCount !== row.bid_count) {
    listingUpdates.bid_count = snapshot.bidCount;
  }
  if (snapshot.endTime && !sameIso(row.end_time, snapshot.endTime)) {
    listingUpdates.end_time = snapshot.endTime.toISOString();
  }
  if (!row.original_currency && nextBid !== null) {
    listingUpdates.original_currency = "USD";
  }

  const terminal = snapshot.sourceStatus === "ENDED";
  const nextStatus = terminal ? (nextBid !== null ? "sold" : "unsold") : "active";
  if (row.status !== nextStatus) {
    listingUpdates.status = nextStatus;
  } else if (!("status" in listingUpdates)) {
    listingUpdates.status = row.status;
  }

  if (terminal && nextBid !== null) {
    if (row.hammer_price !== nextBid) listingUpdates.hammer_price = nextBid;
    if (row.final_price !== nextBid) listingUpdates.final_price = nextBid;
  }

  const meaningfulKeys = Object.keys(listingUpdates).filter((key) => key !== "last_verified_at");
  if (meaningfulKeys.length > 0) {
    listingUpdates.updated_at = nowIso;
  }

  const priceHistoryRow =
    bidChanged && nextBid !== null
      ? {
          listing_id: row.id,
          time: nowIso,
          status: nextStatus,
          price_usd: nextBid,
          price_eur: null,
          price_gbp: null,
        }
      : null;

  return {
    listingUpdates,
    priceHistoryRow,
    changed: meaningfulKeys.length > 0,
    terminal,
  };
}
```

- [ ] **Step 4: Re-run mutation tests**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/porsche_collector/live_refresh.ts src/features/scrapers/porsche_collector/live_refresh.test.ts
git commit -m "feat: shape porsche bat live listing updates"
```

## Task 3: Supabase Live Refresh Runner

**Files:**
- Modify: `src/features/scrapers/porsche_collector/live_refresh.ts`
- Modify: `src/features/scrapers/porsche_collector/live_refresh.test.ts`

- [ ] **Step 1: Add runner tests with a fake Supabase client**

Append this test block:

```ts
describe("runPorscheBaTLiveRefresh", () => {
  it("fetches active Porsche BaT rows, updates changed listings, and inserts price history", async () => {
    const updates: Array<{ table: string; values: Record<string, unknown>; id?: string }> = [];
    const inserts: Array<{ table: string; values: Record<string, unknown> }> = [];

    const fakeClient = {
      from(table: string) {
        if (table === "listings") {
          return {
            select() {
              return this;
            },
            eq() {
              return this;
            },
            ilike() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              return Promise.resolve({
                data: [
                  {
                    id: "listing-1",
                    source_url: "https://bringatrailer.com/listing/2003-porsche-911-turbo/",
                    current_bid: 500000,
                    bid_count: 10,
                    end_time: "2026-05-14T17:05:00.000Z",
                    status: "active",
                    hammer_price: null,
                    final_price: null,
                    original_currency: "USD",
                  },
                ],
                error: null,
              });
            },
            update(values: Record<string, unknown>) {
              updates.push({ table, values });
              return {
                eq(_column: string, id: string) {
                  updates[updates.length - 1].id = id;
                  return Promise.resolve({ error: null });
                },
              };
            },
          };
        }

        return {
          insert(values: Record<string, unknown>) {
            inserts.push({ table, values });
            return Promise.resolve({ error: null });
          },
        };
      },
    } as unknown as SupabaseClient;

    const html = `
      <span data-listing-current="113297346">USD $508,888</span>
      <span data-countdown="113297346" data-until="1778778420"></span>
      <td class="number-bids-value">11</td>
    `;

    const result = await runPorscheBaTLiveRefresh({
      client: fakeClient,
      fetchHtml: async () => html,
      config: {
        limit: 1,
        timeBudgetMs: 30_000,
        delayMs: 0,
        dryRun: false,
        now: new Date("2026-05-14T16:30:05.000Z"),
      },
    });

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.priceHistoryInserted).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe("listing-1");
    expect(updates[0].values.current_bid).toBe(508888);
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("price_history");
  });
});
```

- [ ] **Step 2: Run runner tests and verify they fail**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: fail because `runPorscheBaTLiveRefresh` is not implemented and `SupabaseClient` is not imported in the test.

- [ ] **Step 3: Add test imports**

Update the import section of `live_refresh.test.ts`:

```ts
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  buildLiveListingMutation,
  parseBaTLiveSnapshotHtml,
  runPorscheBaTLiveRefresh,
  type LiveListingRow,
  type LiveSnapshot,
} from "./live_refresh";
```

- [ ] **Step 4: Implement the runner**

Append this code to `live_refresh.ts`:

```ts
type RunInput = {
  client: SupabaseClient;
  fetchHtml: (url: string) => Promise<string>;
  config: LiveRefreshConfig;
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: AbortSignal.timeout(15_000),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status} for ${url}`);
  }

  return response.text();
}

export function createLiveRefreshSupabaseClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function runPorscheBaTLiveRefresh(input: RunInput): Promise<LiveRefreshResult> {
  const runId = crypto.randomUUID();
  const startedAt = Date.now();
  const now = input.config.now ?? new Date();
  const nowIso = now.toISOString();
  const errors: string[] = [];

  const { data, error } = await input.client
    .from("listings")
    .select("id,source_url,current_bid,bid_count,end_time,status,hammer_price,final_price,original_currency")
    .eq("source", "BaT")
    .ilike("make", "Porsche")
    .eq("status", "active")
    .order("end_time", { ascending: true, nullsFirst: false })
    .limit(input.config.limit);

  if (error) {
    throw new Error(`Supabase live listing query failed: ${error.message}`);
  }

  const rows = (data ?? []) as LiveListingRow[];
  let checked = 0;
  let changed = 0;
  let terminal = 0;
  let priceHistoryInserted = 0;

  for (const row of rows) {
    if (Date.now() - startedAt > input.config.timeBudgetMs) {
      errors.push(`time budget exceeded after ${checked} listings`);
      break;
    }

    try {
      const html = await input.fetchHtml(row.source_url);
      const snapshot = parseBaTLiveSnapshotHtml(html, now);
      const mutation = buildLiveListingMutation(row, snapshot, nowIso);
      checked++;

      if (!mutation.changed && !mutation.priceHistoryRow) {
        console.log(JSON.stringify({ level: "info", event: "bat_live_refresh.no_change", runId, listingId: row.id }));
      } else if (input.config.dryRun) {
        changed += mutation.changed ? 1 : 0;
        terminal += mutation.terminal ? 1 : 0;
        priceHistoryInserted += mutation.priceHistoryRow ? 1 : 0;
        console.log(JSON.stringify({ level: "info", event: "bat_live_refresh.dry_change", runId, listingId: row.id, mutation }));
      } else {
        if (mutation.changed) {
          const { error: updateError } = await input.client
            .from("listings")
            .update(mutation.listingUpdates)
            .eq("id", row.id);
          if (updateError) throw new Error(`listing update failed: ${updateError.message}`);
          changed++;
          if (mutation.terminal) terminal++;
        }

        if (mutation.priceHistoryRow) {
          const { error: historyError } = await input.client
            .from("price_history")
            .insert(mutation.priceHistoryRow);
          if (historyError) throw new Error(`price history insert failed: ${historyError.message}`);
          priceHistoryInserted++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${row.id}: ${message}`);
      console.error(JSON.stringify({ level: "error", event: "bat_live_refresh.listing_error", runId, listingId: row.id, message }));
    }

    if (input.config.delayMs > 0) {
      await delay(input.config.delayMs);
    }
  }

  return {
    runId,
    checked,
    changed,
    terminal,
    priceHistoryInserted,
    errors,
    durationMs: Date.now() - startedAt,
    dryRun: input.config.dryRun,
  };
}

export async function runPorscheBaTLiveRefreshFromEnv(config: LiveRefreshConfig): Promise<LiveRefreshResult> {
  return runPorscheBaTLiveRefresh({
    client: createLiveRefreshSupabaseClient(),
    fetchHtml,
    config,
  });
}
```

- [ ] **Step 5: Re-run runner tests**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/porsche_collector/live_refresh.ts src/features/scrapers/porsche_collector/live_refresh.test.ts
git commit -m "feat: refresh active porsche bat listings"
```

## Task 4: CLI and GitHub Actions Schedule

**Files:**
- Create: `scripts/bat-live-refresh.ts`
- Create: `.github/workflows/bat-live-refresh.yml`
- Modify: `package.json`

- [ ] **Step 1: Create the CLI wrapper**

Create `scripts/bat-live-refresh.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import { runPorscheBaTLiveRefreshFromEnv } from "../src/features/scrapers/porsche_collector/live_refresh";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

function parseArgs(argv: string[]) {
  const opts = {
    limit: 60,
    timeBudgetMs: 8 * 60 * 1000,
    delayMs: 2500,
    dryRun: false,
  };

  for (const arg of argv) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const value = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = Number.parseInt(value, 10);
      if (key === "timeBudgetMs") opts.timeBudgetMs = Number.parseInt(value, 10);
      if (key === "delayMs") opts.delayMs = Number.parseInt(value, 10);
    } else if (arg === "--dryRun") {
      opts.dryRun = true;
    }
  }

  return opts;
}

async function main() {
  const config = parseArgs(process.argv.slice(2));
  const result = await runPorscheBaTLiveRefreshFromEnv(config);
  console.log(JSON.stringify({ event: "bat_live_refresh.done", ...result }, null, 2));

  if (result.errors.length > 0 && result.checked === 0) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
```

- [ ] **Step 2: Add npm script**

Modify `package.json` scripts:

```json
"scrapers:bat-live-refresh": "tsx scripts/bat-live-refresh.ts",
```

Place it near the existing scraper scripts after `"scrapers:enrich-loop"`.

- [ ] **Step 3: Add GitHub Actions workflow**

Create `.github/workflows/bat-live-refresh.yml`:

```yaml
name: BaT Live Refresh

on:
  schedule:
    - cron: '*/5 * * * *'
  workflow_dispatch:
    inputs:
      limit:
        description: 'Max active Porsche BaT listings to refresh'
        default: '60'
      time_budget_ms:
        description: 'Time budget in milliseconds'
        default: '480000'
      delay_ms:
        description: 'Delay between BaT requests in milliseconds'
        default: '2500'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'

concurrency:
  group: bat-live-refresh
  cancel-in-progress: false

jobs:
  refresh:
    runs-on: ubuntu-latest
    timeout-minutes: 10

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Run BaT live refresh
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          npx tsx scripts/bat-live-refresh.ts \
            --limit=${{ github.event.inputs.limit || '60' }} \
            --timeBudgetMs=${{ github.event.inputs.time_budget_ms || '480000' }} \
            --delayMs=${{ github.event.inputs.delay_ms || '2500' }} \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

- [ ] **Step 4: Validate local dry run command shape**

Run:

```bash
npm run scrapers:bat-live-refresh -- --limit=1 --timeBudgetMs=30000 --delayMs=0 --dryRun
```

Expected with Supabase env present: JSON summary with `event: "bat_live_refresh.done"`.

Expected without Supabase env present: fails with `Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY`.

- [ ] **Step 5: Commit**

```bash
git add scripts/bat-live-refresh.ts .github/workflows/bat-live-refresh.yml package.json package-lock.json
git commit -m "ci: schedule porsche bat live refresh"
```

## Task 5: Regression Verification

**Files:**
- Verify all files from prior tasks.

- [ ] **Step 1: Run focused tests**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/live_refresh.test.ts
```

Expected: all tests pass.

- [ ] **Step 2: Run adjacent collector tests**

Run:

```bash
npm test -- src/features/scrapers/porsche_collector/supabase_writer.test.ts src/features/scrapers/porsche_collector/normalize.test.ts
```

Expected: all tests pass.

- [ ] **Step 3: Run lint**

Run:

```bash
npm run lint
```

Expected: no lint errors caused by `live_refresh.ts`, `live_refresh.test.ts`, or `bat-live-refresh.ts`.

- [ ] **Step 4: Run a real dry-run smoke test**

Run with local `.env.local` containing Supabase service role credentials:

```bash
npm run scrapers:bat-live-refresh -- --limit=3 --timeBudgetMs=60000 --delayMs=1000 --dryRun
```

Expected:
- The command exits with code 0.
- Output includes `checked` between 0 and 3.
- Output includes `dryRun: true`.
- No database rows are changed.

- [ ] **Step 5: Run one real write test with a small limit**

Run with local `.env.local` containing Supabase service role credentials:

```bash
npm run scrapers:bat-live-refresh -- --limit=1 --timeBudgetMs=60000 --delayMs=0
```

Expected:
- The command exits with code 0.
- One active Porsche BaT listing is checked if present.
- If BaT bid, bid count, end time, or status differs from the DB row, `listings` updates.
- If current bid changed, one `price_history` row is inserted with a second-resolution timestamp.

- [ ] **Step 6: Confirm GitHub workflow syntax**

Run:

```bash
git diff --check -- .github/workflows/bat-live-refresh.yml
```

Expected: no whitespace errors. After the branch is pushed, GitHub Actions should show a `BaT Live Refresh` workflow with a manual `workflow_dispatch` button.

- [ ] **Step 7: Commit verification fixes**

If verification required any edits:

```bash
git add src/features/scrapers/porsche_collector/live_refresh.ts src/features/scrapers/porsche_collector/live_refresh.test.ts scripts/bat-live-refresh.ts .github/workflows/bat-live-refresh.yml package.json package-lock.json
git commit -m "test: verify porsche bat live refresh"
```

## Pass-Fail Criteria

Pass:
- Active Porsche BaT listings can be refreshed independently of the daily scraper.
- Current bid updates in `listings.current_bid`.
- Bid count updates in `listings.bid_count`.
- Last-second BaT end-time extensions update `listings.end_time`.
- Ended listings transition to `sold` or `unsold`.
- Price history records bid changes without waiting for the hourly snapshot path.
- GitHub Actions can run manually and on a 5-minute schedule.

Fail:
- The job updates non-Porsche rows.
- The job updates non-BaT rows.
- The job adds a new dependency.
- The job performs parallel requests to BaT.
- The job logs Supabase secrets.
- The job exits successfully after querying zero rows because of a Supabase query error.

## Self-Review

Spec coverage:
- Porsche-only scope: covered by `ilike("make", "Porsche")`.
- BaT-only scope: covered by `eq("source", "BaT")`.
- Current bid freshness: covered by parser, mutation, runner, and workflow tasks.
- Second-by-second timer: no UI change needed because existing `AuctionTimer` already updates every second from `endTime`; this plan keeps `end_time` fresh.
- Scheduler choice: covered by official docs and GitHub Actions workflow.

Placeholder scan:
- No placeholder steps remain.

Type consistency:
- `LiveSnapshot`, `LiveListingRow`, `LiveListingMutation`, and `LiveRefreshResult` names are consistent across tests, implementation, CLI, and workflow.
