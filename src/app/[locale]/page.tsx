import { setRequestLocale } from "next-intl/server";
import { HomeGate } from "@/components/landing/HomeGate";
import {
  fetchDashboardDataUncached,
  getCachedDashboardData,
  type DashboardData,
} from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";

async function loadDashboardData(): Promise<DashboardData> {
  try {
    return await getCachedDashboardData();
  } catch (err) {
    console.error("[Home] getCachedDashboardData failed:", err);
    try {
      return await fetchDashboardDataUncached();
    } catch (fallbackErr) {
      console.error("[Home] fetchDashboardDataUncached failed:", fallbackErr);
      return {
        auctions: [],
        valuationListings: [],
        regionalValByFamily: {},
        liveNow: 0,
        regionTotals: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 },
        seriesCounts: {},
        seriesCountsByRegion: { all: {}, US: {}, UK: {}, EU: {}, JP: {} },
      };
    }
  }
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams?: Promise<{ error?: string }>;
}) {
  const { locale } = await params;
  const authError = (await searchParams)?.error ?? null;
  setRequestLocale(locale);

  const data = await loadDashboardData();

  return <HomeGate data={data} authError={authError} />;
}
