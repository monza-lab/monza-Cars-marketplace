import { extractStructuredSignals } from "@/lib/fairValue/extractors/structured"
import { extractSellerSignal } from "@/lib/fairValue/extractors/seller"
import { extractTextSignals } from "@/lib/fairValue/extractors/text"
import { extractColorIntelligence } from "@/lib/fairValue/extractors/color"
import { extractVinIntelligence } from "@/lib/fairValue/extractors/vinDeep"
import { applyModifiers, computeSpecificCarFairValue } from "@/lib/fairValue/engine"
import { generateInvestmentNarrative } from "@/lib/fairValue/narrative"
import { extractSeries } from "@/lib/brandConfig"
import type { HausReport } from "@/lib/fairValue/types"
import type { PipelineContext } from "../pipeline"

export async function executeFairValueEngine(
  ctx: PipelineContext
): Promise<{ data: HausReport; durationMs: number; agentModel: string | null }> {
  const t0 = Date.now()
  const { car, listingScrape, marketData } = ctx

  const description = listingScrape?.descriptionFull ?? car.description ?? ""
  const cleanDescription = description.replace(/<[^>]*>/g, "").trim()
  const seriesId = extractSeries(car.model ?? "", car.year ?? 0, car.make ?? "Porsche") ?? null

  // Parallel extraction — sync functions wrapped in Promise.resolve for Promise.all
  const [structuredSignals, sellerSignal, textResult, colorResult, vinResult] =
    await Promise.all([
      Promise.resolve(extractStructuredSignals({
        year: car.year ?? undefined,
        mileage: listingScrape?.mileage ?? car.mileage ?? undefined,
        transmission: listingScrape?.transmission ?? car.transmission ?? undefined,
      })),
      Promise.resolve(extractSellerSignal({
        sellerName: listingScrape?.sellerName ?? undefined,
        sellerDomain: car.sourceUrl ? (() => { try { return new URL(car.sourceUrl!).hostname } catch { return undefined } })() : undefined,
        make: car.make ?? undefined,
      })),
      cleanDescription
        ? extractTextSignals({ description: cleanDescription, make: car.make ?? undefined })
        : Promise.resolve(null),
      Promise.resolve(extractColorIntelligence({
        exteriorColor: listingScrape?.exteriorColor ?? car.exteriorColor ?? null,
        interiorColor: listingScrape?.interiorColor ?? car.interiorColor ?? null,
        seriesId,
        description: cleanDescription || null,
        make: car.make ?? undefined,
      })),
      Promise.resolve(extractVinIntelligence({
        vin: listingScrape?.vin ?? car.vin ?? null,
        year: car.year ?? 0,
        model: car.model ?? "",
        seriesId,
        make: car.make ?? undefined,
      })),
    ])

  const detected = [
    ...structuredSignals,
    ...(sellerSignal ? [sellerSignal] : []),
    ...(textResult?.signals ?? []),
  ]

  const baselineUsd = marketData?.marketStats?.primaryFairValueLow
    ? Math.round((marketData.marketStats.primaryFairValueLow + marketData.marketStats.primaryFairValueHigh) / 2)
    : 0

  const { appliedModifiers, totalPercent } = applyModifiers({ baselineUsd, signals: detected })
  const specificFV = computeSpecificCarFairValue({ baselineUsd, totalPercent })

  let narrative = null
  try {
    narrative = await generateInvestmentNarrative({
      title: car.title ?? `${car.year} ${car.make} ${car.model}`,
      year: car.year ?? 0,
      make: car.make ?? "Porsche",
      model: car.model ?? "",
      seriesId,
      mileage: car.mileage ?? null,
      transmission: car.transmission ?? null,
      exteriorColor: car.exteriorColor ?? null,
      interiorColor: car.interiorColor ?? null,
      price: car.price ?? 0,
      fairValueMid: specificFV.mid,
      signals: detected.map(s => s.key),
      redFlags: [],
      colorRarity: colorResult?.exterior?.rarity ?? null,
      colorPremium: colorResult?.exterior?.valuePremiumPercent ?? 0,
    })
  } catch { /* non-fatal */ }

  const report: HausReport = {
    listing_id: ctx.listingId,
    fair_value_low: specificFV.low,
    fair_value_high: specificFV.high,
    median_price: baselineUsd,
    specific_car_fair_value_low: specificFV.low,
    specific_car_fair_value_mid: specificFV.mid,
    specific_car_fair_value_high: specificFV.high,
    comparable_layer_used: null,
    comparables_count: marketData?.comparablesCount ?? 0,
    signals_detected: detected,
    signals_missing: [],
    modifiers_applied: appliedModifiers,
    modifiers_total_percent: totalPercent,
    signals_extracted_at: new Date().toISOString(),
    extraction_version: "v3.0",
    landed_cost: null,
    color_intelligence: colorResult ? {
      exteriorColorName: colorResult.exterior.matchedColor?.name ?? car.exteriorColor ?? null,
      exteriorColorCode: colorResult.exterior.matchedColor?.code ?? null,
      exteriorRarity: colorResult.exterior.rarity,
      exteriorDesirability: colorResult.exterior.matchedColor?.desirability ?? 5,
      exteriorValuePremiumPercent: colorResult.exterior.valuePremiumPercent,
      interiorColorName: car.interiorColor ?? null,
      combinationNote: colorResult.combinationNote,
      isPTS: colorResult.exterior.isPTS,
    } : undefined,
    vin_intelligence: vinResult ? {
      vinDecoded: vinResult.decoded,
      plant: vinResult.plant,
      bodyHint: vinResult.bodyHint,
      modelYearFromVin: vinResult.modelYearFromVin,
      yearMatchesListing: vinResult.yearMatch,
      warnings: vinResult.warnings,
    } : undefined,
    investment_narrative: narrative ?? undefined,
  }

  return {
    data: report,
    durationMs: Date.now() - t0,
    agentModel: textResult ? "gemini-2.5-flash" : null,
  }
}
