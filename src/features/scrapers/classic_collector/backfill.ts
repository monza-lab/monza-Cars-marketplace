import { createClient } from "@supabase/supabase-js";
import type { Page } from "playwright-core";

import { fetchAndParseDetail } from "./detail";
import { NavigationRateLimiter } from "./net";

export interface BackfillResult {
  discovered: number;
  backfilled: number;
  errors: string[];
}

/**
 * Backfill images for active Classic.com listings that were scraped with summaryOnly=true.
 * Uses Playwright to navigate detail pages and extract images, then updates the DB.
 * Stops 20s before time budget expires (Playwright cleanup is slower).
 */
export async function backfillMissingImages(opts: {
  page: Page;
  timeBudgetMs: number;
  maxListings?: number;
  navigationDelayMs?: number;
  pageTimeoutMs?: number;
  runId: string;
}): Promise<BackfillResult> {
  const maxListings = opts.maxListings ?? 5;
  const navigationDelayMs = opts.navigationDelayMs ?? 3000;
  const pageTimeoutMs = opts.pageTimeoutMs ?? 20_000;
  const safetyMarginMs = 20_000;

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

  // Find active ClassicCom listings with no images
  const { data: rows, error: fetchErr } = await client
    .from("listings")
    .select("id,source_url")
    .eq("source", "ClassicCom")
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

  const limiter = new NavigationRateLimiter(navigationDelayMs);
  const startMs = Date.now();

  for (const row of rows) {
    // Time budget check: stop 20s before budget expires
    const elapsed = Date.now() - startMs;
    if (elapsed > opts.timeBudgetMs - safetyMarginMs) {
      break;
    }

    try {
      await limiter.waitBeforeNavigation();

      const detail = await fetchAndParseDetail({
        page: opts.page,
        url: row.source_url,
        pageTimeoutMs,
        runId: opts.runId,
      });

      const images = detail.raw.images;
      if (!images || images.length === 0) {
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
        result.errors.push(`Update failed for ${row.source_url}: ${updateErr.message}`);
      } else {
        result.backfilled++;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Circuit-break on Cloudflare blocks
      if (/cloudflare/i.test(msg)) {
        result.errors.push(`Circuit-break (Cloudflare): ${msg}`);
        break;
      }

      result.errors.push(`Backfill failed for ${row.source_url}: ${msg}`);
    }
  }

  return result;
}
