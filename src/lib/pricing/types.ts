export type CanonicalMarket = "US" | "EU" | "UK" | "JP";

export type ValuationBasis =
  | "sold"            // real transaction
  | "asking_adjusted" // asking price × family factor
  | "asking_raw"      // asking price, no adjustment available
  | "unknown";        // no usable price

export type ConfidenceTier = "high" | "medium" | "low" | "insufficient";

export interface DerivedPrice {
  /** Set only when status='sold' AND source is auction (BaT/ClassicCom/BeForward-sold). */
  soldPriceUsd: number | null;
  /** Set when not sold. Raw asking price in USD (not yet adjusted). */
  askingPriceUsd: number | null;
  /** Which of the three concepts this row represents. */
  basis: "sold" | "asking" | "unknown";
  /** Source-derived market. Never read from raw `region`. */
  canonicalMarket: CanonicalMarket | null;
  /** Family id (e.g. "992", "991"); null when extraction failed. */
  family: string | null;
}

export interface SegmentStats {
  market: CanonicalMarket;
  family: string;
  marketValue: {
    valueUsd: number | null;
    p25Usd: number | null;
    p75Usd: number | null;
    soldN: number;
    tier: ConfidenceTier;
  };
  askMedian: {
    valueUsd: number | null;        // adjusted
    rawMedianUsd: number | null;    // unadjusted (for transparency)
    p25Usd: number | null;
    p75Usd: number | null;
    askingN: number;
    factorApplied: number | null;   // family factor used (null if none)
    factorSource: "family" | "porsche_wide" | "none";
    tier: ConfidenceTier;
  };
}

export interface FamilyFactor {
  family: string;
  factor: number;    // median(sold) / median(asking)
  soldN: number;
  askingN: number;
}

export interface FamilyFactorTable {
  porscheWide: { factor: number; soldN: number; askingN: number };
  byFamily: Record<string, FamilyFactor>;
  generatedAt: string; // ISO timestamp
}
