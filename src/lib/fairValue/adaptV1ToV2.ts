import type {
  HausReport,
  HausReportV2,
  MarketIntel,
  RemarkableClaim,
  ReportTier,
} from "./types"
import type { ModelMarketStats } from "@/lib/reports/types"
import type { DbComparableRow } from "@/lib/db/queries"
import {
  computeD1Trajectory,
  computeD3PeerPositioning,
  computeD4Confidence,
  type SoldComparableInput,
} from "@/lib/marketIntel/aggregator"
import { generateRemarkable } from "@/lib/remarkableGenerator/generator"

/**
 * Best-effort adapter: projects a v1 HausReport + surrounding context
 * into a v2 HausReportV2 shape suitable for the new block components.
 *
 * Used during Phase 2 while the `/api/analyze` orchestrator still emits v1
 * data. Phase 3 will replace this adapter with server-side v2 emission.
 *
 * D1/D3/D4 are computed client-side from the existing market stats and
 * comparables passed in. D2 (cross-border arbitrage) is zeroed out here
 * because it requires server-side landed-cost resolution across regions
 * — that lights up in Phase 3.
 */
export interface AdaptV1Context {
  v1Report: HausReport
  marketStats: ModelMarketStats | null
  dbComparables: DbComparableRow[]
  thisVinPriceUsd: number
  tier?: ReportTier
  reportHash?: string | null
  reportId?: string
  reportVersion?: number
  generatedAt?: string
}

export function adaptV1ReportToV2(ctx: AdaptV1Context): HausReportV2 {
  const tier: ReportTier = ctx.tier ?? "tier_1"

  // Project DbComparableRow into SoldComparableInput for the aggregator.
  const soldInputs: SoldComparableInput[] = ctx.dbComparables
    .filter((c) => c.soldDate && c.soldPrice > 0)
    .map((c) => ({
      priceUsd: c.soldPrice,
      soldDate: c.soldDate,
      status: "sold",
    }))

  const d1 = computeD1Trajectory(soldInputs)

  const d3 = computeD3PeerPositioning({
    thisVinPriceUsd: ctx.thisVinPriceUsd,
    variantSoldPricesUsd: ctx.dbComparables
      .filter((c) => c.soldPrice > 0)
      .map((c) => c.soldPrice),
    adjacentVariants: [],
  })

  const d4 = computeD4Confidence({
    sample_size: ctx.dbComparables.length,
    capture_date_start: ctx.marketStats?.regions[0]?.oldestDate ?? ctx.generatedAt ?? new Date().toISOString().slice(0, 10),
    capture_date_end: ctx.marketStats?.regions[0]?.newestDate ?? ctx.generatedAt ?? new Date().toISOString().slice(0, 10),
    outlier_flags: [],
  })

  // D2 is a no-op stub at this stage — real cross-border arbitrage lights
  // up when the Phase 3 orchestrator resolves landed cost per region.
  const marketIntel: MarketIntel = {
    d1,
    d2: {
      by_region: [],
      target_region: "US",
      narrative_insight: null,
    },
    d3,
    d4,
  }

  const { claims } = generateRemarkable({
    tier,
    variant_key: "",
    signals: ctx.v1Report.signals_detected,
    reference_pack: null,
    kb_entries: [],
    specialist_claims: [],
  })

  const remarkableClaims: RemarkableClaim[] = claims

  return {
    ...ctx.v1Report,
    report_id: ctx.reportId ?? `adapter-${ctx.v1Report.listing_id}`,
    report_hash: ctx.reportHash ?? "",
    report_version: ctx.reportVersion ?? 1,
    tier,
    market_intel: marketIntel,
    remarkable_claims: remarkableClaims,
    specialist_coverage_available: false,
    generated_at: ctx.generatedAt ?? new Date().toISOString(),
  }
}
