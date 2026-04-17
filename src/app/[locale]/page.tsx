import { setRequestLocale } from "next-intl/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { ViewPreferenceRedirect } from "@/components/layout/ViewPreferenceRedirect";
import { getCachedDashboardData, type DashboardData } from "@/lib/dashboardCache";

async function loadDashboardData(): Promise<DashboardData> {
  try {
    return await getCachedDashboardData();
  } catch (err) {
    console.error("[Home] getCachedDashboardData failed:", err);
    return { auctions: [], liveNow: 0, regionTotals: { all: 0, US: 0, UK: 0, EU: 0, JP: 0 }, seriesCounts: {} };
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const data = await loadDashboardData();

  if (data.auctions.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <span className="text-muted-foreground text-sm">
          No listings found
        </span>
      </div>
    );
  }

  return (
    <>
      <ViewPreferenceRedirect current="monza" />
      <DashboardClient
        auctions={data.auctions}
        liveRegionTotals={data.regionTotals}
        liveNowTotal={data.liveNow}
        seriesCounts={data.seriesCounts}
      />
    </>
  );
}
