import crypto from "node:crypto"

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN
const TEST_CODE = process.env.META_CAPI_TEST_EVENT_CODE

function sha256(input?: string): string | undefined {
  if (!input) return undefined
  return crypto
    .createHash("sha256")
    .update(input.trim().toLowerCase())
    .digest("hex")
}

/**
 * Send an event directly to Meta CAPI from server-side code
 * (e.g. Stripe webhooks where there is no browser client).
 */
export async function sendServerCapiEvent(input: {
  eventName: "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase"
  eventId: string
  eventSourceUrl?: string
  email?: string
  externalId?: string
  customData?: Record<string, unknown>
}) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    console.warn("[meta-capi-server] not configured, skipping")
    return
  }

  const now = Math.floor(Date.now() / 1000)

  const event = {
    event_name: input.eventName,
    event_id: input.eventId,
    event_time: now,
    action_source: "website" as const,
    event_source_url: input.eventSourceUrl,
    user_data: {
      em: input.email ? [sha256(input.email)] : undefined,
      external_id: input.externalId ? [sha256(input.externalId)] : undefined,
    },
    custom_data: input.customData,
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
    console.error("[meta-capi-server] error", res.status, text)
  }
}
