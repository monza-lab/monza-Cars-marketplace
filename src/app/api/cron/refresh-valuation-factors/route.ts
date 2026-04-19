import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getExchangeRates } from "@/lib/exchangeRates";
import { derivePrice } from "@/lib/pricing/derivePrice";
import { computeFactorTable } from "@/lib/pricing/computeFactorTable";
import type { DerivedPrice } from "@/lib/pricing/types";
import { invalidateDashboardCache } from "@/lib/dashboardCache";
import { storeDashboardRegionalValuationByFamily } from "@/lib/dashboardValuationCache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const PAGE_SIZE = 1000;
const SAFETY_CAP = 100_000;

async function authorized(req: Request): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${process.env.CRON_SECRET}`;
}

export async function GET(req: Request) {
  if (!(await authorized(req))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: "missing supabase env" }, { status: 500 });
  }

  const sb = createClient(url, key, { auth: { persistSession: false } });
  const rates = await getExchangeRates();
  const prices: DerivedPrice[] = [];

  let from = 0;
  try {
    while (true) {
      const { data, error } = await sb
        .from("listings")
        .select("source,status,year,make,model,hammer_price,final_price,current_bid,original_currency")
        .eq("make", "Porsche")
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw error;
      if (!data || data.length === 0) break;
      for (const row of data) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        prices.push(derivePrice(row as any, { rates }));
      }
      from += data.length;
      if (prices.length >= SAFETY_CAP) break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: "supabase query failed", message, from }, { status: 500 });
  }

  const table = computeFactorTable(prices);
  await storeDashboardRegionalValuationByFamily(sb, "Porsche", prices);
  invalidateDashboardCache();

  console.log("[cron:refresh-valuation-factors] porsche-wide:", table.porscheWide);
  console.log("[cron:refresh-valuation-factors] families:", Object.keys(table.byFamily).length);
  for (const [fam, f] of Object.entries(table.byFamily)) {
    console.log(
      `[cron:refresh-valuation-factors]   ${fam}: factor=${f.factor.toFixed(3)} soldN=${f.soldN} askingN=${f.askingN}`,
    );
  }

  return NextResponse.json({
    ok: true,
    rowsProcessed: prices.length,
    table,
  });
}
