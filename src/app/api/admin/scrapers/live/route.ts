import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentRuns,
  getDailyAggregates,
  getDataQuality,
  getLatestRunPerScraper,
  getActiveRuns,
} from "@/features/scrapers/common/monitoring/queries";
import { evaluateScraperQualityGate } from "@/features/scrapers/common/monitoring/quality";

const ADMIN_EMAILS = ["caposk8@hotmail.com", "caposk817@gmail.com"];

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  if (process.env.NODE_ENV !== "development") {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
      return NextResponse.json(
        { status: 401, code: "AUTH_REQUIRED", message: "Admin access required" },
        { status: 401 }
      );
    }
  }

  const [recentRuns, dailyAggregates, dataQuality, latestRuns, activeRuns] =
    await Promise.all([
      getRecentRuns(50),
      getDailyAggregates(30),
      getDataQuality(7),
      getLatestRunPerScraper(),
      getActiveRuns(),
    ]);

  const latestRunHealth = Object.fromEntries(
    Array.from(latestRuns.entries()).map(([scraperName, run]) => [
      scraperName,
      evaluateScraperQualityGate({
        success: Boolean((run as any).success),
        discovered: (run as any).discovered ?? 0,
        written: (run as any).written ?? 0,
        errorsCount: (run as any).errors_count ?? 0,
        image_coverage: (run as any).image_coverage,
        expectedPhotosMin: (run as any).expected_photos_min ?? (run as any).expectedPhotosMin,
        photosCount: (run as any).photos_count ?? (run as any).photosCount ?? 0,
      } as any).health,
    ]),
  );

  return NextResponse.json({
    status: 200,
    code: "OK",
    message: "Live scraper dashboard snapshot",
    data: {
      recentRuns,
      dailyAggregates,
      dataQuality,
      latestRuns: Object.fromEntries(latestRuns),
      latestRunHealth,
      activeRuns: Object.fromEntries(activeRuns),
      generatedAt: new Date().toISOString(),
    },
  });
}
