import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const PORSCHE_MAKE_REGEX = "^\\s*porsche\\s*$";

const LISTING_CHILD_TABLES = [
  { table: "public.photos_media", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.price_history", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.auction_info", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.vehicle_specs", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.provenance_data", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.location_data", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.condition_history", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.vehicle_history", where: "listing_id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
  { table: "public.listings", where: "id IN (SELECT id FROM tmp_non_porsche_listing_ids)" },
];

const AUCTION_CHILD_TABLES = [
  { table: 'public."PriceHistory"', where: '"auctionId" IN (SELECT id FROM tmp_non_porsche_auction_ids)' },
  { table: 'public."Comparable"', where: '"auctionId" IN (SELECT id FROM tmp_non_porsche_auction_ids)' },
  { table: 'public."Analysis"', where: '"auctionId" IN (SELECT id FROM tmp_non_porsche_auction_ids)' },
  { table: 'public."UserAnalysis"', where: '"auctionId" IN (SELECT id FROM tmp_non_porsche_auction_ids)' },
  { table: 'public."Auction"', where: "id IN (SELECT id FROM tmp_non_porsche_auction_ids)" },
  { table: 'public."MarketData"', where: `COALESCE(make, '') !~* '${PORSCHE_MAKE_REGEX}'` },
  { table: 'public."ModelBackfillState"', where: `COALESCE(make, '') !~* '${PORSCHE_MAKE_REGEX}'` },
];

function nowIsoCompact() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
}

function loadEnvFromLocal() {
  const envPath = join(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

async function scalar(client, sql) {
  const result = await client.query(sql);
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return row[Object.keys(row)[0]];
}

function parseTable(table) {
  const match = table.match(/^([a-z_][a-z0-9_]*)\.("?[A-Za-z_][A-Za-z0-9_]*"?)$/);
  if (!match) throw new Error(`Unsafe table name: ${table}`);
  return {
    schema: match[1],
    rawName: match[2],
    plainName: match[2].replaceAll('"', ""),
    fq: `${match[1]}.${match[2]}`,
  };
}

function archiveTableName(table, runId) {
  const parsed = parseTable(table);
  const slug = parsed.plainName.toLowerCase();
  return `ops_archive.${slug}_non_porsche_${runId}`;
}

async function tableExists(client, table) {
  const parsed = parseTable(table);
  const exists = await client.query(
    `
      SELECT EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = $1
          AND table_name = $2
      ) AS ok
    `,
    [parsed.schema, parsed.plainName],
  );
  return exists.rows[0]?.ok === true;
}

async function countRows(client, table, where) {
  const result = await client.query(`SELECT COUNT(*)::bigint AS n FROM ${parseTable(table).fq} WHERE ${where}`);
  return Number(result.rows[0]?.n ?? 0);
}

async function archiveAndDelete(client, table, where, runId) {
  const exists = await tableExists(client, table);
  if (!exists) {
    return {
      table,
      exists: false,
      archivedRows: 0,
      deletedRows: 0,
      archiveTable: null,
      action: "skipped_missing",
    };
  }

  const sourceCount = await countRows(client, table, where);
  const archiveTable = archiveTableName(table, runId);

  if (sourceCount === 0) {
    return {
      table,
      exists: true,
      archivedRows: 0,
      deletedRows: 0,
      archiveTable,
      action: "skipped_empty",
    };
  }

  await client.query(`CREATE TABLE ${archiveTable} AS SELECT * FROM ${parseTable(table).fq} WHERE ${where}`);
  const archiveCount = Number(await scalar(client, `SELECT COUNT(*)::bigint FROM ${archiveTable}`));

  const delResult = await client.query(`DELETE FROM ${parseTable(table).fq} WHERE ${where}`);

  return {
    table,
    exists: true,
    archivedRows: archiveCount,
    deletedRows: delResult.rowCount ?? 0,
    archiveTable,
    action: "archived_and_deleted",
  };
}

async function makeCounts(client, table, makeColumn = "make") {
  const exists = await tableExists(client, table);
  if (!exists) return [];
  const result = await client.query(
    `
      SELECT COALESCE(${makeColumn}::text, '<null>') AS make, COUNT(*)::bigint AS count
      FROM ${parseTable(table).fq}
      GROUP BY 1
      ORDER BY COUNT(*) DESC, 1 ASC
    `,
  );
  return result.rows.map((r) => ({ make: r.make, count: Number(r.count) }));
}

async function run() {
  loadEnvFromLocal();

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL missing. Add it to .env.local.");
  }

  const runId = nowIsoCompact().toLowerCase();
  const artifactDir = join(process.cwd(), "var", "porsche-cleanup", runId);
  mkdirSync(artifactDir, { recursive: true });

  const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    await client.query("CREATE SCHEMA IF NOT EXISTS ops_archive");

    const envInfo = {
      runId,
      timestamp: new Date().toISOString(),
      db: {
        currentDatabase: await scalar(client, "SELECT current_database()"),
        currentUser: await scalar(client, "SELECT current_user"),
        serverVersion: await scalar(client, "SELECT version()"),
      },
      supabaseRef: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null,
    };
    writeFileSync(join(artifactDir, "01_env.json"), `${JSON.stringify(envInfo, null, 2)}\n`);

    const preflight = {
      listingsByMake: await makeCounts(client, "public.listings"),
      auctionsByMake: await makeCounts(client, 'public."Auction"'),
      marketDataByMake: await makeCounts(client, 'public."MarketData"'),
      backfillByMake: await makeCounts(client, 'public."ModelBackfillState"'),
      keyTotals: {
        listings: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.listings")),
        photosMedia: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.photos_media")),
        listingPriceHistory: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.price_history")),
        prismaAuction: Number(await scalar(client, 'SELECT COUNT(*)::bigint FROM public."Auction"')),
        prismaComparable: Number(await scalar(client, 'SELECT COUNT(*)::bigint FROM public."Comparable"')),
        prismaPriceHistory: Number(await scalar(client, 'SELECT COUNT(*)::bigint FROM public."PriceHistory"')),
      },
    };
    writeFileSync(join(artifactDir, "02_preflight_counts.json"), `${JSON.stringify(preflight, null, 2)}\n`);

    await client.query("BEGIN");

    await client.query(`
      CREATE TEMP TABLE tmp_non_porsche_listing_ids AS
      SELECT id
      FROM public.listings
      WHERE COALESCE(make, '') !~* '${PORSCHE_MAKE_REGEX}'
    `);

    await client.query(`
      CREATE TEMP TABLE tmp_non_porsche_auction_ids AS
      SELECT id
      FROM public."Auction"
      WHERE COALESCE(make, '') !~* '${PORSCHE_MAKE_REGEX}'
    `);

    const listingActions = [];
    for (const target of LISTING_CHILD_TABLES) {
      listingActions.push(await archiveAndDelete(client, target.table, target.where, runId));
    }

    const auctionActions = [];
    for (const target of AUCTION_CHILD_TABLES) {
      auctionActions.push(await archiveAndDelete(client, target.table, target.where, runId));
    }

    await client.query(`UPDATE public.listings SET make = 'Porsche' WHERE COALESCE(make, '') ~* '${PORSCHE_MAKE_REGEX}'`);

    if (await tableExists(client, 'public."Auction"')) {
      await client.query(`UPDATE public."Auction" SET make = 'Porsche' WHERE COALESCE(make, '') ~* '${PORSCHE_MAKE_REGEX}'`);
    }
    if (await tableExists(client, 'public."MarketData"')) {
      await client.query(`UPDATE public."MarketData" SET make = 'Porsche' WHERE COALESCE(make, '') ~* '${PORSCHE_MAKE_REGEX}'`);
    }
    if (await tableExists(client, 'public."ModelBackfillState"')) {
      await client.query(`UPDATE public."ModelBackfillState" SET make = 'Porsche' WHERE COALESCE(make, '') ~* '${PORSCHE_MAKE_REGEX}'`);
    }

    await client.query("COMMIT");

    const backupManifest = {
      runId,
      archiveSchema: "ops_archive",
      listingActions,
      auctionActions,
      totalArchivedRows: [...listingActions, ...auctionActions].reduce((sum, x) => sum + x.archivedRows, 0),
      totalDeletedRows: [...listingActions, ...auctionActions].reduce((sum, x) => sum + x.deletedRows, 0),
    };
    writeFileSync(join(artifactDir, "03_backup_manifest.json"), `${JSON.stringify(backupManifest, null, 2)}\n`);

    const postChecks = {
      listingsByMake: await makeCounts(client, "public.listings"),
      auctionsByMake: await makeCounts(client, 'public."Auction"'),
      marketDataByMake: await makeCounts(client, 'public."MarketData"'),
      backfillByMake: await makeCounts(client, 'public."ModelBackfillState"'),
      keyTotals: {
        listings: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.listings")),
        photosMedia: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.photos_media")),
        listingPriceHistory: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.price_history")),
        prismaAuction: Number(await scalar(client, 'SELECT COUNT(*)::bigint FROM public."Auction"')),
        prismaComparable: Number(await scalar(client, 'SELECT COUNT(*)::bigint FROM public."Comparable"')),
        prismaPriceHistory: Number(await scalar(client, 'SELECT COUNT(*)::bigint FROM public."PriceHistory"')),
      },
      verificationQueries: {
        nonPorscheListings: Number(await scalar(client, `SELECT COUNT(*)::bigint FROM public.listings WHERE COALESCE(make, '') !~* '${PORSCHE_MAKE_REGEX}'`)),
        nonPorscheAuctions: Number(await scalar(client, `SELECT COUNT(*)::bigint FROM public."Auction" WHERE COALESCE(make, '') !~* '${PORSCHE_MAKE_REGEX}'`)),
        orphanPhotosMedia: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.photos_media pm LEFT JOIN public.listings l ON l.id = pm.listing_id WHERE l.id IS NULL")),
        orphanListingPriceHistory: Number(await scalar(client, "SELECT COUNT(*)::bigint FROM public.price_history ph LEFT JOIN public.listings l ON l.id = ph.listing_id WHERE l.id IS NULL")),
      },
    };
    writeFileSync(join(artifactDir, "04_post_checks.json"), `${JSON.stringify(postChecks, null, 2)}\n`);

    const summary = {
      runId,
      artifactDir,
      nonPorscheListingsRemaining: postChecks.verificationQueries.nonPorscheListings,
      nonPorscheAuctionsRemaining: postChecks.verificationQueries.nonPorscheAuctions,
      totalArchivedRows: backupManifest.totalArchivedRows,
      totalDeletedRows: backupManifest.totalDeletedRows,
      rollbackHint: `Restore rows with INSERT INTO <table> SELECT * FROM <archive_table> from schema ops_archive for run ${runId}.`,
    };
    writeFileSync(join(artifactDir, "05_summary.json"), `${JSON.stringify(summary, null, 2)}\n`);
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // no-op rollback fallback
    }
    throw error;
  } finally {
    await client.end();
  }
}

run().catch((error) => {
  console.error("Porsche cleanup failed", {
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
    where: error.where,
  });
  process.exitCode = 1;
});
