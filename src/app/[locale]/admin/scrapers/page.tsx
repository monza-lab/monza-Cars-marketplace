import type { Metadata } from "next";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentRuns,
  getDailyAggregates,
  getDataQuality,
  getLatestRunPerScraper,
  getActiveRuns,
} from "@/features/scrapers/common/monitoring";
import ScrapersDashboardClient from "./ScrapersDashboardClient";

const ADMIN_EMAILS = ["caposk8@hotmail.com", "caposk817@gmail.com"];

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Scraper Monitoring — Monza",
    description: "Monitor scraper health, ingestion rates, and data quality",
  };
}

async function DashboardData() {
  const [recentRuns, dailyAggregates, dataQuality, latestRuns, activeRuns] =
    await Promise.all([
      getRecentRuns(50),
      getDailyAggregates(30),
      getDataQuality(7),
      getLatestRunPerScraper(),
      getActiveRuns(),
    ]);

  return (
    <ScrapersDashboardClient
      recentRuns={recentRuns}
      dailyAggregates={dailyAggregates}
      dataQuality={dataQuality}
      latestRuns={Object.fromEntries(latestRuns)}
      activeRuns={Object.fromEntries(activeRuns)}
    />
  );
}

export default async function ScrapersPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  if (process.env.NODE_ENV !== "development") {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
      redirect(`/${locale}`);
    }
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-border" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading scraper data...</p>
          </div>
        </div>
      }
    >
      <DashboardData />
    </Suspense>
  );
}
