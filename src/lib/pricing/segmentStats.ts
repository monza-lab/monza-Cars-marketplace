import type { DerivedPrice, SegmentStats, CanonicalMarket } from "./types";
import { getFamilyFactor } from "./familyFactor";
import { iqrBand } from "./iqrBand";
import { classifySoldTier, classifyAskingTier } from "./confidence";

export interface SegmentKey {
  market: CanonicalMarket;
  family: string;
}

export function computeSegmentStats(prices: DerivedPrice[], key: SegmentKey): SegmentStats {
  const sold: number[] = [];
  const asking: number[] = [];
  for (const p of prices) {
    if (p.canonicalMarket !== key.market) continue;
    if (p.family !== key.family) continue;
    if (p.basis === "sold" && p.soldPriceUsd != null) sold.push(p.soldPriceUsd);
    else if (p.basis === "asking" && p.askingPriceUsd != null) asking.push(p.askingPriceUsd);
  }

  const soldBand = iqrBand(sold);
  const soldMedian = soldBand
    ? soldBand.p50
    : sold.length > 0
    ? sold.slice().sort((a, b) => a - b)[Math.floor(sold.length / 2)]
    : null;

  const factor = getFamilyFactor(key.family);
  const askBand = iqrBand(asking);
  const rawAskMedian = askBand
    ? askBand.p50
    : asking.length > 0
    ? asking.slice().sort((a, b) => a - b)[Math.floor(asking.length / 2)]
    : null;
  const adjustedAskMedian =
    rawAskMedian != null && factor.source !== "none" ? rawAskMedian * factor.factor : rawAskMedian;

  const askP25 =
    askBand != null && factor.source !== "none" ? askBand.p25 * factor.factor : askBand?.p25 ?? null;
  const askP75 =
    askBand != null && factor.source !== "none" ? askBand.p75 * factor.factor : askBand?.p75 ?? null;

  return {
    market: key.market,
    family: key.family,
    marketValue: {
      valueUsd: soldMedian,
      p25Usd: soldBand?.p25 ?? null,
      p75Usd: soldBand?.p75 ?? null,
      soldN: sold.length,
      tier: classifySoldTier(sold.length),
    },
    askMedian: {
      valueUsd: adjustedAskMedian,
      rawMedianUsd: rawAskMedian,
      p25Usd: askP25,
      p75Usd: askP75,
      askingN: asking.length,
      factorApplied: factor.source === "none" ? null : factor.factor,
      factorSource: factor.source,
      tier: classifyAskingTier(asking.length, factor.source),
    },
  };
}
