// ---------------------------------------------------------------------------
// Supabase queries for listing_reports and credits tables
// ---------------------------------------------------------------------------

import { createClient } from "@supabase/supabase-js"
import type {
  ListingReport,
  UserCreditsRow,
  CreditTransactionRow,
  DeductResult,
  ModelMarketStats,
} from "./types"
import type {
  HausReport,
  DetectedSignal,
  MissingSignal,
  AppliedModifier,
} from "@/lib/fairValue/types"
import { toUsd } from "../exchangeRates"

const DEFAULT_MONTHLY_PISTONS = 300
const REPORT_PISTON_COST = 100

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

/**
 * Update the v2 metadata columns on a listing_reports row (report_hash,
 * tier, version). Defensive against the columns not existing yet —
 * silently no-ops if the BE migration has not run. Returns true when the
 * write succeeded, false on any schema / network failure.
 */
export async function saveReportMetadataV2(
  listingId: string,
  reportHash: string,
  tier: "tier_1" | "tier_2" | "tier_3",
  version: number,
): Promise<boolean> {
  const supabase = getServiceClient()
  try {
    const { error } = await supabase
      .from("listing_reports")
      .update({
        report_hash: reportHash,
        tier,
        version,
      })
      .eq("listing_id", listingId)
    if (error) {
      // 42703 = undefined column — BE migration pending. Silent.
      if (
        error.code === "42703" ||
        /report_hash|tier|version/i.test(error.message ?? "")
      ) {
        return false
      }
      // Other errors: log once, still don't fail the request.
      console.warn("[saveReportMetadataV2] non-schema error, ignored:", error.message)
      return false
    }
    return true
  } catch (err) {
    console.warn("[saveReportMetadataV2] exception, ignored:", err)
    return false
  }
}

/**
 * Read the current version + hash from a listing_reports row, tolerating
 * missing columns. Returns null fields when BE migration is pending.
 */
export async function getReportMetadataV2(
  listingId: string,
): Promise<{ report_hash: string | null; tier: "tier_1" | "tier_2" | "tier_3" | null; version: number | null }> {
  const supabase = getServiceClient()
  try {
    const { data, error } = await supabase
      .from("listing_reports")
      .select("report_hash, tier, version")
      .eq("listing_id", listingId)
      .maybeSingle()
    if (error) {
      return { report_hash: null, tier: null, version: null }
    }
    if (!data) {
      return { report_hash: null, tier: null, version: null }
    }
    const row = data as {
      report_hash: string | null
      tier: "tier_1" | "tier_2" | "tier_3" | null
      version: number | null
    }
    return {
      report_hash: row.report_hash ?? null,
      tier: row.tier ?? null,
      version: row.version ?? null,
    }
  } catch {
    return { report_hash: null, tier: null, version: null }
  }
}

/**
 * Look up a report snapshot by its deterministic hash. Used by the public
 * /verify/[hash] route to prove authenticity of shared PDF/Excel exports.
 *
 * Graceful against the `report_hash` column not existing yet (BE migration
 * still pending). Returns:
 *  - { status: "found", report }
 *  - { status: "not_found" }
 *  - { status: "schema_pending" } when the column itself is missing
 */
export type VerifyLookupResult =
  | { status: "found"; report: ListingReport }
  | { status: "not_found" }
  | { status: "schema_pending" }

export async function getReportByHash(hash: string): Promise<VerifyLookupResult> {
  if (!hash || hash.length < 8) return { status: "not_found" }
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("listing_reports")
    .select("*")
    .eq("report_hash", hash)
    .maybeSingle()

  if (error) {
    // Column not in schema yet — BE hasn't run the v2 migration.
    // Postgres error codes: 42703 = undefined_column. Supabase returns
    // the pg code in error.code for PostgREST responses.
    if (error.code === "42703" || /report_hash/i.test(error.message ?? "")) {
      return { status: "schema_pending" }
    }
    return { status: "not_found" }
  }
  if (!data) return { status: "not_found" }
  return { status: "found", report: data as ListingReport }
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
      credits_balance: DEFAULT_MONTHLY_PISTONS,
      pack_credits_balance: 0,
      free_credits_used: 0,
      tier: "FREE",
      subscription_plan_key: null,
      monthly_allowance_pistons: DEFAULT_MONTHLY_PISTONS,
      unlimited_reports: false,
      credit_reset_date: new Date().toISOString(),
      stripe_customer_id: null,
      stripe_subscription_id: null,
      subscription_status: null,
      subscription_period_end: null,
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
    amount: DEFAULT_MONTHLY_PISTONS,
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
  if (user.tier === "MONTHLY" || user.tier === "ANNUAL") {
    return user as UserCreditsRow
  }

  const now = new Date()
  const resetDate = new Date(user.credit_reset_date)
  const monthsSinceReset =
    (now.getFullYear() - resetDate.getFullYear()) * 12 +
    (now.getMonth() - resetDate.getMonth())

  if (monthsSinceReset < 1) return user as UserCreditsRow

  const monthlyAllowance = user.monthly_allowance_pistons ?? DEFAULT_MONTHLY_PISTONS

  const { data: updated, error } = await supabase
    .from("user_credits")
    .update({
      credits_balance: monthlyAllowance,
      monthly_allowance_pistons: monthlyAllowance,
      credit_reset_date: now.toISOString(),
      updated_at: now.toISOString(),
      free_credits_used: 0,
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw new Error(`Failed to reset credits: ${error.message}`)

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: monthlyAllowance,
    type: "FREE_MONTHLY",
    description: `Monthly Pistons grant - ${now.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
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

  const isUnlimited = Boolean(user.unlimited_reports) || user.tier === "MONTHLY" || user.tier === "ANNUAL"
  const cost = isUnlimited ? 0 : REPORT_PISTON_COST
  const totalBalance = (user.credits_balance ?? 0) + (user.pack_credits_balance ?? 0)
  if (!isUnlimited && totalBalance < cost) {
    return { success: false, error: "INSUFFICIENT_CREDITS" }
  }

  const debitAmount = cost
  if (debitAmount > 0) {
    try {
      const { debitCredits } = await import("@/lib/advisor/persistence/ledger")
      await debitCredits({
        supabaseUserId: user.supabase_user_id,
        amount: debitAmount,
        type: "REPORT_USED",
        conversationId: null,
        messageId: null,
        description: `Report for listing ${listingId}`,
      })
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : "DEBIT_FAILED" }
    }
  } else {
    await supabase.from("credit_transactions").insert({
      user_id: userId,
      amount: 0,
      type: "REPORT_USED",
      description: `Unlimited report access for listing ${listingId}`,
      listing_id: listingId,
      stripe_payment_id: null,
    })
  }

  // Record the report access
  const { error: reportError } = await supabase
    .from("user_reports")
    .insert({
      user_id: userId,
      listing_id: listingId,
      report_id: reportId,
      credit_cost: debitAmount,
    })

  if (reportError && reportError.code === "23505") {
    // Already recorded — refund the debit so the ledger and balance stay aligned.
    if (debitAmount > 0) {
      const { debitCredits } = await import("@/lib/advisor/persistence/ledger")
      await debitCredits({
        supabaseUserId: user.supabase_user_id,
        amount: debitAmount,
        type: "ADVISOR_REFUND",
        conversationId: null,
        messageId: null,
        description: `Refund for duplicate report ${listingId}`,
      })
    }
    return { success: true, creditUsed: 0, cached: true }
  }

  return { success: true, creditUsed: debitAmount, cached: false }
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
      pack_credits_balance: (user.pack_credits_balance ?? 0) + amount,
      tier: user.tier === "FREE" ? "PACK_OWNER" : user.tier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error) throw new Error(`Failed to add credits: ${error.message}`)

  await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    type: "STRIPE_PACK_PURCHASE",
    description: `Purchased ${amount} Pistons`,
    stripe_payment_id: stripePaymentId ?? null,
  })

  return (updated ?? user) as UserCreditsRow
}

export async function updateStripeCustomerId(
  userId: string,
  stripeCustomerId: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("user_credits")
    .update({
      stripe_customer_id: stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error || !data) throw new Error(`Failed to link Stripe customer: ${error?.message ?? "unknown error"}`)
  return data as UserCreditsRow
}

export async function findUserByStripeCustomerId(
  stripeCustomerId: string,
): Promise<UserCreditsRow | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from("user_credits")
    .select("*")
    .eq("stripe_customer_id", stripeCustomerId)
    .maybeSingle()

  return (data as UserCreditsRow | null) ?? null
}

export async function findUserByStripeSubscriptionId(
  stripeSubscriptionId: string,
): Promise<UserCreditsRow | null> {
  const supabase = getServiceClient()
  const { data } = await supabase
    .from("user_credits")
    .select("*")
    .eq("stripe_subscription_id", stripeSubscriptionId)
    .maybeSingle()

  return (data as UserCreditsRow | null) ?? null
}

export async function grantStripePurchase(
  userId: string,
  amount: number,
  stripePaymentId: string,
  planId: string,
  stripeCustomerId?: string | null,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()
  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("stripe_payment_id", stripePaymentId)
    .maybeSingle()

  if (existingTx) {
    const { data: current } = await supabase
      .from("user_credits")
      .select("*")
      .eq("id", userId)
      .single()
    if (!current) throw new Error("User not found")
    return current as UserCreditsRow
  }

  const current = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (!current.data) throw new Error("User not found")

  const nextPackCredits = (current.data.pack_credits_balance ?? 0) + amount
  const nextTier =
    current.data.tier === "FREE" ? "PACK_OWNER" : current.data.tier

  const { data, error } = await supabase
    .from("user_credits")
    .update({
      pack_credits_balance: nextPackCredits,
      tier: nextTier,
      stripe_customer_id: stripeCustomerId ?? current.data.stripe_customer_id ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to grant pack credits: ${error?.message ?? "unknown error"}`)
  }

  const { error: txError } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount,
    type: "STRIPE_PACK_PURCHASE",
    description: `${planId} top-up of ${amount} Pistons`,
    stripe_payment_id: stripePaymentId,
  })

  if (txError) throw new Error(`Failed to record Stripe purchase: ${txError.message}`)

  return data as UserCreditsRow
}

export async function activateStripeSubscription(
  userId: string,
  params: {
    stripeCustomerId: string
    stripeSubscriptionId: string
    subscriptionStatus: string | null
    subscriptionPeriodEnd: string | null
    stripePaymentId: string
    subscriptionPlanKey?: string | null
    monthlyAllowancePistons?: number | null
    unlimitedReports?: boolean | null
  },
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()
  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("stripe_payment_id", params.stripePaymentId)
    .maybeSingle()

  if (existingTx) {
    const { data: current } = await supabase
      .from("user_credits")
      .select("*")
      .eq("id", userId)
      .single()
    if (!current) throw new Error("User not found")
    return current as UserCreditsRow
  }

  const { data, error } = await supabase
    .from("user_credits")
    .update({
      tier: "PRO",
      subscription_plan_key: params.subscriptionPlanKey ?? "rennsport",
      monthly_allowance_pistons: params.monthlyAllowancePistons ?? 10000,
      unlimited_reports: params.unlimitedReports ?? false,
      credits_balance: params.monthlyAllowancePistons ?? 10000,
      stripe_customer_id: params.stripeCustomerId,
      stripe_subscription_id: params.stripeSubscriptionId,
      subscription_status: params.subscriptionStatus,
      subscription_period_end: params.subscriptionPeriodEnd,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to activate subscription: ${error?.message ?? "unknown error"}`)
  }

  const { error: txError } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: params.monthlyAllowancePistons ?? 10000,
    type: "STRIPE_SUBSCRIPTION_ACTIVATION",
    description: `Activated Stripe subscription (${params.subscriptionPlanKey ?? "rennsport"})`,
    stripe_payment_id: params.stripePaymentId,
  })

  if (txError) throw new Error(`Failed to record subscription activation: ${txError.message}`)

  return data as UserCreditsRow
}

export async function updateStripeSubscriptionStatus(
  userId: string,
  params: {
    subscriptionStatus: string | null
    subscriptionPeriodEnd: string | null
    stripeSubscriptionId: string | null
    stripeCustomerId: string | null
  },
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()
  const { data, error } = await supabase
    .from("user_credits")
    .update({
      subscription_status: params.subscriptionStatus,
      subscription_period_end: params.subscriptionPeriodEnd,
      stripe_subscription_id: params.stripeSubscriptionId,
      stripe_customer_id: params.stripeCustomerId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (error || !data) {
    throw new Error(`Failed to update subscription status: ${error?.message ?? "unknown error"}`)
  }

  return data as UserCreditsRow
}

export async function deactivateStripeSubscription(
  userId: string,
  stripePaymentId: string,
): Promise<UserCreditsRow> {
  const supabase = getServiceClient()
  const { data: existingTx } = await supabase
    .from("credit_transactions")
    .select("id")
    .eq("stripe_payment_id", stripePaymentId)
    .maybeSingle()

  if (existingTx) {
    const { data: current } = await supabase
      .from("user_credits")
      .select("*")
      .eq("id", userId)
      .single()
    if (!current) throw new Error("User not found")
    return current as UserCreditsRow
  }

  const { data: current, error } = await supabase
    .from("user_credits")
    .select("*")
    .eq("id", userId)
    .single()

  if (error || !current) {
    throw new Error(`Failed to load user for cancellation: ${error?.message ?? "unknown error"}`)
  }

  const nextTier = (current.pack_credits_balance ?? 0) > 0 ? "PACK_OWNER" : "FREE"

  const { data, error: updateError } = await supabase
    .from("user_credits")
    .update({
      tier: nextTier,
      subscription_plan_key: null,
      monthly_allowance_pistons: DEFAULT_MONTHLY_PISTONS,
      unlimited_reports: false,
      stripe_subscription_id: null,
      subscription_status: "canceled",
      subscription_period_end: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)
    .select("*")
    .single()

  if (updateError || !data) {
    throw new Error(`Failed to deactivate subscription: ${updateError?.message ?? "unknown error"}`)
  }

  const { error: txError } = await supabase.from("credit_transactions").insert({
    user_id: userId,
    amount: 0,
    type: "STRIPE_SUBSCRIPTION_CANCELED",
    description: "Canceled Stripe subscription",
    stripe_payment_id: stripePaymentId,
  })

  if (txError) throw new Error(`Failed to record subscription cancellation: ${txError.message}`)

  return data as UserCreditsRow
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
      landed_cost_json: report.landed_cost,
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
    landed_cost: (row.landed_cost_json ?? null) as HausReport["landed_cost"],
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
