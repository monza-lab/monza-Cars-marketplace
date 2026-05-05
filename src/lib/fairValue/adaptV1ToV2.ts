import type {
  HausReport,
  HausReportV2,
  MarketIntel,
  MarketIntelD2,
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
  /**
   * Pre-computed D2 (cross-border arbitrage) block. Callers that run
   * server-side can compute this with `computeArbitrageForCar` and pass
   * it in — the adapter will use it verbatim. When omitted, the adapter
   * emits an empty D2 block (Phase 2 default; renders as "no data yet"
   * on the client).
   */
  d2Precomputed?: MarketIntelD2
}

function aggregateCaptureWindow(ctx: AdaptV1Context): { start: string; end: string } {
  const dates: string[] = []
  for (const r of ctx.marketStats?.regions ?? []) {
    if (r.oldestDate) dates.push(r.oldestDate)
    if (r.newestDate) dates.push(r.newestDate)
  }
  for (const c of ctx.dbComparables) {
    if (c.soldDate) dates.push(c.soldDate)
  }

  if (dates.length === 0) {
    const fallback = ctx.generatedAt ?? new Date().toISOString().slice(0, 10)
    return { start: fallback, end: fallback }
  }

  const sorted = [...dates].sort()
  return { start: sorted[0], end: sorted[sorted.length - 1] }
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

  // Aggregate the capture window across every region + comparable row so
  // confidence reflects true data freshness, not just the first region bucket.
  const captureWindow = aggregateCaptureWindow(ctx)
  const d4 = computeD4Confidence({
    sample_size: ctx.dbComparables.length,
    capture_date_start: captureWindow.start,
    capture_date_end: captureWindow.end,
    outlier_flags: [],
  })

  // D2 uses pre-computed cross-border arbitrage when available (server
  // callers compute it via `computeArbitrageForCar`); otherwise an empty
  // block keeps the adapter sync and the UI gracefully degrades.
  const marketIntel: MarketIntel = {
    d1,
    d2: ctx.d2Precomputed ?? {
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
