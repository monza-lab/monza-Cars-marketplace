import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";

import {
  buildLiveListingMutation,
  parseBaTLiveSnapshotHtml,
  runPorscheBaTLiveRefresh,
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
      terminalStatus: null,
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
    expect(snapshot.terminalStatus).toBeNull();
  });

  it("marks an auction ended when the parsed end timestamp is in the past", () => {
    const html = `
      <span data-listing-current="113297346">USD $508,888</span>
      <span data-countdown="113297346" data-until="1778778300"></span>
      <td class="number-bids-value">11</td>
    `;

    const snapshot = parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T17:08:30.000Z"));

    expect(snapshot.sourceStatus).toBe("ENDED");
    expect(snapshot.terminalStatus).toBeNull();
  });

  it("extracts reserve-not-met terminal outcome as unsold", () => {
    const html = `
      <span data-listing-current="113297346">USD $508,888</span>
      <span data-countdown="113297346" data-until="1778778300"></span>
      <div class="listing-result">Reserve&nbsp;
        Not-Met</div>
    `;

    const snapshot = parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T17:08:30.000Z"));

    expect(snapshot.sourceStatus).toBe("ENDED");
    expect(snapshot.terminalStatus).toBe("unsold");
  });

  it("uses closed auction result instead of sidebar current-auction bids", () => {
    const html = `
      <main>
        <h1>6k-Mile 2022 Porsche 718 Spyder</h1>
        <div class="auction-result">
          Auction Result High Bid USD $94,000 (Reserve Not Met)
          Auction Ended Thursday, May 14 at 12:32pm
          Bids 51
        </div>
      </main>
      <aside>
        <h2>Current BaT Auctions</h2>
        <div>Current Bid: USD $2,000</div>
        <div>Ends in:</div>
      </aside>
    `;

    const snapshot = parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T19:48:00.000Z"));

    expect(snapshot.currentBid).toBe(94000);
    expect(snapshot.bidCount).toBe(51);
    expect(snapshot.sourceStatus).toBe("ENDED");
    expect(snapshot.terminalStatus).toBe("unsold");
    expect(snapshot.rawPriceText).toBe("USD $94,000");
  });

  it("does not treat active page chrome as a closed auction result", () => {
    const html = `
      <main>
        <h1>2014 Porsche 911 Turbo S Coupe</h1>
        <span data-listing-current="242657"><strong>USD $104,000</strong></span>
        <span data-countdown="242657" data-until="1778865480"></span>
        <td class="number-bids-value">12</td>
        <p>Bid Successful Congratulations! You're the high bidder.</p>
        <p>BaT auction summary, sold cars only within, last 12 months:
          One car sold for $181k.
        </p>
      </main>
      <footer>
        <a>View all Auction Results</a>
        <a>See additional 1,087 auctions</a>
      </footer>
    `;

    const snapshot = parseBaTLiveSnapshotHtml(html, new Date("2026-05-14T19:57:00.000Z"));

    expect(snapshot.currentBid).toBe(104000);
    expect(snapshot.bidCount).toBe(12);
    expect(snapshot.sourceStatus).toBe("ACTIVE");
    expect(snapshot.terminalStatus).toBeNull();
  });
});

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
      terminalStatus: null,
      rawPriceText: "USD $508,888",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T16:30:05.000Z");

    expect(mutation.changed).toBe(true);
    expect(mutation.terminal).toBe(false);
    expect(mutation.listingUpdates).toMatchObject({
      current_bid: 508888,
      bid_count: 11,
      end_time: "2026-05-14T17:07:00.000Z",
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
      terminalStatus: null,
      rawPriceText: "USD $500,000",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T16:31:00.000Z");

    expect(mutation.changed).toBe(true);
    expect(mutation.priceHistoryRow).toBeNull();
    expect(mutation.listingUpdates.current_bid).toBeUndefined();
    expect(mutation.listingUpdates.bid_count).toBe(11);
  });

  it("does not mark unchanged snapshots as changed", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 500000,
      bidCount: 10,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ACTIVE",
      terminalStatus: null,
      rawPriceText: "USD $500,000",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T16:31:00.000Z");

    expect(mutation.changed).toBe(false);
    expect(mutation.listingUpdates).toEqual({ last_verified_at: "2026-05-14T16:31:00.000Z" });
    expect(mutation.priceHistoryRow).toBeNull();
  });

  it("does not mark terminal listings sold without an explicit final result", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 508888,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ENDED",
      terminalStatus: null,
      rawPriceText: "USD $508,888",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T17:08:00.000Z");

    expect(mutation.terminal).toBe(false);
    expect(mutation.listingUpdates).toMatchObject({
      current_bid: 508888,
    });
    expect(mutation.listingUpdates.status).toBeUndefined();
    expect(mutation.listingUpdates.hammer_price).toBeUndefined();
    expect(mutation.listingUpdates.final_price).toBeUndefined();
  });

  it("marks terminal listings sold when BaT has an explicit sold result", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 508888,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ENDED",
      terminalStatus: "sold",
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

  it("marks reserve-not-met terminal listings unsold without sale prices", () => {
    const snapshot: LiveSnapshot = {
      currentBid: 508888,
      bidCount: 11,
      endTime: new Date("2026-05-14T17:05:00.000Z"),
      sourceStatus: "ENDED",
      terminalStatus: "unsold",
      rawPriceText: "USD $508,888",
    };

    const mutation = buildLiveListingMutation(row, snapshot, "2026-05-14T17:08:00.000Z");

    expect(mutation.terminal).toBe(true);
    expect(mutation.listingUpdates).toMatchObject({
      status: "unsold",
      current_bid: 508888,
    });
    expect(mutation.listingUpdates.hammer_price).toBeUndefined();
    expect(mutation.listingUpdates.final_price).toBeUndefined();
  });
});

describe("runPorscheBaTLiveRefresh", () => {
  it("queries only future active listings so stale ended rows are not refreshed as active", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    let queryCount = 0;

    const fakeClient = {
      from(table: string) {
        expect(table).toBe("listings");
        return {
          select(...args: unknown[]) {
            calls.push({ method: "select", args });
            return this;
          },
          eq(...args: unknown[]) {
            calls.push({ method: "eq", args });
            return this;
          },
          ilike(...args: unknown[]) {
            calls.push({ method: "ilike", args });
            return this;
          },
          gt(...args: unknown[]) {
            calls.push({ method: "gt", args });
            return this;
          },
          lte(...args: unknown[]) {
            calls.push({ method: "lte", args });
            return this;
          },
          order(...args: unknown[]) {
            calls.push({ method: "order", args });
            return this;
          },
          limit(...args: unknown[]) {
            calls.push({ method: "limit", args });
            queryCount++;
            return Promise.resolve({ data: [], error: null });
          },
        };
      },
    } as unknown as SupabaseClient;

    await runPorscheBaTLiveRefresh({
      client: fakeClient,
      fetchHtml: async () => {
        throw new Error("should not fetch when query returns no rows");
      },
      config: {
        limit: 1,
        timeBudgetMs: 30_000,
        delayMs: 0,
        dryRun: false,
        now: new Date("2026-05-14T19:48:00.000Z"),
      },
    });

    expect(calls).toContainEqual({
      method: "gt",
      args: ["end_time", "2026-05-14T19:48:00.000Z"],
    });
    expect(calls).toContainEqual({
      method: "lte",
      args: ["end_time", "2026-05-14T19:48:00.000Z"],
    });
    expect(queryCount).toBe(2);
  });

  it("sweeps expired active rows and marks reserve-not-met auctions unsold", async () => {
    const updates: Array<{ table: string; values: Record<string, unknown>; id?: string }> = [];
    let queryCount = 0;

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
            gt() {
              return this;
            },
            lte() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              queryCount++;
              if (queryCount === 1) return Promise.resolve({ data: [], error: null });
              return Promise.resolve({
                data: [
                  {
                    id: "expired-1",
                    source_url: "https://bringatrailer.com/listing/2022-porsche-718-spyder-36/",
                    current_bid: 94000,
                    bid_count: 51,
                    end_time: "2026-05-11T00:00:00.000Z",
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
          insert() {
            throw new Error("unsold terminal rows should not insert price history when bid is unchanged");
          },
        };
      },
    } as unknown as SupabaseClient;

    const html = `
      <main>
        <div>Auction Result High Bid USD $94,000 (Reserve Not Met) Auction Ended Thursday, May 14 at 12:32pm Bids 51</div>
      </main>
      <aside>Current Bid: USD $2,000</aside>
    `;

    const result = await runPorscheBaTLiveRefresh({
      client: fakeClient,
      fetchHtml: async () => html,
      config: {
        limit: 10,
        timeBudgetMs: 30_000,
        delayMs: 0,
        dryRun: false,
        now: new Date("2026-05-14T19:48:00.000Z"),
      },
    });

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(1);
    expect(result.terminal).toBe(1);
    expect(updates).toHaveLength(1);
    expect(updates[0]).toMatchObject({
      table: "listings",
      id: "expired-1",
      values: {
        status: "unsold",
        last_verified_at: "2026-05-14T19:48:00.000Z",
      },
    });
    expect(updates[0].values.current_bid).toBeUndefined();
    expect(updates[0].values.hammer_price).toBeUndefined();
  });

  it("does not write prices for expired rows without a clear terminal result or live end time", async () => {
    const updates: Array<{ table: string; values: Record<string, unknown>; id?: string }> = [];
    let queryCount = 0;

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
            gt() {
              return this;
            },
            lte() {
              return this;
            },
            order() {
              return this;
            },
            limit() {
              queryCount++;
              if (queryCount === 1) return Promise.resolve({ data: [], error: null });
              return Promise.resolve({
                data: [
                  {
                    id: "expired-inconclusive",
                    source_url: "https://bringatrailer.com/listing/stale-row/",
                    current_bid: 94000,
                    bid_count: 51,
                    end_time: "2026-05-11T00:00:00.000Z",
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
          insert() {
            throw new Error("inconclusive expired rows should not insert price history");
          },
        };
      },
    } as unknown as SupabaseClient;

    const html = `
      <main>
        <h1>Stale listing page without visible auction result</h1>
        <p>Listing copy with no countdown metadata.</p>
      </main>
      <aside>
        <h2>Current BaT Auctions</h2>
        <span data-listing-current="sidebar"><strong>USD $7,000</strong></span>
      </aside>
    `;

    const result = await runPorscheBaTLiveRefresh({
      client: fakeClient,
      fetchHtml: async () => html,
      config: {
        limit: 10,
        timeBudgetMs: 30_000,
        delayMs: 0,
        dryRun: false,
        now: new Date("2026-05-14T19:48:00.000Z"),
      },
    });

    expect(result.checked).toBe(1);
    expect(result.changed).toBe(0);
    expect(result.priceHistoryInserted).toBe(0);
    expect(updates).toEqual([
      {
        table: "listings",
        id: "expired-inconclusive",
        values: {
          last_verified_at: "2026-05-14T19:48:00.000Z",
        },
      },
    ]);
  });

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
            gt() {
              return this;
            },
            lte() {
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

  it("persists last verification for unchanged rows without counting them as changed", async () => {
    const updates: Array<{ table: string; values: Record<string, unknown>; id?: string }> = [];

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
            gt() {
              return this;
            },
            lte() {
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

        throw new Error(`unexpected table ${table}`);
      },
    } as unknown as SupabaseClient;

    const html = `
      <span data-listing-current="113297346">USD $500,000</span>
      <span data-countdown="113297346" data-until="1778778300"></span>
      <td class="number-bids-value">10</td>
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
    expect(result.changed).toBe(0);
    expect(result.priceHistoryInserted).toBe(0);
    expect(updates).toEqual([
      {
        table: "listings",
        id: "listing-1",
        values: {
          last_verified_at: "2026-05-14T16:30:05.000Z",
        },
      },
    ]);
  });
});
