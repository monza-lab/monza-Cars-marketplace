import { NextRequest, NextResponse } from "next/server"
import { sendClaimReminders } from "@/lib/reportAccess/reminders"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function GET(request: NextRequest) {
  if (!process.env.CRON_SECRET || request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ ok: false }, { status: 401 })
  }
  return NextResponse.json({ ok: true, ...await sendClaimReminders() })
}
