import type { DerivedPrice, FamilyFactorTable } from "./types";

const MIN_FAMILY_SOLD = 30;

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeFactorTable(prices: DerivedPrice[]): FamilyFactorTable {
  const allSold: number[] = [];
  const allAsking: number[] = [];
  const byFamilySold = new Map<string, number[]>();
  const byFamilyAsking = new Map<string, number[]>();

  for (const p of prices) {
    if (p.basis === "sold" && p.soldPriceUsd != null) {
      allSold.push(p.soldPriceUsd);
      if (p.family) {
        if (!byFamilySold.has(p.family)) byFamilySold.set(p.family, []);
        byFamilySold.get(p.family)!.push(p.soldPriceUsd);
      }
    } else if (p.basis === "asking" && p.askingPriceUsd != null) {
      allAsking.push(p.askingPriceUsd);
      if (p.family) {
        if (!byFamilyAsking.has(p.family)) byFamilyAsking.set(p.family, []);
        byFamilyAsking.get(p.family)!.push(p.askingPriceUsd);
      }
    }
  }

  const askMedianGlobal = median(allAsking);
  const soldMedianGlobal = median(allSold);
  const porscheWide = {
    factor: askMedianGlobal > 0 && soldMedianGlobal > 0 ? soldMedianGlobal / askMedianGlobal : 0,
    soldN: allSold.length,
    askingN: allAsking.length,
  };

  const byFamily: FamilyFactorTable["byFamily"] = {};
  for (const [family, solds] of byFamilySold.entries()) {
    if (solds.length < MIN_FAMILY_SOLD) continue;
    const asks = byFamilyAsking.get(family) ?? [];
    const askMed = median(asks);
    const soldMed = median(solds);
    if (askMed > 0 && soldMed > 0) {
      byFamily[family] = { family, factor: soldMed / askMed, soldN: solds.length, askingN: asks.length };
    }
  }

  return { porscheWide, byFamily, generatedAt: new Date().toISOString() };
}
