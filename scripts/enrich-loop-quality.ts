// scripts/enrich-loop-quality.ts
/**
 * Lightweight quality-gap checker for the enrichment loop.
 * Queries Supabase for fill-rates of key fields per source.
 * Returns which targets are met and which have remaining gaps.
 */
import { createClient } from "@supabase/supabase-js";

export interface QualityTarget {
  source: string;       // "AutoScout24", "ALL", etc.
  field: string;        // column name
  targetPct: number;    // e.g. 90
  label: string;        // display name
}

export interface GapResult {
  target: QualityTarget;
  total: number;
  filled: number;
  fillPct: number;
  remaining: number;
  passed: boolean;
}

export interface QualityCheckResult {
  allPassed: boolean;
  gaps: GapResult[];
  timestamp: string;
}

export const DEFAULT_TARGETS: QualityTarget[] = [
  { source: "AutoScout24", field: "description_text", targetPct: 90, label: "AS24 descriptions" },
  { source: "AutoScout24", field: "trim", targetPct: 90, label: "AS24 trim" },
  { source: "ClassicCom", field: "description_text", targetPct: 90, label: "Classic descriptions" },
  { source: "ClassicCom", field: "mileage", targetPct: 80, label: "Classic mileage" },
  { source: "Elferspot", field: "description_text", targetPct: 90, label: "Elferspot descriptions" },
  { source: "Elferspot", field: "hammer_price", targetPct: 80, label: "Elferspot prices" },
  { source: "BeForward", field: "images", targetPct: 95, label: "BeForward images" },
  { source: "BringATrailer", field: "description_text", targetPct: 90, label: "BaT descriptions" },
  { source: "AutoTrader", field: "description_text", targetPct: 90, label: "AT descriptions" },
  { source: "AutoTrader", field: "images", targetPct: 95, label: "AT images" },
  { source: "ALL", field: "images", targetPct: 95, label: "All images" },
  { source: "ALL", field: "engine", targetPct: 80, label: "All engine" },
  { source: "ALL", field: "transmission", targetPct: 80, label: "All transmission" },
];

/**
 * Count rows where a field is filled vs total, for a given source filter.
 * Only checks active listings (status = 'active').
 */
async function countFillRate(
  sb: ReturnType<typeof createClient>,
  source: string,
  field: string
): Promise<{ total: number; filled: number }> {
  // Get total active count for source
  let totalQuery = sb
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (source !== "ALL") totalQuery = totalQuery.eq("source", source);
  const { count: total } = await totalQuery;

  // Get filled count — depends on field type
  let filledQuery = sb
    .from("listings")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");
  if (source !== "ALL") filledQuery = filledQuery.eq("source", source);

  if (field === "images") {
    // images is TEXT[] (native Postgres array) — empty = "{}"
    filledQuery = filledQuery.not("images", "is", null).neq("images", "{}");
  } else if (["year", "mileage", "hammer_price", "current_bid"].includes(field)) {
    // Numeric fields: just check not null
    filledQuery = filledQuery.not(field, "is", null);
  } else {
    // Text fields: not null and not empty string
    filledQuery = filledQuery.not(field, "is", null).neq(field, "");
  }

  const { count: filled } = await filledQuery;

  return { total: total ?? 0, filled: filled ?? 0 };
}

export async function checkQuality(
  sb: ReturnType<typeof createClient>,
  targets: QualityTarget[] = DEFAULT_TARGETS
): Promise<QualityCheckResult> {
  const gaps: GapResult[] = [];

  for (const target of targets) {
    const { total, filled } = await countFillRate(sb, target.source, target.field);
    const fillPct = total === 0 ? 100 : Math.round((filled / total) * 1000) / 10;
    const remaining = total - filled;
    const passed = fillPct >= target.targetPct;
    gaps.push({ target, total, filled, fillPct, remaining, passed });
  }

  return {
    allPassed: gaps.every((g) => g.passed),
    gaps,
    timestamp: new Date().toISOString(),
  };
}

export function printQualityReport(result: QualityCheckResult): void {
  console.log("\n┌─────────────────────────────────────────────────────────────┐");
  console.log("│                   ENRICHMENT QUALITY CHECK                  │");
  console.log("├──────────────────────┬────────┬────────┬───────┬───────────┤");
  console.log("│ Target               │ Fill % │ Target │  Gap  │  Status   │");
  console.log("├──────────────────────┼────────┼────────┼───────┼───────────┤");

  for (const g of result.gaps) {
    const label = g.target.label.padEnd(20).slice(0, 20);
    const fill = `${g.fillPct.toFixed(1)}%`.padStart(6);
    const tgt = `${g.target.targetPct}%`.padStart(5);
    const gap = String(g.remaining).padStart(5);
    const status = g.passed ? "\x1b[32m  PASS   \x1b[0m" : "\x1b[31m  FAIL   \x1b[0m";
    console.log(`│ ${label} │ ${fill} │  ${tgt} │ ${gap} │${status}│`);
  }

  console.log("├──────────────────────┴────────┴────────┴───────┴───────────┤");
  const overall = result.allPassed
    ? "\x1b[32m ALL TARGETS MET ✓\x1b[0m"
    : "\x1b[33m GAPS REMAINING\x1b[0m";
  console.log(`│ ${overall.padEnd(59)}│`);
  console.log("└─────────────────────────────────────────────────────────────┘");
}
