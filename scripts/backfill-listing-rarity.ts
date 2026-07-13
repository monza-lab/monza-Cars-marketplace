import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as sleep } from "node:timers/promises";
import { Client } from "pg";

import { RARITY_SCORE_VERSION, scoreListingRarity, type ListingRaritySignal } from "../src/lib/listingRarity";
import { computeRankingVariant } from "../src/features/scrapers/common/rankingEnrichment";

type BackfillStatus = "active" | "all";

type ListingRow = {
  id: string;
  year: number | null;
  model: string | null;
  trim: string | null;
  title: string | null;
  description_text: string | null;
  seller_notes: string | null;
  mileage: number | null;
  mileage_unit: string | null;
  rarity_score: number | null;
  rarity_tier: string | null;
  rarity_signals_json: ListingRaritySignal[] | null;
  rarity_score_version: string | null;
  ranking_variant: string | null;
};

type UpdatePayload = {
  id: string;
  rarity_score: number;
  rarity_tier: string;
  rarity_signals_json: ListingRaritySignal[];
  rarity_score_version: string;
  ranking_variant: string | null;
};

type QueryClient = {
  connect(): Promise<void>;
  end(): Promise<void>;
  query<T = unknown>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
};

export type BackfillOptions = {
  dryRun: boolean;
  limit: number | null;
  batchSize: number;
  pauseMs: number;
  status: BackfillStatus;
};

export type BackfillStats = {
  scanned: number;
  updated: number;
  skipped: number;
  batches: number;
};

export const RARITY_BACKFILL_DEFAULTS: BackfillOptions = {
  dryRun: false,
  limit: null,
  batchSize: 500,
  pauseMs: 0,
  status: "active",
};

export function loadDotEnv(): void {
  for (const file of [".env.local", ".env"]) {
    try {
      const txt = readFileSync(resolve(process.cwd(), file), "utf8");
      for (const line of txt.split("\n")) {
        const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
        if (!match) continue;
        const [, key, rawValue] = match;
        if (process.env[key]) continue;
        process.env[key] = rawValue.replace(/^"|"$/g, "").replace(/^'|'$/g, "");
      }
    } catch {}
  }
}

export function parseBackfillArgs(argv: string[]): BackfillOptions {
  const options: BackfillOptions = { ...RARITY_BACKFILL_DEFAULTS };

  for (const arg of argv) {
    if (arg === "--dry-run") {
      options.dryRun = true;
    } else if (arg.startsWith("--limit=")) {
      const value = Number.parseInt(arg.slice("--limit=".length), 10);
      if (Number.isFinite(value) && value > 0) options.limit = value;
    } else if (arg.startsWith("--batch-size=")) {
      const value = Number.parseInt(arg.slice("--batch-size=".length), 10);
      if (Number.isFinite(value) && value > 0) options.batchSize = value;
    } else if (arg.startsWith("--pause-ms=")) {
      const value = Number.parseInt(arg.slice("--pause-ms=".length), 10);
      if (Number.isFinite(value) && value >= 0) options.pauseMs = value;
    } else if (arg.startsWith("--status=")) {
      const value = arg.slice("--status=".length);
      if (value === "active" || value === "all") options.status = value;
    }
  }

  return options;
}

function sameRarityPayload(
  row: ListingRow,
  next: ReturnType<typeof scoreListingRarity>,
  rankingVariant: string | null,
): boolean {
  if (row.rarity_score !== next.score) return false;
  if (row.rarity_tier !== next.tier) return false;
  if (JSON.stringify(row.rarity_signals_json ?? []) !== JSON.stringify(next.signals)) return false;
  return row.rarity_score_version === RARITY_SCORE_VERSION && row.ranking_variant === rankingVariant;
}

async function writeBatch(client: QueryClient, updates: UpdatePayload[]): Promise<void> {
  if (updates.length === 0) return;

  await client.query(
    `
      update public.listings as l
      set rarity_score = payload.rarity_score::smallint,
          rarity_tier = payload.rarity_tier,
          rarity_signals_json = payload.rarity_signals_json,
          rarity_scored_at = now(),
          rarity_score_version = payload.rarity_score_version,
          ranking_variant = payload.ranking_variant
      from jsonb_to_recordset($1::jsonb) as payload(
        id uuid,
        rarity_score integer,
        rarity_tier text,
        rarity_signals_json jsonb,
        rarity_score_version text,
        ranking_variant text
      )
      where l.id = payload.id
    `,
    [JSON.stringify(updates)],
  );
}

export async function backfillListingRarity(client: QueryClient, options: BackfillOptions): Promise<BackfillStats> {
  let lastId: string | null = null;
  let scanned = 0;
  let updated = 0;
  let skipped = 0;
  let batches = 0;

  for (;;) {
    if (options.limit !== null && scanned >= options.limit) break;

    const remaining = options.limit === null ? options.batchSize : Math.min(options.batchSize, options.limit - scanned);
    if (remaining <= 0) break;

    const { rows } = await client.query<ListingRow>(
      `
        select id, year, model, trim, title, description_text, seller_notes, mileage, mileage_unit,
               rarity_score, rarity_tier, rarity_signals_json, rarity_score_version, ranking_variant
        from public.listings
        where make = 'Porsche'
          and ($1::uuid is null or id > $1::uuid)
          and (rarity_score is null or rarity_score_version is distinct from $2 or ranking_variant is null)
          and ($3::text = 'all' or status::text = $3)
        order by id asc
        limit $4
      `,
      [lastId, RARITY_SCORE_VERSION, options.status, remaining],
    );

    if (rows.length === 0) break;
    batches += 1;

    const updates: UpdatePayload[] = [];

    for (const row of rows) {
      if (options.limit !== null && scanned >= options.limit) break;

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
      const rankingVariant = row.year !== null && row.model
        ? computeRankingVariant({
            year: row.year,
            make: "Porsche",
            model: row.model,
            trim: row.trim,
            title: row.title,
          })
        : null;

      scanned += 1;
      if (sameRarityPayload(row, rarity, rankingVariant)) {
        skipped += 1;
        continue;
      }

      updated += 1;
      if (!options.dryRun) {
        updates.push({
          id: row.id,
          rarity_score: rarity.score,
          rarity_tier: rarity.tier,
          rarity_signals_json: rarity.signals,
          rarity_score_version: RARITY_SCORE_VERSION,
          ranking_variant: rankingVariant,
        });
      }
    }

    await writeBatch(client, updates);
    lastId = rows[rows.length - 1].id;

    console.log(`[rarity-backfill] batch ${batches}: scanned=${scanned} updated=${updated} skipped=${skipped}`);

    if (options.pauseMs > 0) {
      await sleep(options.pauseMs);
    }
  }

  if (!options.dryRun && updated > 0) {
    await client.query("select public.refresh_listings_active_counts()");
  }

  return { scanned, updated, skipped, batches };
}

export async function main(argv = process.argv.slice(2)): Promise<BackfillStats> {
  loadDotEnv();

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL not set");
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });

  await client.connect();
  console.log(`[rarity-backfill] connected version=${RARITY_SCORE_VERSION} status=${parseBackfillArgs(argv).status}`);

  try {
    const stats = await backfillListingRarity(client, parseBackfillArgs(argv));
    console.log(`[rarity-backfill] done: ${JSON.stringify(stats)}`);
    return stats;
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
