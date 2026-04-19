import { extractSeries } from "@/lib/brandConfig";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";
import { loadIndex, type IndexConfig, type IndexPayload } from "./factory";

export type GtSeries =
  | "964-rs"
  | "993-rs"
  | "996-gt3"
  | "997-gt3"
  | "991-gt3"
  | "992-gt3"
  | "996-gt2"
  | "997-gt2"
  | "991-gt2"
  | "718-gt4";

export const GT_SERIES = [
  "964-rs",
  "993-rs",
  "996-gt3",
  "997-gt3",
  "991-gt3",
  "992-gt3",
  "996-gt2",
  "997-gt2",
  "991-gt2",
  "718-gt4",
] as const satisfies readonly GtSeries[];

export const GT_SERIES_LABELS: Record<GtSeries, string> = {
  "964-rs": "964 RS (1992–1993)",
  "993-rs": "993 RS (1995–1996)",
  "996-gt3": "996 GT3 / GT3 RS (1999–2005)",
  "997-gt3": "997 GT3 / GT3 RS / RS 4.0 (2006–2012)",
  "991-gt3": "991 GT3 / GT3 RS / R (2013–2019)",
  "992-gt3": "992 GT3 / GT3 RS / RS (2021–present)",
  "996-gt2": "996 GT2 (2002–2005)",
  "997-gt2": "997 GT2 / GT2 RS (2007–2012)",
  "991-gt2": "991 GT2 RS (2017–2019)",
  "718-gt4": "718 Cayman GT4 / GT4 RS (2016–present)",
};

const SERIES_COLORS: Record<GtSeries, string> = {
  "964-rs": "#7c1d1d",
  "993-rs": "#a16207",
  "996-gt3": "#1d4ed8",
  "997-gt3": "#6d28d9",
  "991-gt3": "#be185d",
  "992-gt3": "#047857",
  "996-gt2": "#111827",
  "997-gt2": "#1f2937",
  "991-gt2": "#374151",
  "718-gt4": "#0e7490",
};

function containsAny(hay: string, tokens: string[]): boolean {
  return tokens.some((t) => hay.includes(t));
}

export function classifyGt(record: SoldListingRecord): GtSeries | null {
  const title = (record.title ?? "").toLowerCase();
  const model = (record.model ?? "").toLowerCase();
  const haystack = `${model} ${title}`;

  const isGt2 = containsAny(haystack, ["gt2"]);
  const isGt3 = containsAny(haystack, ["gt3"]);
  const isGt4 = containsAny(haystack, ["gt4"]);
  const isRs = containsAny(haystack, [" rs ", " rs\n", " rs.", "rs america"]) || /\brs\b/.test(haystack);

  if (!isGt2 && !isGt3 && !isGt4 && !isRs) return null;

  if (isGt4) return "718-gt4";

  const gen = extractSeries(record.model, record.year, "Porsche", record.title);

  if (isGt2) {
    if (gen === "996") return "996-gt2";
    if (gen === "997") return "997-gt2";
    if (gen === "991") return "991-gt2";
    return null;
  }

  if (isGt3) {
    if (gen === "996") return "996-gt3";
    if (gen === "997") return "997-gt3";
    if (gen === "991") return "991-gt3";
    if (gen === "992") return "992-gt3";
    return null;
  }

  // Pure RS (non-GT3/GT2) — only air-cooled RS models
  if (isRs) {
    if (gen === "964") return "964-rs";
    if (gen === "993") return "993-rs";
    return null;
  }

  return null;
}

export const porscheGtIndexConfig: IndexConfig<GtSeries> = {
  slug: "porsche-gt",
  name: "MonzaHaus Porsche GT Index",
  description:
    "Quarterly median sale prices for the Porsche GT lineage — GT2, GT3, GT3 RS, GT4, and pre-GT air-cooled RS variants — aggregated from public auction results.",
  keywords: [
    "Porsche GT3",
    "Porsche GT3 RS",
    "Porsche GT2 RS",
    "Porsche GT4",
    "Cayman GT4",
    "964 RS",
    "993 RS",
    "GT3 RS 4.0",
    "Mezger engine",
    "collector car",
    "market data",
    "Porsche investment",
  ],
  make: "Porsche",
  series: GT_SERIES.map((id) => ({
    id,
    label: GT_SERIES_LABELS[id],
    color: SERIES_COLORS[id],
  })),
  classify: classifyGt,
};

export function getPorscheGtIndex(): Promise<IndexPayload<GtSeries>> {
  return loadIndex(porscheGtIndexConfig);
}
