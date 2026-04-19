import { createClient } from "@supabase/supabase-js";
import type { ListingRow, ComparablesSummary } from "../types";

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

const COMP_WINDOW_MONTHS = 12;
const MIN_SAMPLE_SIZE = 3;

export async function fetchComparablesSummary(listing: ListingRow): Promise<ComparablesSummary | null> {
  if (!listing.make || !listing.model || !listing.year) return null;
  const supa = makeClient();
  const cutoff = new Date(Date.now() - COMP_WINDOW_MONTHS * 30 * 864e5).toISOString();

  const yearLow = listing.year - 2;
  const yearHigh = listing.year + 2;

  const { data, error } = await supa
    .from("listings")
    .select("final_price, current_bid, sale_date")
    .eq("make", listing.make)
    .eq("model", listing.model)
    .gte("year", yearLow)
    .lte("year", yearHigh)
    .neq("id", listing.id)
    .in("status", ["sold", "ended"])
    .gte("sale_date", cutoff)
    .not("final_price", "is", null);
  if (error) throw error;

  const prices = (data ?? [])
    .map((r) => r.final_price as number)
    .filter((p) => p != null && p > 0);

  if (prices.length < MIN_SAMPLE_SIZE) return null;

  prices.sort((a, b) => a - b);
  const avg = Math.round(prices.reduce((a, b) => a + b, 0) / prices.length);
  const low = prices[0];
  const high = prices[prices.length - 1];

  const thisPrice = listing.final_price ?? listing.current_bid ?? null;
  const deltaPct = thisPrice != null ? ((thisPrice - avg) / avg) * 100 : null;

  return {
    avg,
    low,
    high,
    sampleSize: prices.length,
    windowMonths: COMP_WINDOW_MONTHS,
    thisPrice,
    deltaPct: deltaPct != null ? Math.round(deltaPct * 10) / 10 : null,
  };
}
