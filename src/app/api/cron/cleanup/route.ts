import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// ─── Junk detection rules ───
// Each rule returns a reason string if the listing is junk, or null if it's valid.

type ListingRow = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  title: string | null;
};

function detectJunk(row: ListingRow): string | null {
  const make = (row.make ?? "").toLowerCase().trim();
  const model = (row.model ?? "").toLowerCase().trim();
  const title = (row.title ?? "").toLowerCase();

  // Rule 1: Non-Porsche makes
  if (make !== "porsche") {
    return `non-porsche-make:${row.make}`;
  }

  // Rule 2: Porsche-Diesel tractors (exclude Cayenne Diesel which is a real car)
  if (model.includes("diesel") && !model.includes("cayenne")) {
    return "porsche-diesel-tractor";
  }

  // Rule 3: Tractor in title or model
  if (model.includes("tractor") || title.includes("tractor")) {
    return "tractor";
  }

  // Rule 4: Literature, press kits
  if (model.includes("literature") || model.includes("press kit")) {
    return "literature-press";
  }

  // Rule 5: Tool kits (not cars)
  if (model.includes("tool kit") || (model.includes("tool") && model.includes("356"))) {
    return "tool-kit";
  }

  // Rule 6: Kit cars using Porsche engines (APAL, Genie, etc.)
  if (model.includes("apal") || model.includes("genie")) {
    return "kit-car";
  }

  // Rule 7: Non-Porsche vehicles (Kenworth trucks, etc.)
  if (model.includes("kenworth")) {
    return "non-porsche-vehicle";
  }

  // Rule 8: Boats
  if (model.includes("craft") || model.includes("boat") || title.includes("boat")) {
    return "boat";
  }

  // Rule 9: Bikes, minibikes, scooters
  if (model.includes("bike") || model.includes("minibike") || model.includes("scooter")
      || title.includes("minibike") || title.includes("porsche bike")) {
    return "bike";
  }

  // Rule 10: Other non-car items
  if (model.includes("autonacional") || model.includes("projects unlimited")) {
    return "non-car-misc";
  }

  return null;
}

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchAllListings(client: SupabaseClient<any>) {
  const rows: ListingRow[] = [];
  const pageSize = 1000;
  let from = 0;

  while (true) {
    const { data, error } = await client
      .from("listings")
      .select("id, make, model, year, title")
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Fetch error: ${error.message}`);
    rows.push(...(data as ListingRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  // Auth check — same pattern as other cron routes
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized" },
      { status: 401 }
    );
  }

  const runId = crypto.randomUUID();
  const startedAtIso = new Date(startTime).toISOString();

  await markScraperRunStarted({
    scraperName: "cleanup",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const supabase = getSupabaseClient();

    // ── Step 1: Mark stale auctions as sold/unsold ──
    // Listings with end_time in the past but still status='active' are stale.
    // If they have a current_bid > 0, mark as 'sold'; otherwise 'unsold'.
    const now = new Date().toISOString();

    // Step 1a: Mark stale auctions with bids as 'sold'
    const { data: staleSold, error: staleSoldErr } = await supabase
      .from("listings")
      .update({ status: "sold" })
      .eq("status", "active")
      .lt("end_time", now)
      .gt("current_bid", 0)
      .select("id");

    if (staleSoldErr) {
      console.error("[cron/cleanup] stale→sold error:", staleSoldErr.message);
    }

    // Step 1b: Mark any remaining stale auctions (no bid / null bid) as 'unsold'
    // Runs after 1a so only listings NOT caught by the sold query remain.
    const { data: staleUnsold, error: staleUnsoldErr } = await supabase
      .from("listings")
      .update({ status: "unsold" })
      .eq("status", "active")
      .lt("end_time", now)
      .select("id");

    if (staleUnsoldErr) {
      console.error("[cron/cleanup] stale→unsold error:", staleUnsoldErr.message);
    }

    const staleSoldCount = staleSold?.length ?? 0;
    const staleUnsoldCount = staleUnsold?.length ?? 0;
    const totalStaleFixed = staleSoldCount + staleUnsoldCount;

    if (totalStaleFixed > 0) {
      console.log(
        `[cron/cleanup] Fixed ${totalStaleFixed} stale listings: ${staleSoldCount} → sold, ${staleUnsoldCount} → unsold`
      );
    }

    // ── Step 1c: Mark __dead_url__ listings as unsold ──
    // Listings whose source URL returned 404/410 during image backfill
    // were marked with images=['__dead_url__'] but kept status='active'.
    // Mark them as 'unsold' so they leave the active feed.
    const { data: deadUrlFixed, error: deadUrlErr } = await supabase
      .from("listings")
      .update({ status: "unsold", updated_at: now })
      .eq("status", "active")
      .contains("images", ["__dead_url__"])
      .select("id");

    if (deadUrlErr) {
      console.error("[cron/cleanup] dead-url→unsold error:", deadUrlErr.message);
    }
    const deadUrlFixedCount = deadUrlFixed?.length ?? 0;
    if (deadUrlFixedCount > 0) {
      console.log(`[cron/cleanup] Marked ${deadUrlFixedCount} dead-URL listings as unsold`);
    }

    // ── Step 2: Reclassify misclassified listings using title ──
    // Some listings have model="911" but title="1976 Porsche 911 Turbo" — the title
    // reveals a more specific series (930). We detect and fix these by comparing
    // extractSeries(model) vs extractSeries(model, title).
    const allListings = await fetchAllListings(supabase);
    let reclassified = 0;

    for (const row of allListings) {
      if (!row.make || !row.model || !row.title || !row.year) continue;
      const seriesWithoutTitle = extractSeries(row.model, row.year, row.make);
      const seriesWithTitle = extractSeries(row.model, row.year, row.make, row.title);

      if (seriesWithTitle !== seriesWithoutTitle && getSeriesConfig(seriesWithTitle, row.make)) {
        // The title reveals a better classification — update the model field
        // to include the series identifier so future lookups work without title
        const config = getSeriesConfig(seriesWithTitle, row.make);
        if (config) {
          const { error: updateErr } = await supabase
            .from("listings")
            .update({ model: config.label })
            .eq("id", row.id);

          if (!updateErr) {
            reclassified++;
            if (reclassified <= 20) {
              console.log(
                `[cron/cleanup] Reclassified: "${row.model}" → "${config.label}" (title: "${row.title?.substring(0, 60)}")`
              );
            }
          }
        }
      }
    }

    if (reclassified > 0) {
      console.log(`[cron/cleanup] Reclassified ${reclassified} listings using title data`);
    }

    // ── Step 3: Scan all listings for junk ──

    // Detect junk
    const junkItems: { id: string; reason: string; model: string | null }[] = [];
    for (const row of allListings) {
      const reason = detectJunk(row);
      if (reason) {
        junkItems.push({ id: row.id, reason, model: row.model });
      }
    }

    if (junkItems.length === 0 && totalStaleFixed === 0) {
      const earlyMessages: string[] = [];
      if (reclassified > 0) earlyMessages.push(`reclassified: ${reclassified}`);
      if (deadUrlFixedCount > 0) earlyMessages.push(`dead-url-unsold: ${deadUrlFixedCount}`);

      await recordScraperRun({
        scraper_name: "cleanup",
        run_id: runId,
        started_at: startedAtIso,
        finished_at: new Date().toISOString(),
        success: true,
        runtime: "vercel_cron",
        duration_ms: Date.now() - startTime,
        discovered: allListings.length,
        written: totalStaleFixed + reclassified + deadUrlFixedCount,
        errors_count: 0,
        refresh_checked: allListings.length,
        refresh_updated: totalStaleFixed + deadUrlFixedCount,
        error_messages: earlyMessages.length > 0 ? earlyMessages : undefined,
      });

      await clearScraperRunActive("cleanup");

      return NextResponse.json({
        success: true,
        scanned: allListings.length,
        deleted: 0,
        staleFixed: 0,
        deadUrlFixed: deadUrlFixedCount,
        reclassified,
        items: [],
        duration: `${Date.now() - startTime}ms`,
      });
    }

    // Group by reason for the response
    const byReason: Record<string, number> = {};
    for (const item of junkItems) {
      byReason[item.reason] = (byReason[item.reason] ?? 0) + 1;
    }

    // Delete price_history first (foreign key)
    const junkIds = junkItems.map((j) => j.id);
    for (let i = 0; i < junkIds.length; i += 50) {
      const batch = junkIds.slice(i, i + 50);
      await supabase.from("price_history").delete().in("listing_id", batch);
    }

    // Delete junk listings
    let deletedCount = 0;
    for (let i = 0; i < junkIds.length; i += 50) {
      const batch = junkIds.slice(i, i + 50);
      const { data } = await supabase
        .from("listings")
        .delete()
        .in("id", batch)
        .select("id");

      deletedCount += (data ?? []).length;
    }

    console.log(
      `[cron/cleanup] Deleted ${deletedCount} junk listings:`,
      JSON.stringify(byReason)
    );

    const allMessages: string[] = [];
    if (totalStaleFixed > 0) allMessages.push(`stale: ${staleSoldCount} sold, ${staleUnsoldCount} unsold`);
    if (deadUrlFixedCount > 0) allMessages.push(`dead-url-unsold: ${deadUrlFixedCount}`);
    if (reclassified > 0) allMessages.push(`reclassified: ${reclassified}`);
    if (deletedCount > 0) {
      allMessages.push(...Object.entries(byReason).map(([r, c]) => `junk-${r}: ${c}`));
    }

    await recordScraperRun({
      scraper_name: "cleanup",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: allListings.length,
      written: totalStaleFixed + reclassified + deadUrlFixedCount,
      errors_count: deletedCount,
      refresh_checked: allListings.length,
      refresh_updated: totalStaleFixed + deadUrlFixedCount,
      error_messages: allMessages.length > 0 ? allMessages : undefined,
    });

    await clearScraperRunActive("cleanup");

    return NextResponse.json({
      success: true,
      scanned: allListings.length,
      deleted: deletedCount,
      staleFixed: totalStaleFixed,
      staleSold: staleSoldCount,
      staleUnsold: staleUnsoldCount,
      deadUrlFixed: deadUrlFixedCount,
      reclassified,
      byReason,
      items: junkItems.slice(0, 100), // cap response size
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/cleanup] Error:", error);

    await recordScraperRun({
      scraper_name: "cleanup",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Cleanup failed"],
    });

    await clearScraperRunActive("cleanup");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Cleanup failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    );
  }
}
