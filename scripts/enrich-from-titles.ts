/**
 * CLI: Enrich listings with missing engine/transmission/trim/body by parsing titles.
 *
 * Usage:
 *   npx tsx scripts/enrich-from-titles.ts
 *   npx tsx scripts/enrich-from-titles.ts --limit=5000 --dryRun
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

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

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "../src/features/scrapers/common/titleEnrichment";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 5000, dryRun: false, source: "" };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "source") opts.source = val;
    } else {
      if (arg.slice(2) === "dryRun") opts.dryRun = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n=== Title Enrichment ===`);
  console.log(`Limit: ${opts.limit}, Dry run: ${opts.dryRun}`);
  if (opts.source) console.log(`Source filter: ${opts.source}`);
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Query listings with at least one null field that could be enriched from title
  let query = supabase
    .from("listings")
    .select("id, title, engine, transmission, body_style, trim, source")
    .or("engine.is.null,transmission.is.null,body_style.is.null,trim.is.null")
    .eq("status", "active")
    .not("title", "is", null)
    .limit(opts.limit);

  if (opts.source) {
    query = query.eq("source", opts.source);
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} listings with parseable titles\n`);

  let updated = 0;
  let skipped = 0;
  const stats = { engine: 0, transmission: 0, bodyStyle: 0, trim: 0 };

  for (const listing of listings) {
    const title = listing.title as string;
    const updates: Record<string, string> = {};

    if (!listing.engine) {
      const engine = parseEngineFromText(title);
      if (engine) {
        updates.engine = engine;
        stats.engine++;
      }
    }
    if (!listing.transmission) {
      const transmission = parseTransmissionFromText(title);
      if (transmission) {
        updates.transmission = transmission;
        stats.transmission++;
      }
    }
    if (!listing.body_style) {
      const bodyStyle = parseBodyStyleFromText(title);
      if (bodyStyle) {
        updates.body_style = bodyStyle;
        stats.bodyStyle++;
      }
    }
    if (!listing.trim) {
      const trim = parseTrimFromText(title);
      if (trim) {
        updates.trim = trim;
        stats.trim++;
      }
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      if (updated < 20) {
        console.log(`  [DRY] "${title.slice(0, 60)}" → ${JSON.stringify(updates)}`);
      }
    } else {
      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);
      if (updateErr) {
        console.error(`  Error updating ${listing.id}: ${updateErr.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings scanned: ${listings.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no parseable data): ${skipped}`);
  console.log(`Fields filled — engine: ${stats.engine}, transmission: ${stats.transmission}, body: ${stats.bodyStyle}, trim: ${stats.trim}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
