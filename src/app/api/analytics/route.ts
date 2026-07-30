import { NextRequest, NextResponse } from "next/server"
import type { AnalyticsEvent } from "@/lib/analytics/events"
import { createAdminClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

const KNOWN_EVENTS = new Set<AnalyticsEvent["event"]>([
  "visit_landed",
  "browse_car_viewed",
  "report_cta_clicked",
  "email_submitted",
  "account_claimed",
  "pricing_page_viewed",
  "report_viewed",
  "plan_clicked",
  "checkout_started",
  "checkout_completed",
  "checkout_cancelled",
  "upsell_shown",
  "upsell_converted",
  "subscription_canceled",
])

// Lightweight first-party sink for client analytics events. We validate the
// known event shape and persist it to Supabase. Always
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

  const payload = body.payload && typeof body.payload === "object"
    ? body.payload as Record<string, unknown>
    : {}
  try {
    const db = createAdminClient()
    const { error } = await db.from("analytics_events").insert({
      event_name: body.event,
      anonymous_session_id: typeof payload.anonymousSessionId === "string" ? payload.anonymousSessionId : null,
      lead_id: typeof payload.leadId === "string" ? payload.leadId : null,
      user_credits_id: typeof payload.userId === "string" ? payload.userId : null,
      listing_id: typeof payload.listingId === "string" ? payload.listingId : null,
      source: typeof payload.source === "string" ? payload.source : null,
      payload,
    })
    if (error) throw error
  } catch (error) {
    console.error("[analytics] persistence failed", body.event, error)
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
