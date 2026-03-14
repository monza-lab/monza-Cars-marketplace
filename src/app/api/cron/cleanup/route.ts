import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

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

  try {
    const supabase = getSupabaseClient();

    // Scan all listings
    const allListings = await fetchAllListings(supabase);

    // Detect junk
    const junkItems: { id: string; reason: string; model: string | null }[] = [];
    for (const row of allListings) {
      const reason = detectJunk(row);
      if (reason) {
        junkItems.push({ id: row.id, reason, model: row.model });
      }
    }

    if (junkItems.length === 0) {
      return NextResponse.json({
        success: true,
        scanned: allListings.length,
        deleted: 0,
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

    return NextResponse.json({
      success: true,
      scanned: allListings.length,
      deleted: deletedCount,
      byReason,
      items: junkItems.slice(0, 100), // cap response size
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/cleanup] Error:", error);
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
