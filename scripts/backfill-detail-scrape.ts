/**
 * One-time backfill script: re-scrapes BaT detail pages for existing listings
 * and updates NULL columns with improved extraction.
 *
 * Usage:
 *   npx tsx scripts/backfill-detail-scrape.ts
 *   npx tsx scripts/backfill-detail-scrape.ts --dry-run
 */

import { createClient } from "@supabase/supabase-js";
import { scrapeDetail, type BaTAuction } from "../src/lib/scrapers/bringATrailer";

const DRY_RUN = process.argv.includes("--dry-run");
const DELAY_MS = 2500;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    process.exit(1);
  }

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Fetch all BaT listings
  const { data: rows, error } = await supabase
    .from("listings")
    .select("id,source_url,title,year,make,model,mileage,color_exterior,color_interior,reserve_status,seller_notes,body_style,trim,images,transmission")
    .eq("source", "BaT")
    .order("created_at", { ascending: true });

  if (error || !rows) {
    console.error("Failed to fetch listings:", error?.message);
    process.exit(1);
  }

  console.log(`[backfill] Found ${rows.length} BaT listings. DRY_RUN=${DRY_RUN}`);

  let updated = 0;
  let skipped = 0;
  let errored = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const progress = `[${i + 1}/${rows.length}]`;

    try {
      // Build a minimal BaTAuction to pass to scrapeDetail
      const stub: BaTAuction = {
        externalId: `bat-${row.id}`,
        platform: "BRING_A_TRAILER",
        title: row.title ?? `${row.year} ${row.make} ${row.model}`,
        make: row.make,
        model: row.model,
        year: row.year,
        mileage: null,
        mileageUnit: "miles",
        transmission: null,
        engine: null,
        exteriorColor: null,
        interiorColor: null,
        location: null,
        currentBid: null,
        bidCount: 0,
        endTime: null,
        url: row.source_url,
        imageUrl: null,
        description: null,
        sellerNotes: null,
        status: "unknown",
        vin: null,
        images: [],
        reserveStatus: null,
        bodyStyle: null,
      };

      const detail = await scrapeDetail(stub);

      // Build update payload — only update columns that are currently NULL
      const updates: Record<string, unknown> = {};

      if (row.mileage == null && detail.mileage != null) {
        // Convert to km for storage
        const km = detail.mileageUnit === "km"
          ? detail.mileage
          : Math.round(detail.mileage * 1.609344);
        updates.mileage = km;
        updates.mileage_unit = "km";
      }
      if (!row.color_exterior && detail.exteriorColor) {
        updates.color_exterior = detail.exteriorColor;
      }
      if (!row.color_interior && detail.interiorColor) {
        updates.color_interior = detail.interiorColor;
      }
      if (!row.reserve_status && detail.reserveStatus) {
        updates.reserve_status = detail.reserveStatus;
      }
      if (!row.seller_notes && detail.sellerNotes) {
        updates.seller_notes = detail.sellerNotes;
      }
      if (!row.body_style && detail.bodyStyle) {
        updates.body_style = detail.bodyStyle;
      }
      if (!row.trim && detail.bodyStyle) {
        // body_style can sometimes hint at trim — but don't overwrite
      }
      // Update images if currently small (<=10) and scraper found more
      const currentImages = row.images ?? [];
      if (currentImages.length <= 10 && detail.images.length > currentImages.length) {
        updates.images = detail.images;
        updates.photos_count = detail.images.length;
      }
      // Also update engine/transmission if scraper found them
      if (detail.engine) updates.engine = detail.engine;
      if (detail.transmission) updates.transmission = detail.transmission;
      if (detail.vin) updates.vin = detail.vin;
      if (detail.location) updates.location = detail.location;
      if (detail.description) updates.description_text = detail.description;

      // Detect and fix misparsed transmissions (e.g. "17k Miles Shown on Replacement Speedometer")
      if (row.transmission && /\b(miles?|km|speedometer|odometer)\b/i.test(row.transmission)) {
        // Rescue mileage from the misparsed transmission value
        if (row.mileage == null && !updates.mileage) {
          const rescueMatch = row.transmission.match(/\b([\d,]+k?)\s*(miles?|kilometers?|km)\b/i);
          if (rescueMatch) {
            let raw = rescueMatch[1].replace(/,/g, '');
            let rescued: number;
            if (raw.toLowerCase().endsWith('k')) {
              rescued = parseFloat(raw.slice(0, -1)) * 1000;
            } else {
              rescued = parseInt(raw, 10);
            }
            if (!isNaN(rescued) && rescued > 0) {
              const isKm = /km|kilometer/i.test(rescueMatch[2]);
              updates.mileage = isKm ? rescued : Math.round(rescued * 1.609344);
              updates.mileage_unit = 'km';
            }
          }
        }
        // Replace with the re-scraped (guarded) transmission
        updates.transmission = detail.transmission;
      }

      if (Object.keys(updates).length === 0) {
        console.log(`${progress} SKIP ${row.source_url} — no new data`);
        skipped++;
        continue;
      }

      updates.updated_at = new Date().toISOString();

      if (DRY_RUN) {
        console.log(`${progress} DRY-RUN ${row.source_url}`, Object.keys(updates));
        updated++;
      } else {
        const { error: updateErr } = await supabase
          .from("listings")
          .update(updates)
          .eq("id", row.id);

        if (updateErr) {
          console.error(`${progress} ERROR updating ${row.id}: ${updateErr.message}`);
          errored++;
        } else {
          console.log(`${progress} UPDATED ${row.source_url} — fields: ${Object.keys(updates).join(", ")}`);
          updated++;
        }
      }

      // Rate limit
      await delay(DELAY_MS);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${progress} ERROR scraping ${row.source_url}: ${msg}`);
      errored++;
      await delay(DELAY_MS);
    }
  }

  console.log(`\n[backfill] Done. Updated: ${updated}, Skipped: ${skipped}, Errors: ${errored}`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
