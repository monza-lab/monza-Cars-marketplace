import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { fetchFerrariHistoricalByListingId } from "@/features/ferrari_history/service";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();

  // Strip the "live-" prefix to get the Supabase listing ID
  const listingId = id.startsWith("live-") ? id.slice(5) : id;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    return NextResponse.json({ success: true, data: [] });
  }

  try {
    const ferrariHistory = await fetchFerrariHistoricalByListingId(id, { requestId });
    if (ferrariHistory.isFerrariContext) {
      return NextResponse.json({ success: true, data: ferrariHistory.priceHistory });
    }

    const supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data, error } = await supabase
      .from("price_history")
      .select("time,status,price_usd,price_eur,price_gbp")
      .eq("listing_id", listingId)
      .order("time", { ascending: true });

    if (error) {
      console.error("[price-history] Query error:", error.message);
      return NextResponse.json({ success: true, data: [] });
    }

    const entries = (data ?? []).map((row: {
      time: string;
      status: string | null;
      price_usd: number | null;
      price_eur: number | null;
      price_gbp: number | null;
    }, idx: number) => ({
      id: `ph-${idx}`,
      bid: row.price_usd ?? row.price_eur ?? row.price_gbp ?? 0,
      timestamp: row.time,
      status: row.status,
    }));

    return NextResponse.json({ success: true, data: entries });
  } catch (err) {
    console.error("[price-history] Error:", err);
    return NextResponse.json({ success: true, data: [] });
  }
}
