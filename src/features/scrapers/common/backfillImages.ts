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
    .or("images.is.null,images.eq.[]");

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
  const fetcherMap = await buildImageFetcherMap();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    // Time budget check
    if (Date.now() - startMs > timeBudgetMs - safetyMarginMs) {
      console.log(
        `[backfill-images] Time budget exceeded after ${result.backfilled} backfills`
      );
      break;
    }

    const source = row.source as string;
    const fetcher = fetcherMap[source];
    if (!fetcher) {
      result.errors.push(`No image fetcher for source: ${source}`);
      continue;
    }

    try {
      // Rate limit (skip delay on first iteration)
      if (i > 0 && delayMs > 0) {
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
        console.log(
          `[backfill-images] [${i + 1}/${rows.length}] ${row.id} (${source}): ${images.length} images`
        );
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);

      // Mark dead URLs so they stop being queried for backfill
      if (/\b(404|410)\b/.test(msg)) {
        if (!opts.dryRun) {
          await client
            .from("listings")
            .update({
              status: "unsold",
              updated_at: new Date().toISOString(),
            })
            .eq("id", row.id);
        }
        result.errors.push(`Dead URL (${row.id}): ${msg}`);
        continue;
      }

      // Circuit-break on 403/429/Cloudflare
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
