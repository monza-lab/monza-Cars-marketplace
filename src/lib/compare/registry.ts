import type { ComparisonPage } from "./types";
import { porsche964vs993 } from "./porsche964vs993";
import { porsche993vs996 } from "./porsche993vs996";
import { porsche996vs997 } from "./porsche996vs997";
import { porsche997vs991 } from "./porsche997vs991";
import { porsche991vs992 } from "./porsche991vs992";

// Additional comparisons are added here as parallel agents produce them.
export const COMPARISONS: ComparisonPage[] = [porsche964vs993, porsche993vs996, porsche996vs997, porsche997vs991, porsche991vs992];

export function getComparison(slug: string): ComparisonPage | null {
  return COMPARISONS.find((c) => c.slug === slug) ?? null;
}

export function listComparisonSlugs(): string[] {
  return COMPARISONS.map((c) => c.slug);
}
