import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { Client } from "pg";

import { loadDotEnv } from "./backfill-listing-rarity";
import { scoreListingRarity } from "../src/lib/listingRarity";
import {
  buildHomepageRankingContext,
  rankHomepageListings,
  type HomepageRankingListing,
} from "../src/lib/homepageRanking";

export const COMPARISON_CUTOFF = "2026-07-13T19:00:12.204Z";
const REPORT_PATH = resolve(process.cwd(), "docs/rarity-ranking-top-50-2026-07-13.md");

type DatabaseListing = {
  id: string;
  year: number | null;
  make: string | null;
  model: string | null;
  trim: string | null;
  title: string | null;
  vin: string | null;
  mileage: number | null;
  mileage_unit: string | null;
  color_exterior: string | null;
  description_text: string | null;
  seller_notes: string | null;
  images: string[] | null;
  end_time: Date | string | null;
  source: string | null;
  source_url: string | null;
  rarity_score: number | null;
  rarity_signals_json: string[] | null;
};

type ComparisonListing = HomepageRankingListing & {
  source: string;
  sourceUrl: string | null;
  legacyScore: number;
  legacySignals: string[];
  newSignals: string[];
};

function endTimeValue(value: string | Date | null): number {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const timestamp = new Date(value).getTime();
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

function escapeCell(value: unknown): string {
  return String(value ?? "")
    .replace(/\|/g, "\\|")
    .replace(/[\r\n]+/g, " ")
    .trim();
}

function carLabel(listing: ComparisonListing): string {
  const label = escapeCell(listing.title || `${listing.year} ${listing.make} ${listing.model}`);
  if (!listing.sourceUrl) return label;
  return `[${label}](${listing.sourceUrl.replace(/\)/g, "%29")})`;
}

function sourceLabel(listing: ComparisonListing): string {
  return escapeCell(listing.source || "unknown");
}

function mapListing(row: DatabaseListing): ComparisonListing {
  const rarity = scoreListingRarity({
    year: row.year,
    model: row.model,
    trim: row.trim,
    title: row.title,
    descriptionText: row.description_text,
    sellerNotes: row.seller_notes,
    mileage: row.mileage,
    mileageUnit: row.mileage_unit,
  });

  return {
    id: row.id,
    year: row.year ?? 0,
    make: row.make ?? "Porsche",
    model: row.model ?? "Unknown",
    trim: row.trim,
    title: row.title ?? `${row.year ?? ""} Porsche ${row.model ?? "Unknown"}`.trim(),
    vin: row.vin,
    mileage: row.mileage,
    exteriorColor: row.color_exterior,
    rarityScore: rarity.score,
    raritySignals: rarity.signals,
    images: Array.isArray(row.images) ? row.images : [],
    endTime: row.end_time,
    source: row.source ?? "unknown",
    sourceUrl: row.source_url,
    legacyScore: row.rarity_score ?? 0,
    legacySignals: Array.isArray(row.rarity_signals_json) ? row.rarity_signals_json : [],
    newSignals: rarity.signals,
  };
}

function compareLegacy(a: ComparisonListing, b: ComparisonListing): number {
  if (a.legacyScore !== b.legacyScore) return b.legacyScore - a.legacyScore;
  const timeDelta = endTimeValue(a.endTime ?? null) - endTimeValue(b.endTime ?? null);
  if (timeDelta !== 0) return timeDelta;
  return b.id.localeCompare(a.id);
}

export function buildComparisonReport(rows: readonly DatabaseListing[]): string {
  const listings = rows.map(mapListing);
  const legacyRanked = [...listings].sort(compareLegacy);
  const legacyRankById = new Map(legacyRanked.map((listing, index) => [listing.id, index + 1]));
  const rankingContext = buildHomepageRankingContext(listings);
  const newRanked = rankHomepageListings(listings, rankingContext, { limit: 50 });
  const newRankById = new Map(newRanked.map((row, index) => [row.listing.id, index + 1]));
  const legacyTop = legacyRanked.slice(0, 50);
  const legacyTopIds = new Set(legacyTop.map((listing) => listing.id));
  const newTopIds = new Set(newRanked.map((row) => row.listing.id));
  const overlap = [...legacyTopIds].filter((id) => newTopIds.has(id)).length;
  const entrants = newRanked.filter((row) => !legacyTopIds.has(row.listing.id));
  const exits = legacyTop.filter((listing) => !newTopIds.has(listing.id));
  const legacyMaxScoreCount = listings.filter((listing) => listing.legacyScore === 100).length;

  const lines: string[] = [
    "# Homepage rarity ranking: top 50 before and after",
    "",
    `Comparison cutoff: \`${COMPARISON_CUTOFF}\`. Active Porsche listings with no end time or an end time after the cutoff: **${listings.length.toLocaleString("en-US")}**.`,
    "",
    "The **before** table reproduces the legacy persisted rarity-score order (v6 score, ending time, id). The **after** table recomputes intrinsic collector significance with v7, adds a bounded 0–15 point live-market scarcity signal for recognized modern variants, adds up to 5 evidence points, subtracts 10 for unusable photography, deduplicates supply by VIN/fingerprint, and applies variant diversity caps.",
    "",
    `Top-50 overlap: **${overlap}/50**. New entrants: **${entrants.length}**. Exits: **${exits.length}**. The legacy score is saturated at 100 for **${legacyMaxScoreCount} listings**, so much of the old top order was decided by ending time and id rather than collector distinctions.`,
    "",
    "## Before — legacy rarity order",
    "",
    "| Rank | Car | Legacy score | Source | After rank |",
    "|---:|---|---:|---|---:|",
  ];

  legacyTop.forEach((listing, index) => {
    lines.push(
      `| ${index + 1} | ${carLabel(listing)} | ${listing.legacyScore} | ${sourceLabel(listing)} | ${newRankById.get(listing.id) ?? "—"} |`,
    );
  });

  lines.push(
    "",
    "## After — collector-first homepage order",
    "",
    "| Rank | Car | Homepage | Intrinsic v7 | Scarcity | Live supply | Variant | Legacy rank | Signals |",
    "|---:|---|---:|---:|---:|---:|---|---:|---|",
  );

  newRanked.forEach((row, index) => {
    lines.push(
      `| ${index + 1} | ${carLabel(row.listing)} | ${row.homepageScore} | ${row.intrinsicScore} | ${row.marketScarcityScore} | ${row.marketSupplyCount ?? "—"} | ${escapeCell(row.variantKey)} | ${legacyRankById.get(row.listing.id) ?? "—"} | ${escapeCell(row.listing.newSignals.join(", ") || "—")} |`,
    );
  });

  lines.push(
    "",
    "## New entrants",
    "",
    "| After rank | Car | Legacy rank | Why it moved |",
    "|---:|---|---:|---|",
  );

  entrants.forEach((row) => {
    lines.push(
      `| ${newRankById.get(row.listing.id)} | ${carLabel(row.listing)} | ${legacyRankById.get(row.listing.id)} | intrinsic ${row.intrinsicScore}; scarcity +${row.marketScarcityScore}; ${escapeCell(row.listing.newSignals.join(", ") || "recognized variant/evidence")} |`,
    );
  });

  lines.push(
    "",
    "## Exits",
    "",
    "| Legacy rank | Car | Legacy score | Recomputed intrinsic |",
    "|---:|---|---:|---:|",
  );
  exits.forEach((listing) => {
    lines.push(
      `| ${legacyRankById.get(listing.id)} | ${carLabel(listing)} | ${listing.legacyScore} | ${listing.rarityScore ?? 0} |`,
    );
  });

  return `${lines.join("\n")}\n`;
}

export async function main(): Promise<void> {
  loadDotEnv();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL not set");

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  try {
    await client.query("begin transaction read only");
    const result = await client.query<DatabaseListing>(
      `
        select id, year, make, model, trim, title, vin, mileage, mileage_unit,
               color_exterior, description_text, seller_notes, images, end_time,
               source, source_url, rarity_score, rarity_signals_json
        from public.listings
        where lower(make) = 'porsche'
          and status::text = 'active'
          and created_at <= $1::timestamptz
          and (end_time is null or end_time > $1::timestamptz)
        order by id asc
      `,
      [COMPARISON_CUTOFF],
    );
    writeFileSync(REPORT_PATH, buildComparisonReport(result.rows), "utf8");
    await client.query("rollback");
    console.log(`[rarity-comparison] wrote ${REPORT_PATH} from ${result.rows.length} read-only rows`);
  } finally {
    await client.end();
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
