"use client";
import { useTranslations } from "next-intl";
import type { SegmentStats, ConfidenceTier } from "@/lib/pricing/types";
import { formatUsdValue } from "../../utils/valuation";

const TIER_DOT: Record<ConfidenceTier, string> = {
  high: "bg-emerald-500",
  medium: "bg-amber-400",
  low: "bg-neutral-500",
  insufficient: "bg-neutral-700",
};

function TraceTooltip({ stats }: { stats: SegmentStats }) {
  return (
    <span className="pointer-events-none absolute z-50 hidden w-64 rounded border border-neutral-700 bg-neutral-900 p-2 text-[10px] text-neutral-300 group-hover:block">
      <div>{/* [HARDCODED] */}Market: <b>{stats.market}</b></div>
      <div>{/* [HARDCODED] */}Family: <b>{stats.family}</b></div>
      <div>{/* [HARDCODED] */}Sold sample: <b>{stats.marketValue.soldN}</b> ({stats.marketValue.tier})</div>
      <div>{/* [HARDCODED] */}Asking sample: <b>{stats.askMedian.askingN}</b> ({stats.askMedian.tier})</div>
      {stats.askMedian.factorApplied != null && (
        <div>{/* [HARDCODED] */}Factor: <b>{stats.askMedian.factorApplied.toFixed(2)}</b> ({stats.askMedian.factorSource})</div>
      )}
    </span>
  );
}

export function ValuationTile({ stats }: { stats: SegmentStats }) {
  const t = useTranslations();
  return (
    <div className="relative group flex flex-col gap-0.5 rounded border border-neutral-800 bg-neutral-950/60 px-3 py-2">
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-400">
          {t("valuation.marketValue")}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[stats.marketValue.tier]}`} aria-label={`tier:${stats.marketValue.tier}`} />
      </div>
      <div className="text-sm font-medium text-neutral-100">
        {formatUsdValue(stats.marketValue.valueUsd)}
        <span className="ml-1 text-[10px] text-neutral-500">
          ({stats.marketValue.soldN} {t("valuation.soldSamples")})
        </span>
      </div>

      <div className="mt-1 flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-[0.15em] text-neutral-400">
          {t("valuation.askMedian")}
        </span>
        <span className={`h-1.5 w-1.5 rounded-full ${TIER_DOT[stats.askMedian.tier]}`} aria-label={`tier:${stats.askMedian.tier}`} />
      </div>
      <div className="text-sm font-medium text-neutral-100">
        {formatUsdValue(stats.askMedian.valueUsd)}
        <span className="ml-1 text-[10px] text-neutral-500">
          ({stats.askMedian.askingN} {t("valuation.askingSamples")})
        </span>
      </div>
      <TraceTooltip stats={stats} />
    </div>
  );
}
