"use client"

type MetaEventName =
  | "Lead"
  | "CompleteRegistration"
  | "InitiateCheckout"
  | "Purchase"

declare global {
  interface Window {
    fbq?: (
      action: "track" | "trackCustom",
      eventName: string,
      params?: Record<string, unknown>,
      opts?: { eventID: string },
    ) => void
  }
}

export function generateEventId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`
}

export function trackPixelEvent(
  eventName: MetaEventName,
  params: Record<string, unknown> = {},
  eventId: string,
) {
  if (typeof window === "undefined" || !window.fbq) return
  window.fbq("track", eventName, params, { eventID: eventId })
}

export async function sendCapiEvent(input: {
  eventName: MetaEventName
  eventId: string
  email?: string
  externalId?: string
  customData?: Record<string, unknown>
}) {
  if (typeof window === "undefined") return
  await fetch("/api/meta/conversions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      clientUserAgent: navigator.userAgent,
      eventSourceUrl: window.location.href,
      fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1],
      fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1],
    }),
  }).catch((err) => console.error("[meta-capi] send failed", err))
}

/** Fire both Pixel + CAPI with a shared eventId for dedup. */
export function fireMetaEvent(
  eventName: MetaEventName,
  opts: {
    pixelParams?: Record<string, unknown>
    email?: string
    externalId?: string
    customData?: Record<string, unknown>
  } = {},
) {
  const eventId = generateEventId()
  trackPixelEvent(eventName, opts.pixelParams ?? opts.customData ?? {}, eventId)
  sendCapiEvent({
    eventName,
    eventId,
    email: opts.email,
    externalId: opts.externalId,
    customData: opts.customData,
  })
}
