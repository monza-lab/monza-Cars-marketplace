import type { PorscheVariantPage } from "./types";
import { porsche964rs } from "./porsche964rs";
import { porsche964turbo36 } from "./porsche964turbo36";
import { porsche993rs } from "./porsche993rs";
import { porsche993turboS } from "./porsche993turboS";
import { porsche996gt3rs } from "./porsche996gt3rs";
import { porsche997gt3rs40 } from "./porsche997gt3rs40";
import { porsche991gt2rs } from "./porsche991gt2rs";
import { porsche911r } from "./porsche911r";
import { porsche992sportclassic } from "./porsche992sportclassic";

// Additional variants are added here as parallel agents produce them.
export const PORSCHE_VARIANTS: PorscheVariantPage[] = [
  porsche964rs,
  porsche964turbo36,
  porsche993rs,
  porsche993turboS,
  porsche996gt3rs,
  porsche997gt3rs40,
  porsche991gt2rs,
  porsche911r,
  porsche992sportclassic,
];

export function getPorscheVariant(slug: string): PorscheVariantPage | null {
  return PORSCHE_VARIANTS.find((v) => v.slug === slug) ?? null;
}

export function listPorscheVariantSlugs(): string[] {
  return PORSCHE_VARIANTS.map((v) => v.slug);
}

export function getVariantsForModel(modelSlug: string): PorscheVariantPage[] {
  return PORSCHE_VARIANTS.filter((v) => v.parentModelSlug === modelSlug);
}
