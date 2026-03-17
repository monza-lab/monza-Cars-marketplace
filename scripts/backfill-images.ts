/**
 * CLI script for bulk image backfill.
 *
 * Usage:
 *   npx tsx scripts/backfill-images.ts
 *   npx tsx scripts/backfill-images.ts --source BaT --limit 100
 *   npx tsx scripts/backfill-images.ts --dry-run
 *   npx tsx scripts/backfill-images.ts --source BaT --delay 3000
 */
import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
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

// Parse CLI args
function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    source: "all",
    limit: 0, // 0 = no limit
    dryRun: false,
    delay: 2000,
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--source":
        opts.source = args[++i];
        break;
      case "--limit":
        opts.limit = parseInt(args[++i], 10);
        break;
      case "--dry-run":
        opts.dryRun = true;
        break;
      case "--delay":
        opts.delay = parseInt(args[++i], 10);
        break;
      case "--help":
        console.log(`
Usage: npx tsx scripts/backfill-images.ts [options]

Options:
  --source <name>   Filter by source (BaT, BeForward, AutoScout24, all)
  --limit <n>       Max listings to process (default: all active with empty images)
  --dry-run         Preview without writing to DB
  --delay <ms>      Delay between requests (default: 2000)
  --help            Show this help
        `);
        process.exit(0);
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n=== Image Backfill CLI ===`);
  console.log(`Source: ${opts.source}`);
  console.log(`Limit: ${opts.limit || "unlimited"}`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Delay: ${opts.delay}ms\n`);

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Count missing
  let countQuery = client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("status", "active")
    .eq("images", "{}");

  if (opts.source !== "all") {
    countQuery = countQuery.eq("source", opts.source);
  }

  const { count } = await countQuery;
  console.log(`Found ${count ?? 0} active listings with empty images\n`);

  if ((count ?? 0) === 0) {
    console.log("Nothing to do!");
    return;
  }

  // Import the backfill function
  const { backfillImagesForSource } = await import(
    "../src/features/scrapers/common/backfillImages"
  );

  // For "all" mode, process each source separately
  const sources =
    opts.source === "all"
      ? ["BaT", "BeForward", "AutoScout24"]
      : [opts.source];

  let grandTotal = 0;
  let grandBackfilled = 0;
  let grandErrors = 0;

  for (const source of sources) {
    console.log(`\n--- Processing ${source} ---`);

    const result = await backfillImagesForSource({
      source: source as "BaT" | "BeForward" | "AutoScout24" | "all",
      maxListings: opts.limit || 10_000,
      delayMs: opts.delay,
      timeBudgetMs: 24 * 60 * 60 * 1000, // No real time limit for CLI
      dryRun: opts.dryRun,
    });

    grandTotal += result.discovered;
    grandBackfilled += result.backfilled;
    grandErrors += result.errors.length;

    console.log(`  Discovered: ${result.discovered}`);
    console.log(`  Backfilled: ${result.backfilled}`);
    console.log(`  Errors: ${result.errors.length}`);
    console.log(`  Duration: ${result.durationMs}ms`);

    if (result.errors.length > 0) {
      console.log(`  Error details:`);
      for (const err of result.errors.slice(0, 10)) {
        console.log(`    - ${err}`);
      }
      if (result.errors.length > 10) {
        console.log(`    ... and ${result.errors.length - 10} more`);
      }
    }
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Total discovered: ${grandTotal}`);
  console.log(`Total backfilled: ${grandBackfilled}`);
  console.log(`Total errors: ${grandErrors}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
