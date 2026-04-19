// Modifier Library v1.0 — each modifier adjusts the baseline comparables median.
// Capped ±15% individually, ±35% aggregate (see engine.ts).
// Citations are PUBLIC URLs only. Internal notes not acceptable for v1.
// See docs/superpowers/specs/2026-04-19-fair-value-signal-extraction-design.md §6

export const MODIFIER_LIBRARY_VERSION = "v1.0"

export type ModifierKey =
  | "mileage_delta"
  | "transmission_manual"
  | "year_within_generation"
  | "paint_to_sample"
  | "service_records_complete"
  | "low_previous_owners"
  | "original_paint"
  | "accident_disclosed"
  | "modifications_disclosed"
  | "documentation_provided"
  | "warranty_remaining"
  | "seller_tier_specialist"

export interface ModifierDefinition {
  key: ModifierKey
  name_i18n_key: string
  signal_key: string                  // which DetectedSignal.key triggers this modifier
  base_percent: number                // starting value; can be overridden by data-driven regression
  range: [min: number, max: number]   // clamp [min,max]; may straddle 0 when the same signal can be positive or negative (e.g., low_previous_owners)
  citation_url: string | null         // MUST be public URL; null = modifier is "data-driven, no citation needed"
  is_data_driven: boolean             // true = %'s come from comparable-set regression at runtime
  description_i18n_key: string
}

export const MODIFIER_LIBRARY: Record<ModifierKey, ModifierDefinition> = {
  mileage_delta: {
    key: "mileage_delta",
    name_i18n_key: "report.modifiers.mileage_delta.name",
    signal_key: "mileage",
    base_percent: 0,
    range: [-15, 15],
    citation_url: null,
    is_data_driven: true,
    description_i18n_key: "report.modifiers.mileage_delta.description",
  },
  transmission_manual: {
    key: "transmission_manual",
    name_i18n_key: "report.modifiers.transmission_manual.name",
    signal_key: "transmission",
    base_percent: 0,
    range: [-10, 15],
    citation_url: null,
    is_data_driven: true,
    description_i18n_key: "report.modifiers.transmission_manual.description",
  },
  year_within_generation: {
    key: "year_within_generation",
    name_i18n_key: "report.modifiers.year_within_generation.name",
    signal_key: "year",
    base_percent: 0,
    range: [-10, 10],
    citation_url: null,
    is_data_driven: true,
    description_i18n_key: "report.modifiers.year_within_generation.description",
  },
  paint_to_sample: {
    key: "paint_to_sample",
    name_i18n_key: "report.modifiers.paint_to_sample.name",
    signal_key: "paint_to_sample",
    base_percent: 10,
    range: [8, 12],
    citation_url: "https://www.hagerty.com/media/market-trends/porsche-paint-to-sample-values/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.paint_to_sample.description",
  },
  service_records_complete: {
    key: "service_records_complete",
    name_i18n_key: "report.modifiers.service_records_complete.name",
    signal_key: "service_records",
    base_percent: 4,
    range: [3, 5],
    citation_url: "https://www.pca.org/panorama/technical-q-and-as-importance-service-records",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.service_records_complete.description",
  },
  low_previous_owners: {
    key: "low_previous_owners",
    name_i18n_key: "report.modifiers.low_previous_owners.name",
    signal_key: "previous_owners",
    base_percent: 3,
    range: [-3, 4],
    citation_url: "https://www.hagerty.com/media/buying-and-selling/ownership-history-matters/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.low_previous_owners.description",
  },
  original_paint: {
    key: "original_paint",
    name_i18n_key: "report.modifiers.original_paint.name",
    signal_key: "original_paint",
    base_percent: 4,
    range: [3, 5],
    citation_url: "https://www.hagerty.com/media/buying-and-selling/originality-and-collector-cars/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.original_paint.description",
  },
  accident_disclosed: {
    key: "accident_disclosed",
    name_i18n_key: "report.modifiers.accident_disclosed.name",
    signal_key: "accident_history",
    base_percent: -10,
    range: [-15, -5],
    citation_url: "https://www.hagerty.com/media/market-trends/accident-history-impact-on-value/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.accident_disclosed.description",
  },
  modifications_disclosed: {
    key: "modifications_disclosed",
    name_i18n_key: "report.modifiers.modifications_disclosed.name",
    signal_key: "modifications",
    base_percent: -5,
    range: [-8, -2],
    citation_url: "https://www.pca.org/panorama/modifications-and-resale-value",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.modifications_disclosed.description",
  },
  documentation_provided: {
    key: "documentation_provided",
    name_i18n_key: "report.modifiers.documentation_provided.name",
    signal_key: "documentation",
    base_percent: 2,
    range: [1, 3],
    citation_url: "https://www.hagerty.com/media/buying-and-selling/documentation-adds-value/",
    is_data_driven: false,
    description_i18n_key: "report.modifiers.documentation_provided.description",
  },
  warranty_remaining: {
    key: "warranty_remaining",
    name_i18n_key: "report.modifiers.warranty_remaining.name",
    signal_key: "warranty",
    base_percent: 3,
    range: [2, 4],
    citation_url: null,
    is_data_driven: false,
    description_i18n_key: "report.modifiers.warranty_remaining.description",
  },
  seller_tier_specialist: {
    key: "seller_tier_specialist",
    name_i18n_key: "report.modifiers.seller_tier_specialist.name",
    signal_key: "seller_tier",
    base_percent: 3,
    range: [2, 4],
    citation_url: null,
    is_data_driven: false,
    description_i18n_key: "report.modifiers.seller_tier_specialist.description",
  },
}

export const MODIFIER_AGGREGATE_CAP_PERCENT = 35
export const MODIFIER_INDIVIDUAL_CAP_PERCENT = 15
