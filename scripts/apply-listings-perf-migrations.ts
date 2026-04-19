// One-shot: applies the three listings-scale-performance migrations against
// DATABASE_URL, seeds the MV, and prints a summary. Safe to re-run (all DDL
// uses IF NOT EXISTS / CREATE OR REPLACE).
//
// Run with: npx tsx scripts/apply-listings-perf-migrations.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

// Minimal .env.local loader (avoid adding dotenv as a dep).
function loadDotEnv() {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      const [, k, rawV] = m;
      if (process.env[k]) continue;
      const v = rawV.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      process.env[k] = v;
    }
  } catch {}
}
loadDotEnv();

const MIGRATIONS = [
  "supabase/migrations/20260419_listings_series_column.sql",
  "supabase/migrations/20260419_listings_active_partial_index.sql",
  "supabase/migrations/20260419_listings_active_counts_mv.sql",
  "supabase/migrations/20260420_dashboard_valuation_by_family_cache.sql",
];

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("[apply] connected");

  for (const relPath of MIGRATIONS) {
    const abs = resolve(process.cwd(), relPath);
    const sql = readFileSync(abs, "utf8");
    const t0 = Date.now();
    await client.query(sql);
    console.log(`[apply] ${relPath} — ${Date.now() - t0}ms`);
  }

  const t0 = Date.now();
  await client.query("REFRESH MATERIALIZED VIEW listings_active_counts");
  console.log(`[apply] seed MV — ${Date.now() - t0}ms`);

  const { rows: mvStats } = await client.query(
    "SELECT count(*) AS groups, sum(live_count) AS total FROM listings_active_counts",
  );
  console.log(`[apply] MV stats: ${JSON.stringify(mvStats[0])}`);

  const { rows: colStats } = await client.query(
    `SELECT count(*) FILTER (WHERE series IS NOT NULL) AS classified,
            count(*) FILTER (WHERE series IS NULL)     AS unclassified,
            count(*)                                   AS total
       FROM listings`,
  );
  console.log(`[apply] series coverage: ${JSON.stringify(colStats[0])}`);

  await client.end();
  console.log("[apply] done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
