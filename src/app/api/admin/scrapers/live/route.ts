import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getRecentRuns,
  getDailyAggregates,
  getDataQuality,
  getLatestRunPerScraper,
  getActiveRuns,
} from "@/features/scrapers/common/monitoring";

const ADMIN_EMAILS = ["caposk8@hotmail.com"];

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user || !ADMIN_EMAILS.includes(user.email ?? "")) {
    return NextResponse.json(
      { status: 401, code: "AUTH_REQUIRED", message: "Admin access required" },
      { status: 401 }
    );
  }

  const [recentRuns, dailyAggregates, dataQuality, latestRuns, activeRuns] =
    await Promise.all([
      getRecentRuns(50),
      getDailyAggregates(30),
      getDataQuality(7),
      getLatestRunPerScraper(),
      getActiveRuns(),
    ]);

  return NextResponse.json({
    status: 200,
    code: "OK",
    message: "Live scraper dashboard snapshot",
    data: {
      recentRuns,
      dailyAggregates,
      dataQuality,
      latestRuns: Object.fromEntries(latestRuns),
      activeRuns: Object.fromEntries(activeRuns),
      generatedAt: new Date().toISOString(),
    },
  });
}
