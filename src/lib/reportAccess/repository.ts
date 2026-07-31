import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { isDisposableEmail, normalizeEmail } from "./policy"
import { createAccessToken, hashAccessToken, hashIdentifier } from "./tokens"
import { sendServerCapiEvent } from "@/lib/marketing/metaCapiServer"

type AttributionInput = Partial<Record<
  "utm_source" | "utm_medium" | "utm_campaign" | "utm_term" | "utm_content" |
  "fbclid" | "gclid" | "landing_path" | "referrer" | "first_seen_at",
  unknown
>>

function clean(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null
}

export async function requestLeadAccess({
  email,
  listingId,
  deviceId,
  ip,
  attribution,
}: {
  email: string
  listingId: string
  deviceId: string
  ip: string
  attribution?: AttributionInput
}): Promise<
  | { ok: true; token: string; leadId: string }
  | { ok: false; code: "AUTH_REQUIRED" | "CLAIM_REQUIRED" | "RATE_LIMITED" | "DISPOSABLE_EMAIL" }
> {
  const normalized = normalizeEmail(email)
  if (isDisposableEmail(normalized)) return { ok: false, code: "DISPOSABLE_EMAIL" }

  const secret = process.env.REPORT_ACCESS_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!secret) throw new Error("REPORT_ACCESS_SECRET missing")
  const ipHash = hashIdentifier(ip, secret)
  const deviceHash = hashIdentifier(deviceId, secret)
  const emailHash = hashIdentifier(normalized, secret)
  const now = new Date().toISOString()
  const token = createAccessToken()
  const db = createAdminClient()
  const { data, error } = await db.rpc("reserve_report_lead_access", {
    p_email: email.trim(),
    p_email_normalized: normalized,
    p_listing_id: listingId,
    p_ip_hash: ipHash,
    p_device_hash: deviceHash,
    p_email_hash: emailHash,
    p_token_hash: hashAccessToken(token),
    p_utm_source: clean(attribution?.utm_source),
    p_utm_medium: clean(attribution?.utm_medium),
    p_utm_campaign: clean(attribution?.utm_campaign),
    p_utm_term: clean(attribution?.utm_term),
    p_utm_content: clean(attribution?.utm_content),
    p_fbclid: clean(attribution?.fbclid),
    p_gclid: clean(attribution?.gclid),
    p_landing_path: clean(attribution?.landing_path),
    p_referrer: clean(attribution?.referrer),
    p_first_seen_at: clean(attribution?.first_seen_at) ?? now,
  })
  if (error) throw new Error(`Could not reserve report access: ${error.message}`)
  const reservation = data as { code?: string; lead_id?: string } | null
  if (reservation?.code !== "OK" || !reservation.lead_id) {
    const code = reservation?.code
    if (code === "AUTH_REQUIRED" || code === "CLAIM_REQUIRED" || code === "RATE_LIMITED") {
      return { ok: false, code }
    }
    throw new Error("Could not reserve report access: invalid response")
  }
  const leadId = reservation.lead_id
  await Promise.allSettled([
    db.from("analytics_events").insert({
      event_name: "email_submitted",
      lead_id: leadId,
      listing_id: listingId,
      source: clean(attribution?.utm_source),
      payload: { listingId },
    }),
    sendServerCapiEvent({
      eventName: "Lead",
      eventId: `lead_${leadId}_${listingId}`,
      eventSourceUrl: clean(attribution?.landing_path) || "/browse",
      email: normalized,
      externalId: leadId,
      customData: { content_name: "haus_report", listing_id: listingId },
    }),
  ])
  return { ok: true, token, leadId }
}

export async function resolveReportToken(token: string, listingId: string, allowPending = false) {
  const db = createAdminClient()
  const { data } = await db.from("report_access_tokens")
    .select("id, lead_id, listing_id, status, revoked_at, pending_expires_at")
    .eq("token_hash", hashAccessToken(token))
    .eq("listing_id", listingId)
    .maybeSingle()
  if (!data || data.revoked_at || (!allowPending && data.status !== "ready")) return null
  if (data.status === "pending") {
    const expiresAt = Date.parse(data.pending_expires_at ?? "")
    if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) return null
  }
  return data as { id: string; lead_id: string; listing_id: string; status: "pending" | "ready"; pending_expires_at?: string | null }
}

export async function revokePendingReportAccess(accessId: string): Promise<void> {
  const db = createAdminClient()
  const { error } = await db.from("report_access_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("id", accessId)
    .eq("status", "pending")
  if (error) throw new Error(`Could not release pending report access: ${error.message}`)
}

export async function completeLeadReportAccess({
  accessId,
  leadId,
  listingId,
}: {
  accessId: string
  leadId: string
  listingId: string
}): Promise<{ email: string }> {
  const db = createAdminClient()
  const normalizedListingId = listingId.startsWith("live-") ? listingId.slice(5) : listingId
  const { error: reportError } = await db.from("report_lead_reports").upsert({
    lead_id: leadId,
    listing_id: normalizedListingId,
    report_id: normalizedListingId,
  }, { onConflict: "lead_id,listing_id", ignoreDuplicates: true })
  if (reportError) throw new Error(`Could not commit lead report: ${reportError.message}`)
  const now = new Date().toISOString()
  const [{ error: tokenError }, { data: lead, error: leadError }] = await Promise.all([
    db.from("report_access_tokens").update({ status: "ready", ready_at: now }).eq("id", accessId),
    db.from("report_leads").update({ first_report_at: now, updated_at: now }).eq("id", leadId).select("email").single(),
  ])
  if (tokenError || leadError || !lead) throw new Error("Could not finalize report access")
  return { email: lead.email as string }
}

export async function claimReportLead(email: string, userCreditsId: string) {
  const db = createAdminClient()
  const { data: lead } = await db.from("report_leads")
    .select("id")
    .eq("email_normalized", normalizeEmail(email))
    .is("claimed_at", null)
    .maybeSingle()
  if (!lead) return { claimed: false, leadId: null, transferredReports: 0 }
  const { data, error } = await db.rpc("claim_report_lead", {
    p_email: email,
    p_user_credits_id: userCreditsId,
    p_report_cost: 1000,
  })
  if (error) throw new Error(`Could not claim report lead: ${error.message}`)
  return { claimed: true, leadId: lead.id as string, transferredReports: Number(data ?? 0) }
}
