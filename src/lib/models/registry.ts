import type { PorscheModelPage } from "./types";
import { porsche964 } from "./porsche964";
import { porsche991 } from "./porsche991";
import { porsche992 } from "./porsche992";
import { porsche993 } from "./porsche993";
import { porsche996 } from "./porsche996";
import { porsche997 } from "./porsche997";

// Later imports will be added as parallel agents produce each model config.
// Kept centralized so the route, sitemap, and hub listings all read from one source.
// Sorted by slug (numerical ascending).
export const PORSCHE_MODELS: PorscheModelPage[] = [porsche964, porsche991, porsche992, porsche993, porsche996, porsche997];

export function getPorscheModel(slug: string): PorscheModelPage | null {
  return PORSCHE_MODELS.find((m) => m.slug === slug) ?? null;
}

export function listPorscheModelSlugs(): string[] {
  return PORSCHE_MODELS.map((m) => m.slug);
}
