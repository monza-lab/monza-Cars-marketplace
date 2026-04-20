import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";

import { loadCheckpoint, saveCheckpoint } from "./checkpoint";
import { fetchAndParseDetail } from "./detail";
import { computeTotalPages, discoverPage } from "./discover";
import { deriveSourceId } from "./id";
import { logEvent } from "./logging";
import { PerDomainRateLimiter } from "./net";
import { normalizeListing, normalizeListingFromSummary } from "./normalize";
import { createDryRunWriter, createSupabaseWriter } from "./supabase_writer";
import type { CollectorCounts, CollectorResult, CollectorRunConfig, ListingSummary, NormalizedListing, ScrapeMeta } from "./types";

export async function runBeForwardPorscheCollector(config: CollectorRunConfig): Promise<CollectorResult> {
  const runId = crypto.randomUUID();
  const scrapeTimestamp = new Date().toISOString();
  const meta: ScrapeMeta = { runId, scrapeTimestamp };
  const limiter = new PerDomainRateLimiter(Math.max(200, config.rateLimitMs));

  logEvent({
    level: "info",
    event: "collector.start",
    runId,
    config,
  });

  await ensureOutputDir(config.outputPath);
  const checkpoint = await loadCheckpoint(config.checkpointPath);
  const writer = config.dryRun ? createDryRunWriter() : createSupabaseWriter();

  if (!config.dryRun) {
    logEvent({ level: "info", event: "collector.db_health_check", runId });
    await writer.healthCheck();
    logEvent({ level: "info", event: "collector.db_health_ok", runId });
  }

  const counts: CollectorCounts = {
    discovered: 0,
    detailsFetched: 0,
    normalized: 0,
    written: 0,
    errors: 0,
  };
  const errors: string[] = [];
  const seenSourceIds = new Set<string>();

  // Always discover page 1 to get fresh totalResults/pageCount.
  // The checkpoint only provides lastCompletedPage for resumption.
  const firstPage = await discoverPage({
    page: 1,
    limiter,
    timeoutMs: config.timeoutMs,
  });
  const rawPageCount = firstPage.totalResults ? computeTotalPages(firstPage.totalResults, 25) : firstPage.pageCount;
  const totalResults = firstPage.totalResults;
  let pageCount = clampPageCount(rawPageCount, config.maxPages, config.startPage);

  const startPage = Math.max(config.startPage, checkpoint.lastCompletedPage + 1);
  let processedPages = 0;
  let remainingDetails = config.maxDetails;

  for (let page = startPage; page <= pageCount; page++) {
    let discovered;
    try {
        discovered = page === 1
          ? firstPage
          : await discoverPage({ page, limiter, timeoutMs: config.timeoutMs });
    } catch (err) {
      counts.errors++;
      const msg = err instanceof Error ? err.message : String(err);
      errors.push(`page=${page}: ${msg}`);
      logEvent({
        level: "warn",
        event: "collector.page_discover_error",
        runId,
        page,
        message: msg,
      });
      continue;
    }

    counts.discovered += discovered.listings.length;

    const pageListings = discovered.listings.filter((listing) => {
      const sourceId = deriveSourceId({ refNo: listing.refNo, sourceUrl: listing.sourceUrl });
      if (seenSourceIds.has(sourceId)) return false;
      seenSourceIds.add(sourceId);
      return true;
    });

    const toProcess = config.summaryOnly
      ? pageListings
      : remainingDetails > 0
        ? pageListings.slice(0, remainingDetails)
        : [];

    // Phase 1: Fetch and normalize in parallel (HTTP concurrency)
    const fetchResults = await mapWithConcurrency(toProcess, config.concurrency, async (summary) => {
      try {
        if (config.summaryOnly) {
          return normalizeListingFromSummary({ summary, meta });
        }
        const detail = await fetchAndParseDetail({
          url: summary.sourceUrl,
          timeoutMs: config.timeoutMs,
          limiter,
        });
        counts.detailsFetched++;
        return normalizeListing({ summary, detail, meta }) ?? normalizeListingFromSummary({ summary, meta });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${summary.sourceUrl}: ${msg}`);
        logEvent({
          level: "warn",
          event: "collector.fetch_error",
          runId,
          page,
          url: summary.sourceUrl,
          message: msg,
        });
        return normalizeListingFromSummary({ summary, meta });
      }
    });

    // Phase 2: Write to DB sequentially (avoids connection/lock contention)
    const normalizedRows: (NormalizedListing | null)[] = [];
    for (const row of fetchResults) {
      if (!row) { normalizedRows.push(null); continue; }
      counts.normalized++;
      try {
        await writer.upsertAll(row, meta, config.dryRun);
        counts.written++;
        normalizedRows.push(row);
      } catch (err) {
        counts.errors++;
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`DB write ${row.sourceUrl}: ${msg}`);
        logEvent({
          level: "error",
          event: "collector.db_write_error",
          runId,
          page,
          url: row.sourceUrl,
          message: msg,
        });
        normalizedRows.push(row); // still include in JSONL output
      }
    }

    await appendJsonl(
      config.outputPath,
      normalizedRows
        .filter((row): row is NormalizedListing => row !== null)
        .map((row) => JSON.stringify(row)),
    );

    remainingDetails = Math.max(0, remainingDetails - toProcess.length);
    processedPages++;

    await saveCheckpoint(config.checkpointPath, {
      version: 1,
      updatedAt: new Date().toISOString(),
      totalResults,
      pageCount: rawPageCount,
      lastCompletedPage: page,
      written: counts.written,
      errors: counts.errors,
    });

    logEvent({
      level: "info",
      event: "collector.page_done",
      runId,
      page,
      discovered: discovered.listings.length,
      written: counts.written,
      errors: counts.errors,
    });
  }

  logEvent({
    level: "info",
    event: "collector.done",
    runId,
    counts,
    processedPages,
    pageCount,
    totalResults,
  });

  return {
    runId,
    totalResults,
    pageCount,
    processedPages,
    counts,
    errors,
    outputPath: config.outputPath,
  };
}

function clampPageCount(pageCount: number, maxPages: number, startPage: number): number {
  const safeStart = Math.max(1, startPage);
  const upper = Math.max(safeStart, safeStart + Math.max(0, maxPages) - 1);
  return Math.min(Math.max(safeStart, pageCount), upper);
}

async function ensureOutputDir(filePath: string): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function appendJsonl(filePath: string, lines: string[]): Promise<void> {
  if (lines.length === 0) return;
  await fs.appendFile(filePath, lines.join("\n") + "\n", "utf8");
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const c = Math.max(1, Math.min(concurrency, 20));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: Math.min(c, items.length) }, async () => {
    while (true) {
      const index = cursor;
      cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

export async function runCollector(overrides: Partial<CollectorRunConfig> = {}): Promise<CollectorResult> {
  const config: CollectorRunConfig = {
    mode: "daily",
    make: overrides.make ?? "Porsche",
    maxPages: overrides.maxPages ?? 200,
    startPage: overrides.startPage ?? 1,
    maxDetails: overrides.maxDetails ?? 10000,
    summaryOnly: overrides.summaryOnly ?? false,
    concurrency: overrides.concurrency ?? 3,
    rateLimitMs: overrides.rateLimitMs ?? 4000,
    timeoutMs: overrides.timeoutMs ?? 20000,
    checkpointPath: overrides.checkpointPath ?? "var/beforward_porsche_collector/checkpoint.json",
    outputPath: overrides.outputPath ?? "var/beforward_porsche_collector/listings.jsonl",
    dryRun: overrides.dryRun ?? false,
  };

  return runBeForwardPorscheCollector(config);
}

export type { ListingSummary };
