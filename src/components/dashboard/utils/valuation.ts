import type { Auction } from "../types";
import { computeSegmentStats } from "@/lib/pricing/segmentStats";
import type { DerivedPrice, CanonicalMarket, SegmentStats } from "@/lib/pricing/types";

export type RegionalValuations = Record<CanonicalMarket, SegmentStats>;

const MARKETS: readonly CanonicalMarket[] = ["US", "EU", "UK", "JP"] as const;

export function auctionsToDerived(auctions: Auction[]): DerivedPrice[] {
  return auctions
    .filter((a) => a.canonicalMarket && a.family)
    .map((a) => ({
      soldPriceUsd: a.soldPriceUsd ?? null,
      askingPriceUsd: a.askingPriceUsd ?? null,
      basis: (a.valuationBasis ?? "unknown") as DerivedPrice["basis"],
      canonicalMarket: a.canonicalMarket as CanonicalMarket,
      family: a.family as string,
    }));
}

/** Family of the first auction, or most frequent family in the corpus. */
function dominantFamily(auctions: Auction[]): string | null {
  const counts = new Map<string, number>();
  for (const a of auctions) if (a.family) counts.set(a.family, (counts.get(a.family) ?? 0) + 1);
  let best: [string, number] | null = null;
  for (const entry of counts.entries()) if (!best || entry[1] > best[1]) best = entry;
  return best?.[0] ?? null;
}

export function computeRegionalValFromAuctions(
  auctions: Auction[],
  _rates?: Record<string, number>,
): RegionalValuations {
  const fam = dominantFamily(auctions);
  const corpus = auctionsToDerived(auctions);
  const out = {} as RegionalValuations;
  for (const m of MARKETS) {
    out[m] = computeSegmentStats(corpus, { market: m, family: fam ?? "unknown" });
  }
  return out;
}

export function formatUsdValue(v: number | null | undefined): string {
  if (v == null || !isFinite(v) || v <= 0) return "—";
  if (v >= 1_000_000) {
    const m = v / 1_000_000;
    const s = m.toFixed(1);
    return s.endsWith(".0") ? `$${m.toFixed(0)}M` : `$${s}M`;
  }
  return `$${Math.round(v / 1000).toLocaleString()}K`;
}

// Legacy helpers kept for callers not yet migrated. To be removed in Task 18 once unused.

/** @deprecated Use SegmentStats medians. */
export function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** @deprecated Read `a.soldPriceUsd ?? a.askingPriceUsd` directly. */
export function listingPriceUsd(a: Auction, _rates?: Record<string, number>): number {
  return a.soldPriceUsd ?? a.askingPriceUsd ?? 0;
}
