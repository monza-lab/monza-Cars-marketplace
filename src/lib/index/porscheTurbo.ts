import { extractSeries } from "@/lib/brandConfig";
import type { SoldListingRecord } from "@/lib/supabaseLiveListings";
import { loadIndex, type IndexConfig, type IndexPayload } from "./factory";

export type TurboSeries =
  | "930-turbo"
  | "964-turbo"
  | "993-turbo"
  | "996-turbo"
  | "997-turbo"
  | "991-turbo"
  | "992-turbo";

export const TURBO_SERIES = [
  "930-turbo",
  "964-turbo",
  "993-turbo",
  "996-turbo",
  "997-turbo",
  "991-turbo",
  "992-turbo",
] as const satisfies readonly TurboSeries[];

export const TURBO_SERIES_LABELS: Record<TurboSeries, string> = {
  "930-turbo": "930 Turbo (1975–1989)",
  "964-turbo": "964 Turbo (1991–1994)",
  "993-turbo": "993 Turbo / Turbo S (1995–1998)",
  "996-turbo": "996 Turbo / Turbo S (2000–2005)",
  "997-turbo": "997 Turbo / Turbo S (2007–2012)",
  "991-turbo": "991 Turbo / Turbo S (2014–2019)",
  "992-turbo": "992 Turbo / Turbo S (2020–present)",
};

const TURBO_COLORS: Record<TurboSeries, string> = {
  "930-turbo": "#b45309",
  "964-turbo": "#c0392b",
  "993-turbo": "#d4a017",
  "996-turbo": "#3b82f6",
  "997-turbo": "#8b5cf6",
  "991-turbo": "#ec4899",
  "992-turbo": "#10b981",
};

const GEN_TO_TURBO: Record<string, TurboSeries> = {
  "930": "930-turbo",
  "964": "964-turbo",
  "993": "993-turbo",
  "996": "996-turbo",
  "997": "997-turbo",
  "991": "991-turbo",
  "992": "992-turbo",
};

/** GT2 / GT3 are Turbo-adjacent racing variants — NOT included in this index. */
const EXCLUDE_TRIM_KEYWORDS = ["gt2", "gt3"];

export function classifyTurbo(record: SoldListingRecord): TurboSeries | null {
  const title = (record.title ?? "").toLowerCase();
  const model = (record.model ?? "").toLowerCase();
  const haystack = `${model} ${title}`;

  if (!haystack.includes("turbo")) return null;
  for (const ex of EXCLUDE_TRIM_KEYWORDS) {
    if (haystack.includes(ex)) return null;
  }

  const gen = extractSeries(record.model, record.year, "Porsche", record.title);
  return GEN_TO_TURBO[gen] ?? null;
}

export const porscheTurboIndexConfig: IndexConfig<TurboSeries> = {
  slug: "porsche-turbo",
  name: "MonzaHaus Porsche Turbo Index",
  description:
    "Quarterly median sale prices for Porsche 911 Turbo across seven generations (930 through 992), aggregated from public auction results.",
  keywords: [
    "Porsche",
    "Porsche Turbo",
    "911 Turbo",
    "930",
    "964 Turbo",
    "993 Turbo",
    "996 Turbo",
    "997 Turbo S",
    "991 Turbo S",
    "992 Turbo S",
    "collector car",
    "market data",
    "auction results",
  ],
  make: "Porsche",
  series: TURBO_SERIES.map((id) => ({
    id,
    label: TURBO_SERIES_LABELS[id],
    color: TURBO_COLORS[id],
  })),
  classify: classifyTurbo,
};

export function getPorscheTurboIndex(): Promise<IndexPayload<TurboSeries>> {
  return loadIndex(porscheTurboIndexConfig);
}
