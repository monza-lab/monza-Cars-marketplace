import { fetchSoldListingsForMake, type SoldListingRecord } from "@/lib/supabaseLiveListings";

export interface IndexSeriesDef<ID extends string> {
  id: ID;
  label: string;
  color: string;
}

export interface IndexConfig<ID extends string> {
  /** URL slug, e.g. "air-cooled-911" */
  slug: string;
  /** Dataset display name */
  name: string;
  /** Short description for meta tags and Dataset schema */
  description: string;
  /** Keywords for Dataset schema */
  keywords: string[];
  /** Make used when querying sold history */
  make: string;
  /** Optional limit on records fetched */
  sampleLimit?: number;
  /** Ordered series definitions */
  series: readonly IndexSeriesDef<ID>[];
  /** Classifies a listing to a series ID, or null to skip */
  classify: (record: SoldListingRecord) => ID | null;
}

export type QuarterKey = `${number}-Q${1 | 2 | 3 | 4}`;

export interface IndexBucket<ID extends string> {
  quarter: QuarterKey;
  year: number;
  quarterNum: 1 | 2 | 3 | 4;
  series: ID;
  median: number;
  mean: number;
  count: number;
  min: number;
  max: number;
}

export interface IndexSummary<ID extends string> {
  series: ID;
  label: string;
  latestMedian: number | null;
  latestCount: number;
  yoyChangePct: number | null;
  fiveYearChangePct: number | null;
  sampleSize: number;
}

export interface IndexPayload<ID extends string> {
  generatedAt: string;
  sampleSize: number;
  buckets: IndexBucket<ID>[];
  summaries: IndexSummary<ID>[];
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function toQuarter(dateIso: string): { year: number; quarterNum: 1 | 2 | 3 | 4; key: QuarterKey } | null {
  const d = new Date(dateIso);
  if (Number.isNaN(d.getTime())) return null;
  const year = d.getUTCFullYear();
  const q = (Math.floor(d.getUTCMonth() / 3) + 1) as 1 | 2 | 3 | 4;
  return { year, quarterNum: q, key: `${year}-Q${q}` };
}

export function bucketize<ID extends string>(
  records: SoldListingRecord[],
  classify: (r: SoldListingRecord) => ID | null
): IndexBucket<ID>[] {
  const groups = new Map<string, { year: number; quarterNum: 1 | 2 | 3 | 4; series: ID; prices: number[] }>();

  for (const r of records) {
    if (r.price <= 0) continue;
    const series = classify(r);
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

  const buckets: IndexBucket<ID>[] = [];
  for (const [, g] of groups) {
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

export function summarize<ID extends string>(
  buckets: IndexBucket<ID>[],
  seriesDefs: readonly IndexSeriesDef<ID>[]
): IndexSummary<ID>[] {
  const bySeries = new Map<ID, IndexBucket<ID>[]>();
  for (const b of buckets) {
    const arr = bySeries.get(b.series) ?? [];
    arr.push(b);
    bySeries.set(b.series, arr);
  }

  const summaries: IndexSummary<ID>[] = [];
  for (const def of seriesDefs) {
    const arr = bySeries.get(def.id) ?? [];
    if (arr.length === 0) {
      summaries.push({
        series: def.id,
        label: def.label,
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
      series: def.id,
      label: def.label,
      latestMedian: latest.median,
      latestCount: latest.count,
      yoyChangePct: yearAgo ? ((latest.median - yearAgo.median) / yearAgo.median) * 100 : null,
      fiveYearChangePct: fiveYearAgo
        ? ((latest.median - fiveYearAgo.median) / fiveYearAgo.median) * 100
        : null,
      sampleSize,
    });
  }
  return summaries;
}

export async function loadIndex<ID extends string>(
  config: IndexConfig<ID>
): Promise<IndexPayload<ID>> {
  const records = await fetchSoldListingsForMake(config.make, config.sampleLimit ?? 5000);
  const buckets = bucketize(records, config.classify);
  const summaries = summarize(buckets, config.series);
  return {
    generatedAt: new Date().toISOString(),
    sampleSize: buckets.reduce((acc, b) => acc + b.count, 0),
    buckets,
    summaries,
  };
}

export function toCsv<ID extends string>(payload: IndexPayload<ID>): string {
  const header = "quarter,series,median,mean,count,min,max";
  const rows = payload.buckets.map(
    (b) =>
      `${b.quarter},${b.series},${b.median.toFixed(2)},${b.mean.toFixed(2)},${b.count},${b.min},${b.max}`
  );
  return [header, ...rows].join("\n");
}
