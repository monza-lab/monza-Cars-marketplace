import { extractSeries } from "@/lib/brandConfig";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";
import {
  bucketize as bucketizeGeneric,
  summarize as summarizeGeneric,
  loadIndex,
  toCsv as toCsvGeneric,
  type IndexBucket,
  type IndexSummary,
  type IndexPayload,
  type IndexConfig,
} from "./factory";

export type AirCooledSeries = "993" | "964" | "g-model" | "930" | "f-model";

export const AIR_COOLED_SERIES = ["993", "964", "g-model", "930", "f-model"] as const satisfies readonly AirCooledSeries[];

export const AIR_COOLED_SERIES_LABELS: Record<AirCooledSeries, string> = {
  "993": "993 (1995–1998)",
  "964": "964 (1989–1994)",
  "g-model": "G-Body / 911 SC & 3.2 (1974–1989)",
  "930": "930 Turbo (1975–1989)",
  "f-model": "Early 911 (1965–1973)",
};

const SERIES_COLORS: Record<AirCooledSeries, string> = {
  "993": "#d4a017",
  "964": "#c0392b",
  "g-model": "#2c7a7b",
  "930": "#6b46c1",
  "f-model": "#374151",
};

export function classifyAirCooled(record: SoldListingRecord): AirCooledSeries | null {
  const series = extractSeries(record.model, record.year, "Porsche", record.title);
  return (AIR_COOLED_SERIES as readonly string[]).includes(series)
    ? (series as AirCooledSeries)
    : null;
}

export const airCooled911IndexConfig: IndexConfig<AirCooledSeries> = {
  slug: "air-cooled-911",
  name: "MonzaHaus Air-Cooled 911 Index",
  description:
    "Quarterly median sale prices and trend data for air-cooled Porsche 911 models (993, 964, G-Body, 930, early 911), aggregated from public auction results.",
  keywords: [
    "Porsche",
    "Porsche 911",
    "air-cooled",
    "993",
    "964",
    "G-Body",
    "930 Turbo",
    "collector car",
    "market data",
    "auction results",
    "investment grade",
  ],
  make: "Porsche",
  series: AIR_COOLED_SERIES.map((id) => ({
    id,
    label: AIR_COOLED_SERIES_LABELS[id],
    color: SERIES_COLORS[id],
  })),
  classify: classifyAirCooled,
};

// Thin legacy wrappers so existing tests keep working with the same signatures.
export function bucketize(records: SoldListingRecord[]): IndexBucket<AirCooledSeries>[] {
  return bucketizeGeneric(records, classifyAirCooled);
}

export function summarize(
  buckets: IndexBucket<AirCooledSeries>[]
): IndexSummary<AirCooledSeries>[] {
  return summarizeGeneric(buckets, airCooled911IndexConfig.series);
}

export function toCsv(payload: IndexPayload<AirCooledSeries>): string {
  return toCsvGeneric(payload);
}

export function getAirCooled911Index(): Promise<IndexPayload<AirCooledSeries>> {
  return loadIndex(airCooled911IndexConfig);
}

export type { IndexBucket, IndexSummary, IndexPayload };
