import { setRequestLocale } from "next-intl/server";
import { BrowseClient } from "@/components/browse/BrowseClient";
import {
  fetchDashboardDataUncached,
  getCachedDashboardData,
  type DashboardData,
} from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  await params;
  return {
    title: "Browse Collection | Monza Lab",
    description:
      "Browse every collector Porsche in the Monza Lab marketplace. Filter by series, year, price, transmission. Live auctions and recent sales.",
  };
}

async function loadData(): Promise<DashboardData> {
  try {
    return await getCachedDashboardData();
  } catch (err) {
    console.error("[Browse] getCachedDashboardData failed:", err);
    try {
      return await fetchDashboardDataUncached();
    } catch (fallbackErr) {
      console.error("[Browse] fetchDashboardDataUncached failed:", fallbackErr);
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

export default async function BrowsePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await loadData();

  return (
    <BrowseClient
      auctions={data.auctions}
      seriesCounts={data.seriesCounts}
      totalTracked={data.regionTotals.all}
    />
  );
}
