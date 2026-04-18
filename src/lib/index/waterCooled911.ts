import { extractSeries } from "@/lib/brandConfig";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";
import { loadIndex, type IndexConfig, type IndexPayload } from "./factory";

export type WaterCooledSeries = "996" | "997" | "991" | "992";

export const WATER_COOLED_SERIES = ["996", "997", "991", "992"] as const satisfies readonly WaterCooledSeries[];

export const WATER_COOLED_SERIES_LABELS: Record<WaterCooledSeries, string> = {
  "996": "996 (1998–2005)",
  "997": "997 (2005–2012)",
  "991": "991 (2012–2019)",
  "992": "992 (2019–present)",
};

const SERIES_COLORS: Record<WaterCooledSeries, string> = {
  "996": "#3b82f6",
  "997": "#8b5cf6",
  "991": "#ec4899",
  "992": "#10b981",
};

export function classifyWaterCooled(record: SoldListingRecord): WaterCooledSeries | null {
  const series = extractSeries(record.model, record.year, "Porsche", record.title);
  return (WATER_COOLED_SERIES as readonly string[]).includes(series)
    ? (series as WaterCooledSeries)
    : null;
}

export const waterCooled911IndexConfig: IndexConfig<WaterCooledSeries> = {
  slug: "water-cooled-911",
  name: "MonzaHaus Water-Cooled 911 Index",
  description:
    "Quarterly median sale prices and trend data for water-cooled Porsche 911 generations (996, 997, 991, 992), aggregated from public auction results.",
  keywords: [
    "Porsche",
    "Porsche 911",
    "water-cooled",
    "996",
    "997",
    "991",
    "992",
    "GT3",
    "GT2",
    "Turbo S",
    "collector car",
    "market data",
    "auction results",
  ],
  make: "Porsche",
  series: WATER_COOLED_SERIES.map((id) => ({
    id,
    label: WATER_COOLED_SERIES_LABELS[id],
    color: SERIES_COLORS[id],
  })),
  classify: classifyWaterCooled,
};

export function getWaterCooled911Index(): Promise<IndexPayload<WaterCooledSeries>> {
  return loadIndex(waterCooled911IndexConfig);
}
