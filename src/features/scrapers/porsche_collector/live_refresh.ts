import { randomUUID } from "node:crypto";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import * as cheerio from "cheerio";

export type LiveSourceStatus = "ACTIVE" | "ENDED";

export type LiveSnapshot = {
  currentBid: number | null;
  bidCount: number | null;
  endTime: Date | null;
  sourceStatus: LiveSourceStatus;
  terminalStatus: "sold" | "unsold" | null;
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

type RunInput = {
  client: SupabaseClient;
  fetchHtml: (url: string, signal?: AbortSignal) => Promise<string>;
  config: LiveRefreshConfig;
};

const LISTING_SELECT =
  "id,source_url,current_bid,bid_count,end_time,status,hammer_price,final_price,original_currency";

type ClosedAuctionResult = {
  currentBid: number;
  bidCount: number | null;
  terminalStatus: "sold" | "unsold";
  rawPriceText: string;
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
  const pageText = $("body").text() || $.text();
  const closedResult = parseClosedAuctionResult(pageText);

  const rawPriceText = firstText($, [
    "[data-listing-current] strong",
    "[data-listing-current]",
    "[data-listing-currently] .info-value",
    ".current-bid-value strong",
    ".current-bid-value",
  ]);

  const bidCountText =
    firstText($, [
      ".number-bids-value[data-listing-count]",
      ".number-bids-value",
      ".bid-count",
    ]) ?? firstNumberBidsValueText(html);

  const endTime =
    parseUnixSeconds($("[data-countdown][data-until]").first().attr("data-until")) ??
    parseUnixSeconds($("[data-auction-ends-id][data-timestamp]").first().attr("data-timestamp")) ??
    parseUnixSeconds($("[data-ends-id][data-timestamp]").first().attr("data-timestamp")) ??
    parseUnixSeconds($("[data-ends]").first().attr("data-ends"));

  const sourceStatus: LiveSourceStatus =
    closedResult || (endTime && endTime.getTime() <= now.getTime()) ? "ENDED" : "ACTIVE";

  return {
    currentBid: closedResult?.currentBid ?? parsePrice(rawPriceText),
    bidCount: closedResult?.bidCount ?? parseInteger(bidCountText),
    endTime,
    sourceStatus,
    terminalStatus: closedResult?.terminalStatus ?? (sourceStatus === "ENDED" ? parseTerminalStatus(pageText) : null),
    rawPriceText: closedResult?.rawPriceText ?? rawPriceText,
  };
}

function parseClosedAuctionResult(text: string): ClosedAuctionResult | null {
  const normalized = text.replace(/[\s\u00a0]+/g, " ").trim();
  const resultMatch = normalized.match(
    /\bAuction Result\s+(High Bid|Sold(?: for)?)\s*(USD|EUR|GBP)?\s*\$?\s*([\d,]+(?:\.\d+)?)/i,
  );
  if (!resultMatch) return null;

  const currentBid = parsePrice(resultMatch[3]);
  if (currentBid === null) return null;

  const currency = (resultMatch[2] ?? "USD").toUpperCase();
  const rawPriceText = `${currency} $${resultMatch[3]}`;
  const bidCount = parseInteger(normalized.match(/\bBids\s+(\d[\d,]*)\b/i)?.[1]);
  const terminalStatus =
    /\bReserve\s*Not\s*Met\b|\bNot\s*Sold\b|\bBid\s*To\b/i.test(normalized) ||
    /\bHigh\s*Bid\b/i.test(resultMatch[1])
      ? "unsold"
      : "sold";

  return {
    currentBid,
    bidCount,
    terminalStatus,
    rawPriceText,
  };
}

function parseTerminalStatus(text: string): "sold" | "unsold" | null {
  const normalized = text.toLowerCase().replace(/[\s\u00a0\-_]+/g, " ").trim();
  if (/\b(reserve not met|not sold|bid to)\b/i.test(normalized)) return "unsold";
  if (/\bsold\b/i.test(normalized)) return "sold";
  return null;
}

function firstNumberBidsValueText(html: string): string | null {
  const match = html.match(/<[^>]*class=["'][^"']*\bnumber-bids-value\b[^"']*["'][^>]*>([\s\S]*?)<\/[^>]+>/i);
  if (!match) return null;
  return cheerio.load(match[1]).text().trim();
}

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

  if (nextBid !== null && (bidChanged || !row.original_currency)) {
    listingUpdates.original_currency = row.original_currency ?? "USD";
  }

  const terminal = snapshot.sourceStatus === "ENDED" && snapshot.terminalStatus !== null;
  const nextStatus = terminal ? snapshot.terminalStatus : "active";
  if (row.status !== nextStatus) {
    listingUpdates.status = nextStatus;
  }

  if (terminal && nextStatus === "sold" && nextBid !== null) {
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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string, signal?: AbortSignal): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.9",
    },
    signal: signal ?? AbortSignal.timeout(15_000),
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
  const runId = randomUUID();
  const startedAt = Date.now();
  const now = input.config.now ?? new Date();
  const nowIso = now.toISOString();
  const errors: string[] = [];

  const futureRowsResult = await input.client
    .from("listings")
    .select(LISTING_SELECT)
    .eq("source", "BaT")
    .ilike("make", "Porsche")
    .eq("status", "active")
    .gt("end_time", nowIso)
    .order("end_time", { ascending: true, nullsFirst: false })
    .limit(input.config.limit);

  if (futureRowsResult.error) {
    throw new Error(`Supabase live listing query failed: ${futureRowsResult.error.message}`);
  }

  const terminalLimit = Math.min(10, input.config.limit);
  const expiredRowsResult = await input.client
    .from("listings")
    .select(LISTING_SELECT)
    .eq("source", "BaT")
    .ilike("make", "Porsche")
    .eq("status", "active")
    .lte("end_time", nowIso)
    .order("end_time", { ascending: false, nullsFirst: false })
    .limit(terminalLimit);

  if (expiredRowsResult.error) {
    throw new Error(`Supabase expired live listing query failed: ${expiredRowsResult.error.message}`);
  }

  const futureRows = (futureRowsResult.data ?? []) as LiveListingRow[];
  const expiredRows = (expiredRowsResult.data ?? []) as LiveListingRow[];
  const expiredRowIds = new Set(expiredRows.map((row) => row.id));
  const rowsById = new Map<string, LiveListingRow>();
  for (const row of [...futureRows, ...expiredRows]) {
    rowsById.set(row.id, row);
  }
  const rows = [...rowsById.values()];
  let checked = 0;
  let changed = 0;
  let terminal = 0;
  let priceHistoryInserted = 0;

  for (const [index, row] of rows.entries()) {
    const elapsedMs = Date.now() - startedAt;
    const remainingBudgetMs = input.config.timeBudgetMs - elapsedMs;
    if (remainingBudgetMs <= 0) {
      errors.push(`time budget exceeded after ${checked} listings`);
      break;
    }

    try {
      const html = await fetchHtmlWithinBudget(input.fetchHtml, row.source_url, remainingBudgetMs);
      const snapshot = parseBaTLiveSnapshotHtml(html, now);
      const mutation =
        expiredRowIds.has(row.id) && shouldTreatExpiredSnapshotAsInconclusive(snapshot, now)
          ? buildVerificationOnlyMutation(nowIso)
          : buildLiveListingMutation(row, snapshot, nowIso);
      checked++;

      if (input.config.dryRun) {
        changed += mutation.changed ? 1 : 0;
        terminal += mutation.terminal ? 1 : 0;
        priceHistoryInserted += mutation.priceHistoryRow ? 1 : 0;
        const event = mutation.changed || mutation.priceHistoryRow ? "bat_live_refresh.dry_change" : "bat_live_refresh.dry_no_change";
        console.log(JSON.stringify({ level: "info", event, runId, listingId: row.id, mutation }));
      } else {
        const { error: updateError } = await input.client
          .from("listings")
          .update(mutation.listingUpdates)
          .eq("id", row.id);
        if (updateError) throw new Error(`listing update failed: ${updateError.message}`);

        if (mutation.changed) {
          changed++;
          if (mutation.terminal) terminal++;
        } else {
          console.log(JSON.stringify({ level: "info", event: "bat_live_refresh.no_change", runId, listingId: row.id }));
        }

        if (mutation.priceHistoryRow) {
          const { error: historyError } = await input.client.from("price_history").insert(mutation.priceHistoryRow);
          if (historyError) throw new Error(`price history insert failed: ${historyError.message}`);
          priceHistoryInserted++;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${row.id}: ${message}`);
      console.error(JSON.stringify({ level: "error", event: "bat_live_refresh.listing_error", runId, listingId: row.id, message }));
    }

    const remainingAfterRowMs = input.config.timeBudgetMs - (Date.now() - startedAt);
    if (input.config.delayMs > 0 && index < rows.length - 1 && remainingAfterRowMs > input.config.delayMs) {
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

function shouldTreatExpiredSnapshotAsInconclusive(snapshot: LiveSnapshot, now: Date): boolean {
  if (snapshot.sourceStatus === "ENDED" && snapshot.terminalStatus !== null) return false;
  if (snapshot.endTime && snapshot.endTime.getTime() > now.getTime()) return false;
  return true;
}

function buildVerificationOnlyMutation(nowIso: string): LiveListingMutation {
  return {
    listingUpdates: {
      last_verified_at: nowIso,
    },
    priceHistoryRow: null,
    changed: false,
    terminal: false,
  };
}

async function fetchHtmlWithinBudget(
  fetcher: (url: string, signal?: AbortSignal) => Promise<string>,
  url: string,
  remainingBudgetMs: number,
): Promise<string> {
  const controller = new AbortController();
  let timeout: ReturnType<typeof setTimeout> | undefined;

  const budgetTimeout = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(new Error(`time budget exceeded while fetching ${url}`));
    }, remainingBudgetMs);
    timeout.unref?.();
  });

  try {
    return await Promise.race([fetcher(url, controller.signal), budgetTimeout]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function runPorscheBaTLiveRefreshFromEnv(config: LiveRefreshConfig): Promise<LiveRefreshResult> {
  return runPorscheBaTLiveRefresh({
    client: createLiveRefreshSupabaseClient(),
    fetchHtml,
    config,
  });
}
