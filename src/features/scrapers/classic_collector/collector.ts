import crypto from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import type {
  CollectorRunConfig,
  CollectorResult,
  CollectorCounts,
  ScrapeMeta,
  NormalizedListing,
  ListingSummary,
} from "./types";
import { launchStealthBrowser, createStealthContext, createPage, closeBrowser } from "./browser";
import { discoverAllListings } from "./discover";
import { fetchAndParseDetail } from "./detail";
import { normalizeListing, normalizeListingFromSummary } from "./normalize";
import { NavigationRateLimiter, withRetry } from "./net";
import { loadCheckpoint, saveCheckpoint, type CollectorCheckpoint } from "./checkpoint";
import { createSupabaseWriter, createDryRunWriter, type SupabaseWriter } from "./supabase_writer";
import { logEvent } from "./logging";
import { recordScraperRun } from "@/features/scrapers/common/monitoring";

const MAX_CONSECUTIVE_CF_BLOCKS = 10;
const CONTEXT_REFRESH_INTERVAL = 100;

export async function runClassicComCollector(config: CollectorRunConfig): Promise<CollectorResult> {
  const runId = crypto.randomUUID();
  const scrapeTimestamp = new Date().toISOString();
  const meta: ScrapeMeta = { runId, scrapeTimestamp };
  const errors: string[] = [];

  const counts: CollectorCounts = {
    discovered: 0,
    detailsFetched: 0,
    normalized: 0,
    written: 0,
    errors: 0,
    cloudflareBlocked: 0,
  };

  const startMs = Date.now();

  logEvent({ level: "info", event: "collector.start", runId, config });

  const runConfig = config;

  // Load checkpoint
  const checkpoint = await loadCheckpoint(runConfig.checkpointPath);

  // Create writer
  const writer: SupabaseWriter = runConfig.dryRun ? createDryRunWriter() : createSupabaseWriter();

  // Ensure output directory exists
  const outputDir = path.dirname(runConfig.outputPath);
  await fs.mkdir(outputDir, { recursive: true });

  // Launch browser
  const browser = await launchStealthBrowser({
    headless: runConfig.headless,
  });

  let context = await createStealthContext(browser, {
    headless: runConfig.headless,
  });
  let page = await createPage(context);
  const rateLimiter = new NavigationRateLimiter(runConfig.navigationDelayMs);

  try {
    /* ---------------------------------------------------------------- */
    /*  DISCOVER PHASE                                                   */
    /* ---------------------------------------------------------------- */

    logEvent({ level: "info", event: "collector.discover_start", runId });

    const discoverResult = await discoverAllListings({
      page,
      make: runConfig.make,
      location: runConfig.location,
      status: runConfig.status,
      maxPages: runConfig.maxPages,
      maxListings: runConfig.maxListings,
      navigationDelayMs: runConfig.navigationDelayMs,
      pageTimeoutMs: runConfig.pageTimeoutMs,
      runId,
    });

    const allListings = discoverResult.listings;
    counts.discovered = allListings.length;

    logEvent({
      level: "info",
      event: "collector.discover_done",
      runId,
      discovered: counts.discovered,
      totalResults: discoverResult.totalResults,
    });

    if (counts.discovered === 0) {
      logEvent({ level: "warn", event: "collector.no_listings", runId });
      await closeBrowser(browser);
      return { runId, totalResults: discoverResult.totalResults, counts, errors, outputPath: config.outputPath };
    }

    /* ---------------------------------------------------------------- */
    /*  SUMMARY-ONLY MODE: skip detail fetches, normalize from search    */
    /* ---------------------------------------------------------------- */

    if (config.summaryOnly) {
      for (const summary of allListings) {
        const normalized = normalizeListingFromSummary({ summary, meta });
        if (normalized) {
          counts.normalized++;
          try {
            const { wrote } = await writer.upsertAll(normalized, meta, runConfig.dryRun);
            if (wrote) counts.written++;
            await fs.appendFile(runConfig.outputPath, JSON.stringify(normalized) + "\n", "utf8");
          } catch (err) {
            counts.errors++;
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Write error: ${msg}`);
          }
        } else {
          counts.errors++;
          errors.push(`Normalize failed: ${summary.title ?? summary.sourceUrl}`);
        }
      }

      // Backfill images for listings missing them (using leftover time)
      if (runConfig.timeBudgetMs) {
        const elapsedMs = Date.now() - startMs;
        const remainingMs = runConfig.timeBudgetMs - elapsedMs;
        if (remainingMs > 40_000) {
          try {
            const { backfillMissingImages } = await import("./backfill");
            const backfillResult = await backfillMissingImages({
              page,
              timeBudgetMs: remainingMs,
              maxListings: 5,
              navigationDelayMs: runConfig.navigationDelayMs,
              pageTimeoutMs: runConfig.pageTimeoutMs,
              runId,
            });
            counts.backfillDiscovered = backfillResult.discovered;
            counts.backfillWritten = backfillResult.backfilled;
            if (backfillResult.errors.length > 0) {
              errors.push(...backfillResult.errors);
            }
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err);
            errors.push(`Backfill error: ${msg}`);
          }
        }
      }
    } else {

    /* ---------------------------------------------------------------- */
    /*  DETAIL + NORMALIZE + WRITE LOOP                                  */
    /* ---------------------------------------------------------------- */

    let consecutiveCfBlocks = 0;
    const startIndex = Math.max(0, checkpoint.lastCompletedIndex + 1);

    for (let i = startIndex; i < allListings.length; i++) {
      // Time-budget guard: stop if less than 15s remaining
      if (runConfig.timeBudgetMs && (Date.now() - startMs) > (runConfig.timeBudgetMs - 15_000)) {
        logEvent({ level: "info", event: "collector.time_budget_exceeded", runId, elapsedMs: Date.now() - startMs });
        break;
      }

      // Circuit breaker: abort after too many consecutive Cloudflare blocks
      if (consecutiveCfBlocks >= MAX_CONSECUTIVE_CF_BLOCKS) {
        const msg = `Aborting: ${MAX_CONSECUTIVE_CF_BLOCKS} consecutive Cloudflare blocks`;
        logEvent({ level: "error", event: "collector.circuit_breaker", runId, message: msg });
        errors.push(msg);
        break;
      }

      // Refresh browser context periodically to prevent memory leaks
      if (i > 0 && i % CONTEXT_REFRESH_INTERVAL === 0) {
        logEvent({ level: "info", event: "collector.context_refresh", runId, index: i });
        await page.close().catch(() => {});
        await context.close().catch(() => {});
        context = await createStealthContext(browser, {
          headless: runConfig.headless,
        });
        page = await createPage(context);
      }

      const summary = allListings[i];

      logEvent({
        level: "debug",
        event: "collector.detail_start",
        runId,
        index: i,
        url: summary.sourceUrl,
      });

      let normalized: NormalizedListing | null = null;

      try {
        // Rate limit
        await rateLimiter.waitBeforeNavigation();

        // Fetch detail with retry
        const { value: detail } = await withRetry(
          async () => fetchAndParseDetail({
            page,
            url: summary.sourceUrl,
            pageTimeoutMs: runConfig.pageTimeoutMs,
            runId,
          }),
          { retries: 2, baseDelayMs: 3000 },
        );

        counts.detailsFetched++;
        consecutiveCfBlocks = 0;

        // Normalize with full detail
        normalized = normalizeListing({ summary, detail, meta });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);

        if (msg.includes("Cloudflare")) {
          consecutiveCfBlocks++;
          counts.cloudflareBlocked++;
          logEvent({ level: "warn", event: "collector.cloudflare_block", runId, index: i, consecutive: consecutiveCfBlocks });

          // Refresh context after CF block to get a new browser fingerprint
          if (consecutiveCfBlocks < MAX_CONSECUTIVE_CF_BLOCKS) {
            logEvent({ level: "info", event: "collector.context_refresh_cf", runId, index: i });
            await page.close().catch(() => {});
            await context.close().catch(() => {});
            context = await createStealthContext(browser, {
              headless: runConfig.headless,
            });
            page = await createPage(context, true);
          }
        } else {
          consecutiveCfBlocks = 0;
          logEvent({ level: "warn", event: "collector.detail_error", runId, index: i, error: msg });
        }

        // Fallback: normalize from summary only
        normalized = normalizeListingFromSummary({ summary, meta });
      }

      // Write to DB
      if (normalized) {
        counts.normalized++;
        try {
          const { wrote } = await writer.upsertAll(normalized, meta, runConfig.dryRun);
          if (wrote) counts.written++;

          // Append to JSONL output
          await fs.appendFile(runConfig.outputPath, JSON.stringify(normalized) + "\n", "utf8");
        } catch (err) {
          counts.errors++;
          const msg = err instanceof Error ? err.message : String(err);
          errors.push(`Write error [${i}]: ${msg}`);
          logEvent({ level: "error", event: "collector.write_error", runId, index: i, error: msg });
        }
      } else {
        counts.errors++;
        logEvent({ level: "warn", event: "collector.normalize_skip", runId, index: i, title: summary.title });
      }

      // Save checkpoint
      const cp: CollectorCheckpoint = {
        version: 1,
        updatedAt: new Date().toISOString(),
        totalResults: discoverResult.totalResults,
        lastCompletedIndex: i,
        written: counts.written,
        errors: counts.errors,
      };
      await saveCheckpoint(runConfig.checkpointPath, cp);

      // Progress log every 10 listings
      if ((i + 1) % 10 === 0 || i === allListings.length - 1) {
        logEvent({
          level: "info",
          event: "collector.progress",
          runId,
          index: i + 1,
          total: allListings.length,
          counts,
        });
      }
    }

    } // end else (detail mode)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    errors.push(`Fatal: ${msg}`);
    logEvent({ level: "error", event: "collector.fatal", runId, error: msg });
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await closeBrowser(browser);
  }

  logEvent({ level: "info", event: "collector.done", runId, counts, errorsCount: errors.length });

  if (!config.skipMonitoring) {
    const endTime = Date.now();
    const runtime = process.env.GITHUB_ACTIONS ? 'github_actions' as const : 'cli' as const;

    await recordScraperRun({
      scraper_name: 'classic',
      run_id: runId,
      started_at: scrapeTimestamp,
      finished_at: new Date(endTime).toISOString(),
      success: errors.length === 0 || counts.written > 0,
      runtime,
      duration_ms: endTime - new Date(scrapeTimestamp).getTime(),
      discovered: counts.discovered,
      written: counts.written,
      errors_count: counts.errors,
      details_fetched: counts.detailsFetched,
      normalized: counts.normalized,
      bot_blocked: counts.cloudflareBlocked,
      error_messages: errors.length > 0 ? errors : undefined,
    });
  }

  return {
    runId,
    totalResults: counts.discovered,
    counts,
    errors,
    outputPath: runConfig.outputPath,
  };
}

/**
 * Convenience wrapper with sensible defaults.
 */
export async function runCollector(overrides?: Partial<CollectorRunConfig>): Promise<CollectorResult> {
  const config: CollectorRunConfig = {
    mode: "daily",
    make: "Porsche",
    location: "US",
    status: "forsale",
    maxPages: 10,
    maxListings: 500,
    headless: true,
    navigationDelayMs: 3000,
    pageTimeoutMs: 30000,
    checkpointPath: "var/classic_collector/checkpoint.json",
    outputPath: "var/classic_collector/listings.jsonl",
    dryRun: false,
    ...overrides,
  };
  return runClassicComCollector(config);
}
