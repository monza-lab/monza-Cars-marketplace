/**
 * CLI: Enrich listings with missing engine/transmission/body by decoding their VINs via NHTSA.
 *
 * Usage:
 *   npx tsx scripts/enrich-from-vin.ts
 *   npx tsx scripts/enrich-from-vin.ts --limit=500 --dryRun
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
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

import { decodeVinsInBatches } from "../src/features/scrapers/common/nhtsaVinDecoder";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 1000, dryRun: false, delayMs: 1000 };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "delayMs") opts.delayMs = parseInt(val, 10);
    } else {
      if (arg.slice(2) === "dryRun") opts.dryRun = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n=== VIN Enrichment ===`);
  console.log(`Limit: ${opts.limit}, Dry run: ${opts.dryRun}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Query listings with VINs but missing engine/transmission/body_style
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, vin, engine, transmission, body_style")
    .not("vin", "is", null)
    .neq("vin", "")
    .or("engine.is.null,transmission.is.null,body_style.is.null")
    .eq("status", "active")
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} listings with VINs needing enrichment`);
  if (listings.length === 0) return;

  const vins = listings.map((l) => l.vin as string);
  const decoded = await decodeVinsInBatches(vins, {
    delayMs: opts.delayMs,
    onBatch: (batch, total) => console.log(`  Batch ${batch}/${total}...`),
  });

  console.log(`\nDecoded ${decoded.size}/${vins.length} VINs successfully`);

  let updated = 0;
  for (const listing of listings) {
    const fields = decoded.get(listing.vin);
    if (!fields) continue;

    // Only fill null fields — never overwrite existing data
    const updates: Record<string, string> = {};
    if (!listing.engine && fields.engine) updates.engine = fields.engine;
    if (!listing.transmission && fields.transmission) updates.transmission = fields.transmission;
    if (!listing.body_style && fields.bodyStyle) updates.body_style = fields.bodyStyle;

    if (Object.keys(updates).length === 0) continue;

    if (opts.dryRun) {
      console.log(`  [DRY RUN] ${listing.id}: ${JSON.stringify(updates)}`);
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
  console.log(`Listings queried: ${listings.length}`);
  console.log(`VINs decoded: ${decoded.size}`);
  console.log(`Listings updated: ${updated}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
