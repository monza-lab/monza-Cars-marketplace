import type { ConfidenceTier } from "./types";

export const SOLD_THRESHOLDS = { high: 20, medium: 8, low: 1 } as const;
export const ASKING_THRESHOLDS = { high: 200, medium: 50, low: 1 } as const;

export function classifySoldTier(soldN: number): ConfidenceTier {
  if (soldN >= SOLD_THRESHOLDS.high) return "high";
  if (soldN >= SOLD_THRESHOLDS.medium) return "medium";
  if (soldN >= SOLD_THRESHOLDS.low) return "low";
  return "insufficient";
}

export function classifyAskingTier(
  askingN: number,
  factorSource: "family" | "porsche_wide" | "none",
): ConfidenceTier {
  if (askingN === 0) return "insufficient";
  if (askingN >= ASKING_THRESHOLDS.high && factorSource === "family") return "high";
  if (askingN >= ASKING_THRESHOLDS.medium && factorSource === "family") return "medium";
  if (factorSource === "porsche_wide") return "medium";
  return "low";
}
