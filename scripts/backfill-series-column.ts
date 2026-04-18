/**
 * One-shot backfill script: populate listings.series for historical rows.
 *
 * Usage:
 *   npx tsx scripts/backfill-series-column.ts
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Does NOT run automatically from any cron or test.
 */

import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import { computeSeries } from "../src/features/scrapers/common/seriesEnrichment";

// Load .env.local if it exists (local development)
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

// ---------------------------------------------------------------------------
// Pure mapping function — exported for unit tests
// ---------------------------------------------------------------------------

export function mapRowToUpdate(row: {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  title: string | null;
}): { id: string; series: string } | null {
  // Skip rows with no make — computeSeries can't work without it
  if (!row.make) return null;

  const series = computeSeries({
    make: row.make,
    model: row.model,
    year: row.year,
    title: row.title,
  });

  if (!series) return null;

  return { id: row.id, series };
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const PAGE_SIZE = 1000;
const CHUNK_SIZE = 500;

async function main(): Promise<void> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[backfill] Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let lastId = "";
  let totalUpdated = 0;
  let totalRows = 0;
  let page = 0;

  console.log("[backfill] Starting series backfill...");

  while (true) {
    page++;

    // Keyset pagination: WHERE series IS NULL AND id > lastId ORDER BY id ASC LIMIT PAGE_SIZE
    const query = supabase
      .from("listings")
      .select("id, make, model, year, title")
      .is("series", null)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (lastId) {
      query.gt("id", lastId);
    }

    const { data: rows, error } = await query;

    if (error) {
      console.error(`[backfill] Query error on page ${page}:`, error.message);
      process.exit(1);
    }

    if (!rows || rows.length === 0) {
      console.log("[backfill] No more rows with series IS NULL. Done.");
      break;
    }

    totalRows += rows.length;
    lastId = rows[rows.length - 1].id as string;

    // Compute updates
    const updates = rows
      .map((row) =>
        mapRowToUpdate({
          id: row.id as string,
          make: row.make as string | null,
          model: row.model as string | null,
          year: row.year as number | null,
          title: row.title as string | null,
        })
      )
      .filter((u): u is { id: string; series: string } => u !== null);

    // Upsert in chunks of CHUNK_SIZE
    let pageUpdated = 0;
    for (let i = 0; i < updates.length; i += CHUNK_SIZE) {
      const chunk = updates.slice(i, i + CHUNK_SIZE);

      const { error: upsertErr } = await supabase
        .from("listings")
        .upsert(chunk, { onConflict: "id" });

      if (upsertErr) {
        console.error(`[backfill] Upsert error (chunk starting at ${i}):`, upsertErr.message);
        process.exit(1);
      }

      pageUpdated += chunk.length;
    }

    totalUpdated += pageUpdated;
    console.log(`[backfill] updated ${pageUpdated} rows (lastId=${lastId})`);

    // If fewer rows than PAGE_SIZE, we've reached the end
    if (rows.length < PAGE_SIZE) {
      break;
    }
  }

  console.log(
    `[backfill] Summary: scanned ${totalRows} rows with series IS NULL, updated ${totalUpdated} rows across ${page} page(s).`
  );
}

// Self-execution guard: only run when this file is the entry point
// Matches the import.meta.url ESM pattern (tsx runs scripts as ESM)
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
