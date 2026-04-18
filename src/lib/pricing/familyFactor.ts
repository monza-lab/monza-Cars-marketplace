import type { FamilyFactorTable } from "./types";
import { FAMILY_FACTOR_TABLE } from "./familyFactor.generated";

const MIN_SOLD_FOR_FAMILY_FACTOR = 30;

let activeTable: FamilyFactorTable = FAMILY_FACTOR_TABLE;

/** For tests only. */
export function _setTableForTest(t: FamilyFactorTable) {
  activeTable = t;
}

export function getFamilyFactor(family: string | null): {
  factor: number;
  source: "family" | "porsche_wide" | "none";
} {
  const { porscheWide, byFamily } = activeTable;
  if (family) {
    const f = byFamily[family];
    if (f && f.soldN >= MIN_SOLD_FOR_FAMILY_FACTOR && f.factor > 0) {
      return { factor: f.factor, source: "family" };
    }
  }
  if (porscheWide.soldN > 0 && porscheWide.factor > 0) {
    return { factor: porscheWide.factor, source: "porsche_wide" };
  }
  return { factor: 1, source: "none" };
}

export function familyFactorMeta() {
  return { generatedAt: activeTable.generatedAt };
}
