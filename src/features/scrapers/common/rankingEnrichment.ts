import { resolveHomepageVariant } from "@/lib/homepageRanking";

export type RankingVariantInput = {
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  title?: string | null;
};

export function computeRankingVariant(input: RankingVariantInput): string {
  const identity = resolveHomepageVariant({
    year: input.year,
    make: input.make,
    model: input.model,
    trim: input.trim ?? null,
    title: input.title ?? `${input.year} ${input.make} ${input.model}`,
  });
  return `${identity.series}:${identity.variant ?? "__other"}`;
}
