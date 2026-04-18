import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateListing } from "@/features/scrapers/common/listingValidator";
import {
  clearScraperRunActive,
  markScraperRunStarted,
  recordScraperRun,
} from "@/features/scrapers/common/monitoring";
import { refreshListingsActiveCounts } from "@/features/scrapers/common/refreshCounts";
import { invalidateDashboardCache } from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ListingRow = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  title: string | null;
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRecentListings(client: SupabaseClient<any>) {
  const rows: ListingRow[] = [];
  const pageSize = 1000;
  let from = 0;

  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  while (true) {
    const { data, error } = await client
      .from("listings")
      .select("id, make, model, year, title")
      .gte("updated_at", cutoff)
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

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const runId = crypto.randomUUID();
  const startedAtIso = new Date(startTime).toISOString();

  await markScraperRunStarted({
    scraperName: "validate",
    runId,
    startedAt: startedAtIso,
    runtime: "vercel_cron",
  });

  try {
    const supabase = getSupabaseClient();
    const recentListings = await fetchRecentListings(supabase);

    let fixed = 0;
    let deleted = 0;
    const deleteIds: string[] = [];
    const fixedItems: { id: string; oldModel: string; newModel: string }[] = [];
    const deletedReasons: Record<string, number> = {};

    for (const row of recentListings) {
      const result = validateListing({
        make: row.make ?? "",
        model: row.model ?? "",
        title: row.title ?? "",
        year: row.year ?? undefined,
      });

      if (result.valid && result.fixedModel) {
        await supabase
          .from("listings")
          .update({ model: result.fixedModel, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        fixedItems.push({ id: row.id, oldModel: row.model ?? "", newModel: result.fixedModel });
        fixed++;
      } else if (!result.valid) {
        deleteIds.push(row.id);
        const reason = result.reason ?? "unknown";
        deletedReasons[reason] = (deletedReasons[reason] ?? 0) + 1;
      }
    }

    // Delete price_history first (foreign key)
    for (let i = 0; i < deleteIds.length; i += 50) {
      const batch = deleteIds.slice(i, i + 50);
      await supabase.from("price_history").delete().in("listing_id", batch);
    }

    // Delete invalid listings
    for (let i = 0; i < deleteIds.length; i += 50) {
      const batch = deleteIds.slice(i, i + 50);
      const { data } = await supabase
        .from("listings")
        .delete()
        .in("id", batch)
        .select("id");
      deleted += (data ?? []).length;
    }

    console.log(
      `[cron/validate] Scanned ${recentListings.length}, fixed ${fixed}, deleted ${deleted}:`,
      JSON.stringify(deletedReasons),
    );

    await recordScraperRun({
      scraper_name: "validate",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: recentListings.length,
      written: fixed,
      errors_count: deleted,
      error_messages: Object.keys(deletedReasons).length > 0
        ? Object.entries(deletedReasons).map(([r, c]) => `${r}: ${c}`)
        : undefined,
    });

    await clearScraperRunActive("validate");
    await refreshListingsActiveCounts(supabase);
    invalidateDashboardCache();

    return NextResponse.json({
      success: true,
      scanned: recentListings.length,
      fixed,
      fixedItems: fixedItems.slice(0, 50),
      deleted,
      deletedReasons,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/validate] Error:", error);

    await recordScraperRun({
      scraper_name: "validate",
      run_id: runId,
      started_at: startedAtIso,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [error instanceof Error ? error.message : "Validation failed"],
    });

    await clearScraperRunActive("validate");

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Validation failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 },
    );
  }
}
