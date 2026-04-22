import type { VariantDetails } from "./types"

/**
 * Variant corpus — keyed by "<seriesId>/<variantId>".
 *
 * Currently empty: variant detail authoring is a content pipeline tracked in
 * spec §13 of the advisor plan. The `get_variant_details` tool uses
 * `getVariantFromCorpus` and surfaces a "not yet in corpus" error when the
 * key is missing.
 */
export const variantCorpus: Record<string, VariantDetails> = {}

export * from "./types"

export function getVariantFromCorpus(
  seriesId: string,
  variantId: string,
): VariantDetails | null {
  return variantCorpus[`${seriesId}/${variantId}`] ?? null
}
