/**
 * Data-quality audit across all scrapers/marketplaces.
 * Computes a fill-rate matrix (0–100%) per source × field, plus an
 * overall weighted "quality score" per source and grand totals.
 *
 * Usage:  npx tsx scripts/data-quality-audit.ts
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnv(file: string) {
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (process.env[k] !== undefined) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv(path.resolve(process.cwd(), ".env.local"));
loadEnv(path.resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
if (!url || !key) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}
const sb = createClient(url, key, { auth: { persistSession: false } });

// Fields to assess on listings. Weight reflects importance for marketplace UX.
const FIELDS: { col: string; label: string; weight: number; nonEmpty?: boolean }[] = [
  { col: "year", label: "year", weight: 2 },
  { col: "make", label: "make", weight: 2 },
  { col: "model", label: "model", weight: 2 },
  { col: "trim", label: "trim", weight: 1 },
  { col: "title", label: "title", weight: 1, nonEmpty: true },
  { col: "mileage", label: "mileage", weight: 2 },
  { col: "vin", label: "VIN", weight: 2, nonEmpty: true },
  { col: "color_exterior", label: "color_ext", weight: 1, nonEmpty: true },
  { col: "color_interior", label: "color_int", weight: 1, nonEmpty: true },
  { col: "engine", label: "engine", weight: 1, nonEmpty: true },
  { col: "transmission", label: "transmission", weight: 1, nonEmpty: true },
  { col: "body_style", label: "body", weight: 1, nonEmpty: true },
  { col: "description_text", label: "description", weight: 1, nonEmpty: true },
  { col: "location", label: "location", weight: 1, nonEmpty: true },
  { col: "country", label: "country", weight: 1, nonEmpty: true },
  { col: "hammer_price", label: "hammer/sold", weight: 2 },
  { col: "current_bid", label: "current_bid", weight: 1 },
  { col: "original_currency", label: "currency", weight: 1, nonEmpty: true },
  { col: "images", label: "images[]", weight: 2 }, // array non-empty
  { col: "source_url", label: "source_url", weight: 1, nonEmpty: true },
  { col: "end_time", label: "end_time", weight: 1 },
];

type Row = Record<string, unknown>;

async function fetchAll(): Promise<Row[]> {
  const out: Row[] = [];
  const selectCols = ["id", "source", "status", ...FIELDS.map((f) => f.col)].join(",");
  const page = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await sb
      .from("listings")
      .select(selectCols)
      .range(from, from + page - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    out.push(...(data as Row[]));
    if (data.length < page) break;
    from += page;
    process.stderr.write(`\rfetched ${out.length}…`);
  }
  process.stderr.write(`\rfetched ${out.length} rows total\n`);
  return out;
}

function isFilled(val: unknown, field: (typeof FIELDS)[number]): boolean {
  if (val === null || val === undefined) return false;
  if (Array.isArray(val)) return val.length > 0;
  if (typeof val === "string") return field.nonEmpty ? val.trim().length > 0 : true;
  if (typeof val === "number") return Number.isFinite(val);
  return true;
}

function pct(n: number, d: number): number {
  return d === 0 ? 0 : Math.round((n / d) * 1000) / 10;
}

function colorPct(p: number): string {
  // ANSI color: red <40, yellow <75, green ≥75
  const s = `${p.toFixed(1).padStart(5)}%`;
  if (p >= 75) return `\x1b[32m${s}\x1b[0m`;
  if (p >= 40) return `\x1b[33m${s}\x1b[0m`;
  return `\x1b[31m${s}\x1b[0m`;
}

(async () => {
  const rows = await fetchAll();

  // Group by source (scraper). Also compute "ALL".
  const groups = new Map<string, Row[]>();
  for (const r of rows) {
    const src = (r.source as string) || "(unknown)";
    if (!groups.has(src)) groups.set(src, []);
    groups.get(src)!.push(r);
  }
  const sources = [...groups.keys()].sort();

  // Compute fill matrix: source → field → pct
  type SrcStat = { count: number; fills: Record<string, number>; score: number };
  const stats: Record<string, SrcStat> = {};
  const addStat = (src: string, list: Row[]) => {
    const s: SrcStat = { count: list.length, fills: {}, score: 0 };
    let wSum = 0;
    let wFilled = 0;
    for (const f of FIELDS) {
      let n = 0;
      for (const r of list) if (isFilled(r[f.col], f)) n++;
      const p = pct(n, list.length);
      s.fills[f.label] = p;
      wSum += f.weight * 100;
      wFilled += f.weight * p;
    }
    s.score = Math.round((wFilled / wSum) * 10) / 10;
    stats[src] = s;
  };
  for (const src of sources) addStat(src, groups.get(src)!);
  addStat("ALL", rows);

  // Print table: rows = fields, columns = sources
  const cols = [...sources, "ALL"];
  const FIELD_W = 15;
  const COL_W = 11;

  const pad = (s: string, w: number) => s.length >= w ? s.slice(0, w) : s + " ".repeat(w - s.length);

  // Header: counts
  console.log("");
  console.log("DATA QUALITY MATRIX — listings table");
  console.log("=".repeat(FIELD_W + cols.length * COL_W));
  console.log(pad("source →", FIELD_W) + cols.map((c) => pad(c.slice(0, COL_W - 1), COL_W)).join(""));
  console.log(pad("count", FIELD_W) + cols.map((c) => pad(String(stats[c].count), COL_W)).join(""));
  console.log("-".repeat(FIELD_W + cols.length * COL_W));

  for (const f of FIELDS) {
    const cells = cols.map((c) => {
      const p = stats[c].fills[f.label] ?? 0;
      // pad color-free then replace with colored
      const plain = `${p.toFixed(1)}%`.padStart(6);
      const colored = colorPct(p);
      return colored + " ".repeat(Math.max(0, COL_W - plain.length));
    });
    console.log(pad(`${f.label}(w${f.weight})`, FIELD_W) + cells.join(""));
  }

  console.log("-".repeat(FIELD_W + cols.length * COL_W));
  console.log(
    pad("QUALITY SCORE", FIELD_W) +
      cols
        .map((c) => {
          const s = stats[c].score;
          return colorPct(s) + " ".repeat(Math.max(0, COL_W - 7));
        })
        .join("")
  );
  console.log("=".repeat(FIELD_W + cols.length * COL_W));
  console.log("Score = weighted mean of fill-rates; weights per field shown as w1/w2.");
  console.log(`Total rows: ${rows.length}   Sources: ${sources.length}`);
})();
