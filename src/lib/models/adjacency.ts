import type { PorscheModelPage } from "./types";
import { COMPARISONS } from "@/lib/compare/registry";

/** Chronological order of the 911 generations we cover */
const CHRONOLOGY: PorscheModelPage["slug"][] = ["964", "993", "996", "997", "991", "992"];

export interface ModelAdjacency {
  prev: PorscheModelPage["slug"] | null;
  next: PorscheModelPage["slug"] | null;
  comparisonPrev: string | null;
  comparisonNext: string | null;
}

export function getModelAdjacency(slug: PorscheModelPage["slug"]): ModelAdjacency {
  const i = CHRONOLOGY.indexOf(slug);
  const prev = i > 0 ? CHRONOLOGY[i - 1] : null;
  const next = i >= 0 && i < CHRONOLOGY.length - 1 ? CHRONOLOGY[i + 1] : null;

  const comparisonPrev = prev
    ? COMPARISONS.find(
        (c) => c.leftModelSlug === prev && c.rightModelSlug === slug
      )?.slug ?? null
    : null;
  const comparisonNext = next
    ? COMPARISONS.find(
        (c) => c.leftModelSlug === slug && c.rightModelSlug === next
      )?.slug ?? null
    : null;

  return { prev, next, comparisonPrev, comparisonNext };
}
