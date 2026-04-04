import { createClient } from "@supabase/supabase-js";

import { fetchAndParseDetail } from "./detail";
import { PerDomainRateLimiter } from "./net";

export interface BackfillResult {
  discovered: number;
  backfilled: number;
  errors: string[];
}

/**
 * Backfill images for active BeForward listings that were scraped with summaryOnly=true.
 * Fetches detail pages to extract gallery images, then updates the DB.
 * Stops 15s before time budget expires to leave room for metrics.
 */
export async function backfillMissingImages(opts: {
  timeBudgetMs: number;
  maxListings?: number;
  rateLimitMs?: number;
  timeoutMs?: number;
  runId: string;
}): Promise<BackfillResult> {
  const maxListings = opts.maxListings ?? 20;
  const rateLimitMs = opts.rateLimitMs ?? 2500;
  const timeoutMs = opts.timeoutMs ?? 20_000;
  const safetyMarginMs = 15_000;
  const RATE_LIMIT_BACKOFF_MS = 6_000;
  const MAX_RATE_LIMITS = 3;
  let consecutiveRateLimits = 0;

  const result: BackfillResult = { discovered: 0, backfilled: 0, errors: [] };

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    result.errors.push("Missing Supabase env vars");
    return result;
  }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Find active BeForward listings with no images
  const { data: rows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url")
    .eq("source", "BeForward")
    .eq("status", "active")
    .or("images.is.null,images.eq.{}")
    .order("scrape_timestamp", { ascending: true })
    .limit(maxListings);

  if (fetchErr || !rows) {
    result.errors.push(fetchErr?.message ?? "No rows returned");
    return result;
  }

  result.discovered = rows.length;
  if (rows.length === 0) return result;

  const limiter = new PerDomainRateLimiter(rateLimitMs);
  const startMs = Date.now();

  for (const row of rows) {
    // Time budget check: stop 15s before budget expires
    const elapsed = Date.now() - startMs;
    if (elapsed > opts.timeBudgetMs - safetyMarginMs) {
      break;
    }

    try {
      const detail = await fetchAndParseDetail({
        url: row.source_url,
        timeoutMs,
        limiter,
      });

      if (!detail.images || detail.images.length === 0) {
        continue;
      }

      const { error: updateErr } = await client
        .from("listings")
        .update({
          images: detail.images,
          photos_count: detail.images.length,
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id);

      if (updateErr) {
        result.errors.push(`Update failed for ${row.source_url}: ${updateErr.message}`);
      } else {
        result.backfilled++;
        consecutiveRateLimits = 0;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Circuit-break on 403/429 — site is blocking us
      if (/\b(403|429)\b/.test(msg)) {
        consecutiveRateLimits++;
        result.errors.push(`Rate limited (${consecutiveRateLimits}/${MAX_RATE_LIMITS}): ${msg}`);
        if (consecutiveRateLimits >= MAX_RATE_LIMITS) {
          result.errors.push(`Circuit-break: ${msg}`);
          break;
        }
        await new Promise((r) => setTimeout(r, RATE_LIMIT_BACKOFF_MS));
        continue;
      }

      consecutiveRateLimits = 0;
      result.errors.push(`Backfill failed for ${row.source_url}: ${msg}`);
    }
  }

  return result;
}
