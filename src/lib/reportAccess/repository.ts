import "server-only"
import { createAdminClient } from "@/lib/supabase/server"
import { evaluateLeadRequest, isDisposableEmail, normalizeEmail } from "./policy"
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
  const db = createAdminClient()
  const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

  const [{ data: claimed }, { data: existingLead }, attemptsResult] = await Promise.all([
    db.from("user_credits").select("id").ilike("email", normalized).maybeSingle(),
    db.from("report_leads").select("id").eq("email_normalized", normalized).maybeSingle(),
    db.from("report_request_attempts")
      .select("id", { count: "exact", head: true })
      .or(`ip_hash.eq.${ipHash},device_hash.eq.${deviceHash}`)
      .gte("created_at", hourAgo),
  ])

  let completedReports = 0
  if (existingLead?.id) {
    const { count } = await db.from("report_lead_reports")
      .select("id", { count: "exact", head: true })
      .eq("lead_id", existingLead.id)
    completedReports = count ?? 0
  }
  const policy = evaluateLeadRequest({
    claimedUserExists: Boolean(claimed),
    completedReports,
    attemptsInLastHour: attemptsResult.count ?? 0,
  })
  if (!policy.ok) return policy

  const now = new Date().toISOString()
  const row = {
    email: email.trim(),
    email_normalized: normalized,
    utm_source: clean(attribution?.utm_source),
    utm_medium: clean(attribution?.utm_medium),
    utm_campaign: clean(attribution?.utm_campaign),
    utm_term: clean(attribution?.utm_term),
    utm_content: clean(attribution?.utm_content),
    fbclid: clean(attribution?.fbclid),
    gclid: clean(attribution?.gclid),
    landing_path: clean(attribution?.landing_path),
    referrer: clean(attribution?.referrer),
    first_seen_at: clean(attribution?.first_seen_at) ?? now,
    updated_at: now,
  }
  const { data: lead, error: leadError } = await db.from("report_leads")
    .upsert(row, { onConflict: "email_normalized", ignoreDuplicates: false })
    .select("id")
    .single()
  if (leadError || !lead) throw new Error(`Could not create report lead: ${leadError?.message ?? "unknown"}`)

  const token = createAccessToken()
  const { error: tokenError } = await db.from("report_access_tokens").insert({
    lead_id: lead.id,
    listing_id: listingId,
    token_hash: hashAccessToken(token),
  })
  if (tokenError) throw new Error(`Could not create report access: ${tokenError.message}`)

  await db.from("report_request_attempts").insert({
    ip_hash: ipHash,
    device_hash: deviceHash,
    email_hash: emailHash,
    listing_id: listingId,
    outcome: "allowed",
  })
  await Promise.allSettled([
    db.from("analytics_events").insert({
      event_name: "email_submitted",
      lead_id: lead.id,
      listing_id: listingId,
      source: clean(attribution?.utm_source),
      payload: { listingId },
    }),
    sendServerCapiEvent({
      eventName: "Lead",
      eventId: `lead_${lead.id}_${listingId}`,
      eventSourceUrl: clean(attribution?.landing_path) || "/browse",
      email: normalized,
      externalId: lead.id,
      customData: { content_name: "haus_report", listing_id: listingId },
    }),
  ])
  return { ok: true, token, leadId: lead.id }
}

export async function resolveReportToken(token: string, listingId: string, allowPending = false) {
  const db = createAdminClient()
  const { data } = await db.from("report_access_tokens")
    .select("id, lead_id, listing_id, status, revoked_at")
    .eq("token_hash", hashAccessToken(token))
    .eq("listing_id", listingId)
    .maybeSingle()
  if (!data || data.revoked_at || (!allowPending && data.status !== "ready")) return null
  return data as { id: string; lead_id: string; listing_id: string; status: "pending" | "ready" }
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
