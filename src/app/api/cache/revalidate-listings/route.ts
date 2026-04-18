import { NextResponse, type NextRequest } from "next/server";
import { invalidateDashboardCache } from "@/lib/dashboardCache";

export const dynamic = "force-dynamic";
export const maxDuration = 10;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const secret = process.env.CRON_SECRET;
  if (!secret || authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  invalidateDashboardCache();
  return NextResponse.json({ revalidated: true, tag: "listings", at: new Date().toISOString() });
}
