import { NextResponse } from "next/server"
import { randomUUID } from "crypto"
import { createClient } from "@/lib/supabase/server"
import { fetchPricedListingsForModel, fetchLiveListingById } from "@/lib/supabaseLiveListings"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { getExchangeRates } from "@/lib/exchangeRates"
import {
  getReportForListing,
  saveReport,
  saveHausReport,
  saveSignals,
  getOrCreateUser,
  hasAlreadyGenerated,
  deductCredit,
  checkAndResetFreeCredits,
  saveReportMetadataV2,
  getReportMetadataV2,
} from "@/lib/reports/queries"
import { computeReportHash } from "@/lib/reports/hash"
import { extractStructuredSignals } from "@/lib/fairValue/extractors/structured"
import { extractSellerSignal } from "@/lib/fairValue/extractors/seller"
import { extractTextSignals } from "@/lib/fairValue/extractors/text"
import { cleanDescription } from "@/lib/fairValue/extractors/descriptionCleaner"
import { extractColorIntelligence } from "@/lib/fairValue/extractors/color"
import { extractVinIntelligence } from "@/lib/fairValue/extractors/vinDeep"
import { generateInvestmentNarrative } from "@/lib/fairValue/narrative"
import { extractSeries } from "@/lib/brandConfig"
import { applyModifiers, computeSpecificCarFairValue } from "@/lib/fairValue/engine"
import { MODIFIER_LIBRARY_VERSION } from "@/lib/fairValue/modifiers"
import type {
  HausReport,
  DetectedSignal,
  MissingSignal,
  ComparableLayer,
} from "@/lib/fairValue/types"
import {
  calculateLandedCost,
  localeToDestination,
  sourceToOriginCountry,
} from "@/lib/landedCost"

// Extract the locale segment from the Referer header (e.g., "/en/cars/..." → "en").
// Falls back to "en" when the header is missing or malformed.
function inferLocaleFromReferer(referer: string | null): string {
  if (!referer) return "en"
  try {
    const path = new URL(referer).pathname
    const segment = path.split("/").filter(Boolean)[0]
    return segment || "en"
  } catch {
    return "en"
  }
}

interface AnalyzeRequestBody {
  listingId: string
}

// Signals we actively look for. Anything in this set that's not detected →
// becomes a MissingSignal (rendered as a "question for the seller" prompt).
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

function deriveMissing(detected: DetectedSignal[]): MissingSignal[] {
  const detectedKeys = new Set(detected.map((s) => s.key))
  return EXPECTED_SIGNAL_KEYS
    .filter((k) => !detectedKeys.has(k))
    .map<MissingSignal>((k) => ({
      key: k,
      name_i18n_key: `report.signals.${k}`,
      question_for_seller_i18n_key: `report.questions.${k}_question`,
    }))
}

function extractDomainFromUrl(url: string | null | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.toLowerCase()
  } catch {
    return null
  }
}

// Given the market stats struct, returns the baseline USD price (primary
// region median, converted to USD) plus the comparable-layer label.
function deriveBaseline(marketStats: NonNullable<ReturnType<typeof computeMarketStatsForCar>["marketStats"]>): {
  baselineUsd: number
  layer: ComparableLayer
} {
  const primary = marketStats.regions.find(
    (r) => r.region === marketStats.primaryRegion && r.tier === marketStats.primaryTier,
  )
  const baselineUsd = primary ? Math.round(primary.medianPriceUsd) : 0

  // computeMarketStatsForCar returns stats_scope as "model" | "series" | "family".
  // HausReport.comparable_layer_used uses "strict" | "series" | "family".
  // Map "model" → "strict" (= match on exact series), "series" → "series", "family" → "family".
  const layer: ComparableLayer =
    marketStats.scope === "family"
      ? "family"
      : marketStats.scope === "series"
        ? "strict"
        : "strict" // TODO: refine once computeMarketStats exposes a real comparable-layer enum

  return { baselineUsd, layer }
}

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "AUTH_REQUIRED", message: "Please sign in to generate reports" },
        { status: 401 },
      )
    }

    const body: AnalyzeRequestBody = await request.json()
    if (!body.listingId) {
      return NextResponse.json({ success: false, error: "listingId is required" }, { status: 400 })
    }

    // 2. Get/create user + reset credits if needed
    const dbUser = await getOrCreateUser(authUser.id, authUser.email!, authUser.user_metadata?.full_name)
    const user = await checkAndResetFreeCredits(dbUser.id)
    const totalBalance = (user.credits_balance ?? 0) + (user.pack_credits_balance ?? 0)

    // 3. Check if user already generated this report (free re-access)
    const alreadyGenerated = await hasAlreadyGenerated(user.id, body.listingId)

    // 4. Cache hit? A previously-generated Haus Report has signals_extracted_at set.
    //    (Legacy rows with only fair_value_low/high but no signal extraction are not
    //    treated as a cache hit — they need to be re-run through the new pipeline.)
    const existingReport = await getReportForListing(body.listingId)
    const cachedHausRow = existingReport as (typeof existingReport & {
      signals_extracted_at?: string | null
      specific_car_fair_value_low?: number | null
      specific_car_fair_value_mid?: number | null
      specific_car_fair_value_high?: number | null
      comparable_layer_used?: ComparableLayer | null
      comparables_count?: number | null
      modifiers_applied_json?: unknown
      modifiers_total_percent?: number | null
      extraction_version?: string | null
    }) | null
    if (cachedHausRow && cachedHausRow.signals_extracted_at) {
      // v2 metadata: pull hash/tier/version if the BE migration landed.
      // Silent fallback to nulls if the columns don't exist.
      const v2Meta = await getReportMetadataV2(body.listingId)
      return NextResponse.json({
        success: true,
        ok: true,
        data: cachedHausRow,
        report: cachedHausRow,
        cached: true,
        creditUsed: 0,
        creditsRemaining: totalBalance,
        // v2 additions (null when BE migration pending)
        report_hash: v2Meta.report_hash,
        tier: v2Meta.tier ?? "tier_1",
        report_version: v2Meta.version ?? 1,
      })
    }

    // 5. Credits check (if not already generated and no cached report)
    if (!alreadyGenerated && !user.unlimited_reports && totalBalance < 100) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_CREDITS",
          message: "You have no Pistons remaining for reports.",
          creditsRemaining: 0,
        },
        { status: 402 },
      )
    }

    // 6. Fetch the car
    const car = await fetchLiveListingById(body.listingId)
    if (!car) {
      return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 })
    }

    // 7. Fetch priced listings and compute market stats (shared helper)
    const allPriced = await fetchPricedListingsForModel(car.make)
    const rates = await getExchangeRates()
    const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)

    if (!marketStats) {
      return NextResponse.json(
        { success: false, error: "INSUFFICIENT_MARKET_DATA", message: "Not enough comparables to build a fair-value baseline." },
        { status: 422 },
      )
    }

    const { baselineUsd, layer } = deriveBaseline(marketStats)
    const fairValueLowUsd = marketStats.primaryFairValueLow
    const fairValueHighUsd = marketStats.primaryFairValueHigh
    const comparablesCount = marketStats.totalDataPoints

    // 8. Extractors — structured + seller (sync) + text (Gemini, async)
    const structuredSignals = extractStructuredSignals({
      year: car.year ?? null,
      mileage: car.mileage ?? null,
      transmission: car.transmission ?? null,
    })

    const sellerSignal = extractSellerSignal({
      sellerName: null, // CollectorCar doesn't expose a seller name; future: thread through from ListingRow
      sellerDomain: extractDomainFromUrl(car.sourceUrl ?? null),
    })

    // Clean the description before AI extraction (strips nav chrome, HTML, footers)
    const cleanedDescription = cleanDescription(car.description ?? "")

    let textResult: Awaited<ReturnType<typeof extractTextSignals>> = { ok: false, signals: [] }
    try {
      textResult = await extractTextSignals({
        description: cleanedDescription,
        maxOutputTokens: 4096,
      })
    } catch (geminiError) {
      console.error("[analyze] Gemini signal extraction failed:", geminiError)
      textResult = { ok: false, signals: [] }
    }

    // 8b. Color intelligence
    const seriesId = extractSeries(car.model, car.year ?? 0, car.make)
    const colorResult = extractColorIntelligence({
      exteriorColor: car.exteriorColor ?? null,
      interiorColor: car.interiorColor ?? null,
      seriesId,
      description: cleanedDescription,
    })

    // 8c. Deep VIN decode
    const vinResult = extractVinIntelligence({
      vin: car.vin ?? null,
      year: car.year ?? 0,
      model: car.model,
      seriesId,
    })

    const detected: DetectedSignal[] = [
      ...structuredSignals,
      ...(sellerSignal ? [sellerSignal] : []),
      ...(textResult.ok ? textResult.signals : []),
      ...colorResult.signals,
      ...vinResult.signals,
    ]

    // 8d. "no_accidents_confirmed" signal
    if (
      textResult.ok &&
      textResult.rawPayload?.originality.accident_disclosure === "no_accidents_claim" &&
      !detected.some((s) => s.key === "accident_history")
    ) {
      detected.push({
        key: "no_accidents_confirmed",
        name_i18n_key: "report.signals.no_accidents_confirmed",
        value_display: "No accidents claimed by seller",
        evidence: {
          source_type: "listing_text",
          source_ref: "description_text",
          raw_excerpt: null,
          confidence: "medium",
        },
      })
    }

    // 9. Modifiers + specific-car fair value
    const { appliedModifiers, totalPercent } = applyModifiers({ baselineUsd, signals: detected })
    const specific = computeSpecificCarFairValue({ baselineUsd, totalPercent })

    // 9b. Landed cost — destination from URL locale (via Referer), origin from
    //     the listing source. Returns null for domestic trades, unsupported
    //     origins, or if the exchange-rate fetch fails — never blocks the report.
    const locale = inferLocaleFromReferer(request.headers.get("referer"))
    const destination = localeToDestination(locale)
    const origin = sourceToOriginCountry(car.platform)
    let landedCost: Awaited<ReturnType<typeof calculateLandedCost>> = null
    try {
      if (origin && car.price && car.price > 0 && car.year) {
        landedCost = await calculateLandedCost({
          car: { priceUsd: car.price, year: car.year },
          origin,
          destination,
        })
      }
    } catch (err) {
      console.error("[analyze] landedCost computation failed", err)
      landedCost = null
    }

    // 9c. Investment narrative
    let investmentNarrative: Awaited<ReturnType<typeof generateInvestmentNarrative>> = null
    try {
      investmentNarrative = await generateInvestmentNarrative({
        title: car.title,
        year: car.year ?? 0,
        make: car.make,
        model: car.model,
        seriesId,
        mileage: car.mileage ?? null,
        transmission: car.transmission ?? null,
        exteriorColor: car.exteriorColor ?? null,
        interiorColor: car.interiorColor ?? null,
        price: car.price ?? 0,
        fairValueMid: specific.mid,
        signals: detected.map((s) => s.key),
        redFlags: vinResult.warnings,
        colorRarity: colorResult.exterior.rarity,
        colorPremium: colorResult.exterior.valuePremiumPercent,
      })
    } catch (err) {
      console.error("[analyze] narrative generation failed:", err)
    }

    // 10. Compose HausReport
    const runId = randomUUID()
    const now = new Date().toISOString()
    const report: HausReport = {
      listing_id: body.listingId,
      fair_value_low: fairValueLowUsd,
      fair_value_high: fairValueHighUsd,
      median_price: baselineUsd,
      specific_car_fair_value_low: specific.low,
      specific_car_fair_value_mid: specific.mid,
      specific_car_fair_value_high: specific.high,
      comparable_layer_used: layer,
      comparables_count: comparablesCount,
      signals_detected: detected,
      signals_missing: deriveMissing(detected),
      modifiers_applied: appliedModifiers,
      modifiers_total_percent: totalPercent,
      signals_extracted_at: textResult.ok ? now : null,
      extraction_version: MODIFIER_LIBRARY_VERSION,
      landed_cost: landedCost,
      color_intelligence: {
        exteriorColorName: colorResult.exterior.matchedColor?.name ?? car.exteriorColor ?? null,
        exteriorColorCode: colorResult.exterior.matchedColor?.code ?? null,
        exteriorRarity: colorResult.exterior.rarity,
        exteriorDesirability: colorResult.exterior.matchedColor?.desirability ?? 5,
        exteriorValuePremiumPercent: colorResult.exterior.valuePremiumPercent,
        interiorColorName: car.interiorColor ?? null,
        combinationNote: colorResult.combinationNote,
        isPTS: colorResult.exterior.isPTS,
      },
      vin_intelligence: {
        vinDecoded: vinResult.decoded,
        plant: vinResult.plant,
        bodyHint: vinResult.bodyHint,
        modelYearFromVin: vinResult.modelYearFromVin,
        yearMatchesListing: vinResult.yearMatch,
        warnings: vinResult.warnings,
      },
      investment_narrative: investmentNarrative,
    }

    // 11. Persist
    //     — saveReport writes the legacy market-stats columns (avg/min/max,
    //       regional_stats, trend_percent, stats_scope, etc.) that the old
    //       ReportClient + analytics still read.
    //     — saveHausReport overlays the Haus-specific columns (specific-car
    //       fair values, comparable layer, modifiers_applied_json, etc.).
    //     — saveSignals writes one row per DetectedSignal to listing_signals.
    await saveReport(body.listingId, marketStats, null)
    await saveHausReport(body.listingId, report)
    if (detected.length > 0) {
      await saveSignals(body.listingId, runId, MODIFIER_LIBRARY_VERSION, detected)
    }

    // 11b. v2 metadata: compute deterministic hash over the generated
    //      HausReport (minus volatile fields) and try to persist hash +
    //      tier + version. Defensive — silently no-ops if the BE migration
    //      hasn't added the columns yet.
    const reportHash = computeReportHash(report, {
      ignoreKeys: ["signals_extracted_at"],
    })
    const priorMeta = await getReportMetadataV2(body.listingId)
    const nextVersion = (priorMeta.version ?? 0) + 1
    const tier: "tier_1" | "tier_2" | "tier_3" = "tier_1"
    const metaWritten = await saveReportMetadataV2(
      body.listingId,
      reportHash,
      tier,
      nextVersion,
    )

    // 12. Deduct credit
    let creditUsed = 0
    if (!alreadyGenerated) {
      // Use the listing id as a stable "report_id" surrogate since saveHausReport
      // is upsert-on-listing_id (no separate id returned). The deduct path only
      // uses report_id for the user_reports audit row.
      const creditResult = await deductCredit(user.id, body.listingId, body.listingId)
      if (creditResult.success) {
        creditUsed = creditResult.creditUsed
      }
    }

    return NextResponse.json({
      success: true,
      ok: true,
      data: report,
      report,
      cached: false,
      creditUsed,
      creditsRemaining: totalBalance - creditUsed,
      geminiUsed: textResult.ok,
      // v2 additions
      report_hash: reportHash,
      tier,
      report_version: nextVersion,
      v2_metadata_persisted: metaWritten,
    })
  } catch (error) {
    console.error("Error analyzing listing:", error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    )
  }
}
