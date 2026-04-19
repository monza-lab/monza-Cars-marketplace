// One-shot: applies the canonical price columns migration against
// DATABASE_URL and prints population stats per source.
//
// Run with: npx tsx scripts/apply-canonical-price-columns.ts

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

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

const MIGRATION = "supabase/migrations/20260419_listings_canonical_price_columns.sql";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");

  const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("[apply] connected");

  const sql = readFileSync(resolve(process.cwd(), MIGRATION), "utf8");
  const t0 = Date.now();
  await client.query(sql);
  console.log(`[apply] ${MIGRATION} — ${Date.now() - t0}ms`);

  const { rows } = await client.query(`
    SELECT source,
           count(*)                                              AS total,
           count(*) FILTER (WHERE listing_price IS NOT NULL)     AS has_listing_price,
           count(*) FILTER (WHERE sold_price IS NOT NULL)        AS has_sold_price
    FROM listings
    GROUP BY source
    ORDER BY source
  `);
  console.log("[apply] population by source:");
  console.table(rows);

  const { rows: totals } = await client.query(`
    SELECT count(*)                                          AS total,
           count(*) FILTER (WHERE listing_price IS NOT NULL) AS with_listing,
           count(*) FILTER (WHERE sold_price IS NOT NULL)    AS with_sold
    FROM listings
  `);
  console.log("[apply] totals:", totals[0]);

  await client.end();
  console.log("[apply] done");
}

main().catch((err) => {
  console.error("[apply] FAILED:", err);
  process.exit(1);
});
