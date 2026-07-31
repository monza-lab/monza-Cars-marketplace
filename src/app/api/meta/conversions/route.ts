import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { resolveReportToken } from "@/lib/reportAccess/repository"

export const runtime = "nodejs"

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
const TEST_CODE = process.env.META_CAPI_TEST_EVENT_CODE
const ENABLED = process.env.META_CAPI_ENABLED === "true"

const inputSchema = z.object({
  eventName: z.literal("ReportViewed"),
  eventId: z.string().trim().min(1).max(200),
  eventTime: z.number().int().positive().optional(),
  fbp: z.string().trim().max(500).optional(),
  fbc: z.string().trim().max(500).optional(),
  customData: z.object({ listing_id: z.string().trim().min(1).max(200) }),
})

export async function POST(req: NextRequest) {
  if (!ENABLED || !PIXEL_ID || !ACCESS_TOKEN) {
    return NextResponse.json(
      { ok: false, reason: "capi_not_configured" },
      { status: 200 },
    )
  }

  const origin = req.headers.get("origin")
  if (!origin || origin !== req.nextUrl.origin) {
    return NextResponse.json({ ok: false, reason: "forbidden_origin" }, { status: 403 })
  }

  const parsed = inputSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, reason: "invalid_event" }, { status: 400 })
  }
  const body = parsed.data
  const accessToken = req.headers.get("x-report-access-token")
  if (!accessToken || !await resolveReportToken(accessToken, body.customData.listing_id)) {
    return NextResponse.json({ ok: false, reason: "invalid_report_access" }, { status: 401 })
  }
  const referer = req.headers.get("referer")
  let canonicalSourceUrl = `${req.nextUrl.origin}/reports/${encodeURIComponent(body.customData.listing_id)}`
  if (referer) {
    try {
      const parsedReferer = new URL(referer)
      if (parsedReferer.origin === req.nextUrl.origin) {
        canonicalSourceUrl = `${req.nextUrl.origin}${parsedReferer.pathname}`
      }
    } catch { /* keep the server-built fallback */ }
  }
  const now = Math.floor(Date.now() / 1000)

  const event = {
    event_name: body.eventName,
    event_id: body.eventId,
    event_time: body.eventTime ?? now,
    action_source: "website" as const,
    event_source_url: canonicalSourceUrl,
    user_data: {
      client_user_agent: req.headers.get("user-agent") ?? undefined,
      client_ip_address: req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      fbp: body.fbp,
      fbc: body.fbc,
    },
    custom_data: body.customData,
  }

  const url = `https://graph.facebook.com/v25.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`
  const payload: Record<string, unknown> = { data: [event] }
  if (TEST_CODE) payload.test_event_code = TEST_CODE

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  })

  if (!res.ok) {
    const text = await res.text()
    console.error("[meta-capi] error", res.status, text)
    return NextResponse.json({ ok: false, status: res.status }, { status: 200 })
  }

  return NextResponse.json({ ok: true }, { status: 200 })
}
