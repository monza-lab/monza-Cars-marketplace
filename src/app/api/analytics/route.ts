import { NextRequest, NextResponse } from "next/server"
import type { AnalyticsEvent } from "@/lib/analytics/events"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const KNOWN_EVENTS = new Set<AnalyticsEvent["event"]>([
  "pricing_page_viewed",
  "plan_clicked",
  "checkout_started",
  "checkout_completed",
  "checkout_cancelled",
  "upsell_shown",
  "upsell_converted",
  "subscription_canceled",
])

// Lightweight sink for client analytics events. No external backend is wired
// up yet, so we validate the known event shape and log server-side. Always
// returns 200 so the client-side `track()` (which swallows errors) never sees
// a failed request. Replace the console.log with a real destination
// (warehouse, queue, provider) when one is available.
export async function POST(req: NextRequest) {
  let body: Partial<AnalyticsEvent>
  try {
    body = (await req.json()) as Partial<AnalyticsEvent>
  } catch {
    return NextResponse.json({ ok: false, reason: "invalid_json" }, { status: 200 })
  }

  if (!body || typeof body.event !== "string" || !KNOWN_EVENTS.has(body.event)) {
    return NextResponse.json({ ok: false, reason: "unknown_event" }, { status: 200 })
  }

  console.log("[analytics]", body.event, JSON.stringify(body.payload ?? {}))

  return NextResponse.json({ ok: true }, { status: 200 })
}
