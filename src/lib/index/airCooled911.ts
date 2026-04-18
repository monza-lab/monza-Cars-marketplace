import { extractSeries } from "@/lib/brandConfig";
import { fetchSoldListingsForMake, type SoldListingRecord } from "@/lib/supabaseLiveListings";

export const AIR_COOLED_SERIES = ["993", "964", "g-body", "930", "early-911"] as const;
export type AirCooledSeries = (typeof AIR_COOLED_SERIES)[number];

export const AIR_COOLED_SERIES_LABELS: Record<AirCooledSeries, string> = {
  "993": "993 (1995–1998)",
  "964": "964 (1989–1994)",
  "g-body": "G-Body / 911 SC & 3.2 (1974–1989)",
  "930": "930 Turbo (1975–1989)",
  "early-911": "Early 911 (1965–1973)",
};

export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`;

export interface IndexBucket {
  quarter: QuarterKey;
  year: number;
  quarterNum: 1 | 2 | 3 | 4;
  series: AirCooledSeries;
  median: number;
  mean: number;
  count: number;
  min: number;
  max: number;
}

export interface IndexSummary {
  series: AirCooledSeries;
  label: string;
  latestMedian: number | null;
  latestCount: number;
  yoyChangePct: number | null;
  fiveYearChangePct: number | null;
  sampleSize: number;
}

function isAirCooled(series: string): series is AirCooledSeries {
  return (AIR_COOLED_SERIES as readonly string[]).includes(series);
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function toQuarter(dateIso: string): { year: number; quarterNum: 1 | 2 | 3 | 4; key: QuarterKey } | null {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const q = (Math.floor(d.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return { year, quarterNum: q, key: `${year}-Q${q}` };
}

export function classifyAirCooled(record: SoldListingRecord): AirCooledSeries | null {
  const series = extractSeries(record.model, record.year, "Porsche", record.title);
  return isAirCooled(series) ? series : null;
}

export function bucketize(records: SoldListingRecord[]): IndexBucket[] {
  const groups = new Map<string, { year: number; quarterNum: 1 | 2 | 3 | 4; series: AirCooledSeries; prices: number[] }>();

  for (const r of records) {
    if (r.price <= 0) continue;
    const series = classifyAirCooled(r);
    if (!series) continue;
    const q = toQuarter(r.date);
    if (!q) continue;
    const key = `${q.key}|${series}`;
    const existing = groups.get(key);
    if (existing) {
      existing.prices.push(r.price);
    } else {
      groups.set(key, { year: q.year, quarterNum: q.quarterNum, series, prices: [r.price] });
    }
  }

  const buckets: IndexBucket[] = [];
  for (const [_key, g] of groups) {
    buckets.push({
      quarter: `${g.year}-Q${g.quarterNum}`,
      year: g.year,
      quarterNum: g.quarterNum,
      series: g.series,
      median: median(g.prices),
      mean: g.prices.reduce((a, b) => a + b, 0) / g.prices.length,
      count: g.prices.length,
      min: Math.min(...g.prices),
      max: Math.max(...g.prices),
    });
  }

  buckets.sort((a, b) =>
    a.year !== b.year
      ? a.year - b.year
      : a.quarterNum !== b.quarterNum
        ? a.quarterNum - b.quarterNum
        : a.series.localeCompare(b.series)
  );
  return buckets;
}

export function summarize(buckets: IndexBucket[]): IndexSummary[] {
  const bySeries = new Map<AirCooledSeries, IndexBucket[]>();
  for (const b of buckets) {
    const arr = bySeries.get(b.series) ?? [];
    arr.push(b);
    bySeries.set(b.series, arr);
  }

  const summaries: IndexSummary[] = [];
  for (const s of AIR_COOLED_SERIES) {
    const arr = bySeries.get(s) ?? [];
    if (arr.length === 0) {
      summaries.push({
        series: s,
        label: AIR_COOLED_SERIES_LABELS[s],
        latestMedian: null,
        latestCount: 0,
        yoyChangePct: null,
        fiveYearChangePct: null,
        sampleSize: 0,
      });
      continue;
    }
    const sorted = [...arr].sort((a, b) =>
      a.year !== b.year ? a.year - b.year : a.quarterNum - b.quarterNum
    );
    const latest = sorted[sorted.length - 1];
    const yearAgo = sorted.find(
      (b) => b.year === latest.year - 1 && b.quarterNum === latest.quarterNum
    );
    const fiveYearAgo = sorted.find(
      (b) => b.year === latest.year - 5 && b.quarterNum === latest.quarterNum
    );
    const sampleSize = sorted.reduce((acc, b) => acc + b.count, 0);

    summaries.push({
      series: s,
      label: AIR_COOLED_SERIES_LABELS[s],
      latestMedian: latest.median,
      latestCount: latest.count,
      yoyChangePct: yearAgo
        ? ((latest.median - yearAgo.median) / yearAgo.median) * 100
        : null,
      fiveYearChangePct: fiveYearAgo
        ? ((latest.median - fiveYearAgo.median) / fiveYearAgo.median) * 100
        : null,
      sampleSize,
    });
  }
  return summaries;
}

export interface IndexPayload {
  generatedAt: string;
  sampleSize: number;
  buckets: IndexBucket[];
  summaries: IndexSummary[];
}

export async function getAirCooled911Index(): Promise<IndexPayload> {
  const records = await fetchSoldListingsForMake("Porsche", 5000);
  const buckets = bucketize(records);
  const summaries = summarize(buckets);
  return {
    generatedAt: new Date().toISOString(),
    sampleSize: buckets.reduce((acc, b) => acc + b.count, 0),
    buckets,
    summaries,
  };
}

export function toCsv(payload: IndexPayload): string {
  const header = "quarter,series,median,mean,count,min,max";
  const rows = payload.buckets.map(
    (b) => `${b.quarter},${b.series},${b.median.toFixed(2)},${b.mean.toFixed(2)},${b.count},${b.min},${b.max}`
  );
  return [header, ...rows].join("\n");
}
