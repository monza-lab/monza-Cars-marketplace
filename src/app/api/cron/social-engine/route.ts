import { NextRequest, NextResponse } from "next/server";
import { runWorker } from "@/features/social-engine/workers/worker";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (secret) {
    const auth = req.headers.get("authorization");
    if (auth !== `Bearer ${secret}`) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
  }
  const result = await runWorker();
  return NextResponse.json(result);
}
