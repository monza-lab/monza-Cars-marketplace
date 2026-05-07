import { NextRequest, NextResponse } from "next/server"
import crypto from "node:crypto"

export const runtime = "nodejs"

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
const TEST_CODE = process.env.META_CAPI_TEST_EVENT_CODE

interface CapiEventInput {
  eventName: "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase"
  eventId: string
  eventTime?: number
  email?: string
  phone?: string
  externalId?: string
  clientUserAgent?: string
  clientIpAddress?: string
  fbp?: string
  fbc?: string
  eventSourceUrl?: string
  customData?: Record<string, unknown>
}

function sha256Lower(input?: string): string | undefined {
  if (!input) return undefined
  return crypto
    .createHash("sha256")
    .update(input.trim().toLowerCase())
    .digest("hex")
}

export async function POST(req: NextRequest) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return NextResponse.json(
      { ok: false, reason: "capi_not_configured" },
      { status: 200 },
    )
  }

  const body = (await req.json()) as CapiEventInput
  const now = Math.floor(Date.now() / 1000)

  const event = {
    event_name: body.eventName,
    event_id: body.eventId,
    event_time: body.eventTime ?? now,
    action_source: "website" as const,
    event_source_url: body.eventSourceUrl,
    user_data: {
      em: body.email ? [sha256Lower(body.email)] : undefined,
      ph: body.phone ? [sha256Lower(body.phone)] : undefined,
      external_id: body.externalId
        ? [sha256Lower(body.externalId)]
        : undefined,
      client_user_agent:
        body.clientUserAgent ?? req.headers.get("user-agent") ?? undefined,
      client_ip_address:
        body.clientIpAddress ??
        req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
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
