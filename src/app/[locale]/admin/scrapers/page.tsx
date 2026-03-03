import type { Metadata } from "next";
import { Suspense } from "react";
import { setRequestLocale } from "next-intl/server";
import {
  getRecentRuns,
  getDailyAggregates,
  getDataQuality,
  getLatestRunPerScraper,
} from "@/lib/scraper-monitoring";
import ScrapersDashboardClient from "./ScrapersDashboardClient";

export async function generateMetadata(): Promise<Metadata> {
  return {
    title: "Scraper Monitoring — Monza",
    description: "Monitor scraper health, ingestion rates, and data quality",
  };
}

async function DashboardData() {
  const [recentRuns, dailyAggregates, dataQuality, latestRuns] =
    await Promise.all([
      getRecentRuns(50),
      getDailyAggregates(30),
      getDataQuality(7),
      getLatestRunPerScraper(),
    ]);

  return (
    <ScrapersDashboardClient
      recentRuns={recentRuns}
      dailyAggregates={dailyAggregates}
      dataQuality={dataQuality}
      latestRuns={Object.fromEntries(latestRuns)}
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

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-zinc-800" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-zinc-500">Loading scraper data...</p>
          </div>
        </div>
      }
    >
      <DashboardData />
    </Suspense>
  );
}
