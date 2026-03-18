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
import { toUsd } from "../regionPricing"
import { ISO_TO_SYMBOL } from "../marketStats"

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
    const sym = primary ? (ISO_TO_SYMBOL[primary.currency] ?? "$") : "$"
    row.fair_value_low = marketStats.primaryFairValueLow
    row.fair_value_high = marketStats.primaryFairValueHigh
    row.median_price = primary ? Math.round(primary.medianPriceUsd) : null
    row.avg_price = primary ? Math.round(toUsd(primary.avgPrice, sym)) : null
    row.min_price = primary ? Math.round(toUsd(primary.minPrice, sym)) : null
    row.max_price = primary ? Math.round(toUsd(primary.maxPrice, sym)) : null
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
