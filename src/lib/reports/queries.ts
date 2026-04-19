// ---------------------------------------------------------------------------
// Supabase queries for listing_reports and credits tables
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js"
import type {
  ListingReport,
  UserCreditsRow,
  CreditTransactionRow,
  DeductResult,
  RegionalMarketStats,
  ModelMarketStats,
} from "./types"
import type {
  HausReport,
  DetectedSignal,
  MissingSignal,
  AppliedModifier,
} from "@/lib/fairValue/types"
import { toUsd } from "../exchangeRates"

const FREE_CREDITS_PER_MONTH = 3

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

// -- Reports --

export async function getReportForListing(
  listingId: string,
): Promise<ListingReport | null> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("listing_reports")
    .select("*")
    .eq("listing_id", listingId)
    .single()

  if (error || !data) return null
  return data as ListingReport
}

export async function saveReport(
  listingId: string,
  marketStats: ModelMarketStats | null,
  llmData: Partial<ListingReport> | null,
): Promise<ListingReport> {
  const supabase = getServiceClient()

  const row: Record<string, unknown> = {
    listing_id: listingId,
    updated_at: new Date().toISOString(),
  }

  if (marketStats) {
    const primary = marketStats.regions.find(
      r => r.region === marketStats.primaryRegion && r.tier === marketStats.primaryTier,
    )
    const { getExchangeRates } = await import("../exchangeRates")
    const rates = await getExchangeRates()
    const cur = primary?.currency ?? "USD"
    row.fair_value_low = marketStats.primaryFairValueLow
    row.fair_value_high = marketStats.primaryFairValueHigh
    row.median_price = primary ? Math.round(primary.medianPriceUsd) : null
    row.avg_price = primary ? Math.round(toUsd(primary.avgPrice, cur, rates)) : null
    row.min_price = primary ? Math.round(toUsd(primary.minPrice, cur, rates)) : null
    row.max_price = primary ? Math.round(toUsd(primary.maxPrice, cur, rates)) : null
    row.total_comparable_sales = marketStats.totalDataPoints
    row.trend_percent = primary?.trendPercent ?? null
    row.trend_direction = primary?.trendDirection ?? null
    row.stats_scope = marketStats.scope
    row.primary_tier = marketStats.primaryTier
    row.primary_region = marketStats.primaryRegion
    row.regional_stats = marketStats.regions
  }

  if (llmData) {
    for (const [key, value] of Object.entries(llmData)) {
      if (key !== "id" && key !== "listing_id" && key !== "created_at") {
        row[key] = value
      }
    }
  }

  const { data, error } = await supabase
    .from("listing_reports")
    .upsert(row, { onConflict: "listing_id" })
    .select("*")
    .single()

  if (error) throw new Error(`Failed to save report: ${error.message}`)
  return data as ListingReport
}

// -- Credits --

export async function getOrCreateUser(
  supabaseUserId: string,
  email: string,
  displayName?: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()

  // Try to find existing user
  const { data: existing } = await supabase
    .from("user_credits")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .single()

  if (existing) return existing as UserCreditsRow

  // Create new user with 3 free credits
  const { data: created, error } = await supabase
    .from("user_credits")
    .insert({
      supabase_user_id: supabaseUserId,
      email,
      display_name: displayName ?? null,
      credits_balance: FREE_CREDITS_PER_MONTH,
      tier: "FREE",
      credit_reset_date: new Date().toISOString(),
    })
    .select("*")
    .single()

  if (error) {
    // Race condition: another request created the user
    if (error.code === "23505") {
      const { data: retry } = await supabase
        .from("user_credits")
        .select("*")
        .eq("supabase_user_id", supabaseUserId)
        .single()
      if (retry) return retry as UserCreditsRow
    }
    throw new Error(`Failed to create user: ${error.message}`)
  }

  // Log welcome credits transaction
  await supabase.from("credit_transactions").insert({
    user_id: created.id,
    amount: FREE_CREDITS_PER_MONTH,
    type: "FREE_MONTHLY",
    description: "Welcome credits",
  })

  return created as UserCreditsRow
}

export async function checkAndResetFreeCredits(
  userId: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()

  const { data: user } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!user) throw new Error("User not found")

  const now = new Date()
  const resetDate = new Date(user.credit_reset_date)
  const monthsSinceReset =
    (now.getFullYear() - resetDate.getFullYear()) * 12 +
    (now.getMonth() - resetDate.getMonth())

  if (monthsSinceReset < 1) return user as UserCreditsRow

  const { data: updated, error } = await supabase
    .from("user_credits")
    .update({
      credits_balance: user.credits_balance + FREE_CREDITS_PER_MONTH,
      credit_reset_date: now.toISOString(),
      updated_at: now.toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw new Error(`Failed to reset credits: ${error.message}`)

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: FREE_CREDITS_PER_MONTH,
    type: "FREE_MONTHLY",
    description: `Monthly free credits - ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
  })

  return (updated ?? user) as UserCreditsRow
}

export async function hasAlreadyGenerated(
  userId: string,
  listingId: string,
): Promise<boolean> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from("user_reports")
    .select("id")
    .eq("user_id", userId)
    .eq("listing_id", listingId)
    .single()

  return !!data
}

export async function deductCredit(
  userId: string,
  listingId: string,
  reportId: string,
): Promise<DeductResult> {
  const supabase = getServiceClient()

  // Check if already generated (free re-access)
  const already = await hasAlreadyGenerated(userId, listingId)
  if (already) return { success: true, creditUsed: 0, cached: true }

  // Check balance
  const { data: user } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!user) return { success: false, error: "USER_NOT_FOUND" }
  if (user.credits_balance < 1) return { success: false, error: "INSUFFICIENT_CREDITS" }

  // Deduct credit
  const { error: updateError } = await supabase
    .from("user_credits")
    .update({
      credits_balance: user.credits_balance - 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (updateError) return { success: false, error: updateError.message }

  // Record the report access
  const { error: reportError } = await supabase
    .from("user_reports")
    .insert({
      user_id: userId,
      listing_id: listingId,
      report_id: reportId,
      credit_cost: 1,
    })

  if (reportError && reportError.code === "23505") {
    // Already recorded — restore credit
    await supabase
      .from("user_credits")
      .update({ credits_balance: user.credits_balance })
      .eq("id", userId)
    return { success: true, creditUsed: 0, cached: true }
  }

  // Log transaction
  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: -1,
    type: "REPORT_USED",
    description: `Report for listing ${listingId}`,
    listing_id: listingId,
  })

  return { success: true, creditUsed: 1, cached: false }
}

export async function getUserCredits(
  supabaseUserId: string,
): Promise<UserCreditsRow | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from("user_credits")
    .select("*")
    .eq("supabase_user_id", supabaseUserId)
    .single()

  if (!data) return null

  return checkAndResetFreeCredits(data.id)
}

export async function addPurchasedCredits(
  userId: string,
  amount: number,
  stripePaymentId?: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()

  const { data: user } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!user) throw new Error("User not found")

  const { data: updated, error } = await supabase
    .from("user_credits")
    .update({
      credits_balance: user.credits_balance + amount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw new Error(`Failed to add credits: ${error.message}`)

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    type: "PURCHASE",
    description: `Purchased ${amount} credits`,
    stripe_payment_id: stripePaymentId ?? null,
  })

  return (updated ?? user) as UserCreditsRow
}

export async function getTransactionHistory(
  userId: string,
  limit = 20,
): Promise<CreditTransactionRow[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error || !data) return []
  return data as CreditTransactionRow[]
}

// -- Haus Report writers (Phase 6, Task 29) --

export async function saveHausReport(
  listingId: string,
  report: Omit<HausReport, "listing_id">,
): Promise<void> {
  const supabase = getServiceClient()

  const { error } = await supabase.from("listing_reports").upsert(
    {
      listing_id: listingId,
      fair_value_low: report.fair_value_low,
      fair_value_high: report.fair_value_high,
      median_price: report.median_price,
      specific_car_fair_value_low: report.specific_car_fair_value_low,
      specific_car_fair_value_mid: report.specific_car_fair_value_mid,
      specific_car_fair_value_high: report.specific_car_fair_value_high,
      comparable_layer_used: report.comparable_layer_used,
      comparables_count: report.comparables_count,
      modifiers_applied_json: report.modifiers_applied,
      modifiers_total_percent: report.modifiers_total_percent,
      signals_extracted_at: report.signals_extracted_at,
      extraction_version: report.extraction_version,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "listing_id" },
  )

  if (error) throw new Error(`saveHausReport failed: ${error.message}`)
}

// Signals we actively look for — used to derive `signals_missing` when assembling
// a HausReport from the DB. Keep in sync with the orchestrator's EXPECTED_SIGNAL_KEYS.
const EXPECTED_SIGNAL_KEYS = [
  "paint_to_sample",
  "service_records",
  "previous_owners",
  "original_paint",
  "accident_history",
  "documentation",
  "warranty",
  "seller_tier",
  "transmission",
  "mileage",
]

export interface ListingSignalRow {
  signal_key: string
  signal_value_json: { value_display?: string; name_i18n_key?: string } | null
  evidence_source_type: string
  evidence_source_ref: string | null
  evidence_raw_excerpt: string | null
  evidence_confidence: string
}

export async function fetchSignalsForListing(
  listingId: string,
): Promise<ListingSignalRow[]> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("listing_signals")
    .select(
      "signal_key, signal_value_json, evidence_source_type, evidence_source_ref, evidence_raw_excerpt, evidence_confidence",
    )
    .eq("listing_id", listingId)
    .order("extracted_at", { ascending: false })
  if (error) throw new Error(`fetchSignalsForListing failed: ${error.message}`)
  return (data ?? []) as ListingSignalRow[]
}

export function assembleHausReportFromDB(
  row: Record<string, unknown>,
  signalRows: ListingSignalRow[],
): HausReport {
  const detected: DetectedSignal[] = signalRows.map((r) => ({
    key: r.signal_key,
    name_i18n_key:
      r.signal_value_json?.name_i18n_key ?? `report.signals.${r.signal_key}`,
    value_display: r.signal_value_json?.value_display ?? "",
    evidence: {
      source_type: r.evidence_source_type as DetectedSignal["evidence"]["source_type"],
      source_ref: r.evidence_source_ref ?? "",
      raw_excerpt: r.evidence_raw_excerpt,
      confidence: r.evidence_confidence as DetectedSignal["evidence"]["confidence"],
    },
  }))

  const detectedKeys = new Set(detected.map((s) => s.key))
  const missing: MissingSignal[] = EXPECTED_SIGNAL_KEYS
    .filter((k) => !detectedKeys.has(k))
    .map((k) => ({
      key: k,
      name_i18n_key: `report.signals.${k}`,
      question_for_seller_i18n_key: `report.questions.${k}_question`,
    }))

  const num = (v: unknown, fallback = 0) =>
    v === null || v === undefined ? fallback : Number(v)

  return {
    listing_id: String(row.listing_id ?? ""),
    fair_value_low: num(row.fair_value_low),
    fair_value_high: num(row.fair_value_high),
    median_price: num(row.median_price),
    specific_car_fair_value_low: num(row.specific_car_fair_value_low),
    specific_car_fair_value_mid: num(row.specific_car_fair_value_mid),
    specific_car_fair_value_high: num(row.specific_car_fair_value_high),
    comparable_layer_used: (row.comparable_layer_used ?? "strict") as HausReport["comparable_layer_used"],
    comparables_count: num(row.comparables_count),
    signals_detected: detected,
    signals_missing: missing,
    modifiers_applied: (row.modifiers_applied_json ?? []) as AppliedModifier[],
    modifiers_total_percent: num(row.modifiers_total_percent),
    signals_extracted_at: (row.signals_extracted_at as string | null) ?? null,
    extraction_version: (row.extraction_version as string | undefined) ?? "v1.0",
  }
}

export async function saveSignals(
  listingId: string,
  runId: string,
  version: string,
  signals: DetectedSignal[],
): Promise<void> {
  if (signals.length === 0) return
  const supabase = getServiceClient()

  const rows = signals.map((s) => ({
    listing_id: listingId,
    extraction_run_id: runId,
    signal_key: s.key,
    signal_value_json: {
      value_display: s.value_display,
      name_i18n_key: s.name_i18n_key,
    },
    evidence_source_type: s.evidence.source_type,
    evidence_source_ref: s.evidence.source_ref,
    evidence_raw_excerpt: s.evidence.raw_excerpt,
    evidence_confidence: s.evidence.confidence,
    extraction_version: version,
  }))

  const { error } = await supabase.from("listing_signals").insert(rows)
  if (error) throw new Error(`saveSignals failed: ${error.message}`)
}
