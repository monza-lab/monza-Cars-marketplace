/**
 * Quick diagnostic: count listings missing images in Supabase
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";

// Load .env.local manually
const envPath = resolve(__dirname, "../.env.local");
const envContent = readFileSync(envPath, "utf-8");
for (const line of envContent.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const eqIdx = trimmed.indexOf("=");
  if (eqIdx === -1) continue;
  const key = trimmed.slice(0, eqIdx).trim();
  const value = trimmed.slice(eqIdx + 1).trim();
  if (!process.env[key]) process.env[key] = value;
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

async function main() {
  // Total listings count
  const { count: totalCount, error: totalErr } = await client
    .from("listings")
    .select("*", { count: "exact", head: true });

  if (totalErr) {
    console.error("Error counting total:", totalErr.message);
    return;
  }
  console.log(`\nTotal listings: ${totalCount}`);

  // Listings with NULL images
  const { count: nullImages, error: nullErr } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .is("images", null);

  if (nullErr) {
    console.error("Error counting null images:", nullErr.message);
    return;
  }
  console.log(`Listings with NULL images: ${nullImages}`);

  // Listings with empty array images
  const { count: emptyImages, error: emptyErr } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("images", "{}");

  if (emptyErr) {
    console.error("Error counting empty images:", emptyErr.message);
    return;
  }
  console.log(`Listings with empty images []: ${emptyImages}`);

  const totalMissing = (nullImages ?? 0) + (emptyImages ?? 0);
  console.log(`\n--- TOTAL MISSING IMAGES: ${totalMissing} / ${totalCount} ---`);
  console.log(
    `Percentage missing: ${((totalMissing / (totalCount ?? 1)) * 100).toFixed(1)}%`
  );

  // Breakdown by source — use distinct source values then count per source
  console.log("\n--- Breakdown by source ---");
  const knownSources = ["BaT", "CarsAndBids", "CollectingCars", "ClassicCom", "AutoScout24", "AutoTrader", "BeForward"];

  for (const source of knownSources) {
    const { count: srcTotal } = await client
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("source", source);

    const { count: missingNull } = await client
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .is("images", null);

    const { count: missingEmpty } = await client
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("source", source)
      .eq("images", "{}");

    const total = srcTotal ?? 0;
    if (total === 0) continue;
    const missing = (missingNull ?? 0) + (missingEmpty ?? 0);
    console.log(
      `  ${source}: ${missing}/${total} missing (${((missing / total) * 100).toFixed(1)}%)`
    );
  }

  // Breakdown by status
  console.log("\n--- Breakdown by status (missing images only) ---");
  for (const status of ["active", "sold", "unsold", "delisted"]) {
    const { count: statusMissingNull } = await client
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", status)
      .is("images", null);

    const { count: statusMissingEmpty } = await client
      .from("listings")
      .select("*", { count: "exact", head: true })
      .eq("status", status)
      .eq("images", "{}");

    const count = (statusMissingNull ?? 0) + (statusMissingEmpty ?? 0);
    if (count > 0) console.log(`  ${status}: ${count}`);
  }

  // Sample some listings missing images to see their source_urls
  console.log("\n--- Sample 10 listings missing images ---");
  const { data: sampleRows } = await client
    .from("listings")
    .select("id,source,source_url,title,year,make,model,status")
    .or("images.is.null,images.eq.{}")
    .limit(10);

  for (const row of sampleRows ?? []) {
    console.log(
      `  [${row.source}] ${row.year} ${row.make} ${row.model} | ${row.status} | ${row.source_url}`
    );
  }

  // Check photos_media fallback
  console.log("\n--- photos_media fallback check ---");
  const { data: pmCheck } = await client
    .from("listings")
    .select("id, photos_media(photo_url)")
    .or("images.is.null,images.eq.{}")
    .limit(5);

  for (const row of pmCheck ?? []) {
    const photos = (row as any).photos_media ?? [];
    console.log(`  Listing ${row.id}: ${photos.length} photos in photos_media`);
  }
}

main().catch(console.error);
