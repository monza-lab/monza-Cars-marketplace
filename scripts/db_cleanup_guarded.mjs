import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";

const PROTECTED_TABLES = [
  "public.listings",
  "public.photos_media",
  "public.price_history",
];

const EMPTY_CANDIDATES = [
  "public.condition_history",
  "public.vehicle_history",
  "public.market_segments",
  "public.market_analytics",
];

const ARCHIVE_FIRST_CANDIDATES = [
  "public.auction_info",
  "public.vehicle_specs",
  "public.provenance_data",
  "public.location_data",
];

const ALL_CANDIDATES = [...EMPTY_CANDIDATES, ...ARCHIVE_FIRST_CANDIDATES];

function nowIsoCompact() {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "").replace("T", "_");
}

function assertTableName(tableName) {
  const parts = tableName.split(".");
  if (parts.length !== 2) {
    throw new Error(`Invalid table name: ${tableName}`);
  }
  for (const part of parts) {
    if (!/^[a-z_][a-z0-9_]*$/.test(part)) {
      throw new Error(`Unsafe SQL identifier: ${tableName}`);
    }
  }
}

function toArchiveTable(tableName, runId) {
  const [, table] = tableName.split(".");
  return `ops_archive.${table}_${runId}`;
}

function toQuarantineTable(tableName, runId) {
  const [, table] = tableName.split(".");
  return `ops_quarantine.${table}_deprecated_${runId}`;
}

async function scalar(client, sql, params = []) {
  const result = await client.query(sql, params);
  if (result.rows.length === 0) {
    return null;
  }
  const firstRow = result.rows[0];
  return firstRow[Object.keys(firstRow)[0]];
}

async function tableDigest(client, tableName) {
  assertTableName(tableName);
  const sql = `
    SELECT md5(
      COALESCE(
        string_agg(md5(row_to_json(t)::text), '' ORDER BY md5(row_to_json(t)::text)),
        ''
      )
    ) AS digest
    FROM ${tableName} t
  `;
  return scalar(client, sql);
}

async function dependencySnapshot(client, tableName) {
  const incomingFks = await client.query(
    `
    SELECT conname, conrelid::regclass::text AS child_table
    FROM pg_constraint
    WHERE contype = 'f'
      AND confrelid = $1::regclass
    ORDER BY conname
    `,
    [tableName],
  );

  const outgoingFks = await client.query(
    `
    SELECT conname, confrelid::regclass::text AS parent_table
    FROM pg_constraint
    WHERE contype = 'f'
      AND conrelid = $1::regclass
    ORDER BY conname
    `,
    [tableName],
  );

  const dependentViews = await client.query(
    `
    SELECT DISTINCT
      ns.nspname || '.' || c.relname AS view_name,
      c.relkind
    FROM pg_depend d
    JOIN pg_rewrite r ON r.oid = d.objid
    JOIN pg_class c ON c.oid = r.ev_class
    JOIN pg_namespace ns ON ns.oid = c.relnamespace
    WHERE d.refobjid = $1::regclass
      AND c.relkind IN ('v', 'm')
    ORDER BY view_name
    `,
    [tableName],
  );

  const triggers = await client.query(
    `
    SELECT tgname
    FROM pg_trigger
    WHERE tgrelid = $1::regclass
      AND NOT tgisinternal
    ORDER BY tgname
    `,
    [tableName],
  );

  const tableBareName = tableName.split(".")[1];
  const functionRefs = await client.query(
    `
    SELECT n.nspname || '.' || p.proname AS function_name
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.prokind = 'f'
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
      AND pg_get_functiondef(p.oid) ILIKE '%' || $1 || '%'
    ORDER BY function_name
    `,
    [tableBareName],
  );

  const stats = await client.query(
    `
    SELECT
      COALESCE(seq_scan, 0) AS seq_scan,
      COALESCE(idx_scan, 0) AS idx_scan,
      COALESCE(n_tup_ins, 0) AS n_tup_ins,
      COALESCE(n_tup_upd, 0) AS n_tup_upd,
      COALESCE(n_tup_del, 0) AS n_tup_del
    FROM pg_stat_user_tables
    WHERE relid = $1::regclass
    `,
    [tableName],
  );

  return {
    incomingFks: incomingFks.rows,
    outgoingFks: outgoingFks.rows,
    dependentViews: dependentViews.rows,
    triggers: triggers.rows,
    functionRefs: functionRefs.rows,
    stats: stats.rows[0] ?? { seq_scan: 0, idx_scan: 0, n_tup_ins: 0, n_tup_upd: 0, n_tup_del: 0 },
  };
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required. Load .env.local before running this script.");
  }

  const runId = nowIsoCompact();
  const artifactDir = join(process.cwd(), "var", "db-cleanup", runId);
  mkdirSync(artifactDir, { recursive: true });

  const client = new Client({ connectionString: databaseUrl, ssl: { rejectUnauthorized: false } });
  await client.connect();

  try {
    const preflight = {
      runId,
      timestamp: new Date().toISOString(),
      db: {
        currentDatabase: await scalar(client, "SELECT current_database()"),
        currentUser: await scalar(client, "SELECT current_user"),
        serverVersion: await scalar(client, "SELECT version()"),
      },
      supabaseRef: (process.env.NEXT_PUBLIC_SUPABASE_URL || "").match(/https:\/\/([^.]+)\.supabase\.co/)?.[1] ?? null,
      protectedTables: {},
      deniedTargets: PROTECTED_TABLES,
      candidates: ALL_CANDIDATES,
      restorePointGuidance:
        "Take a managed Supabase backup snapshot before irreversible cleanup. This run only archives and quarantines, no table drops.",
    };

    for (const tableName of PROTECTED_TABLES) {
      assertTableName(tableName);
      const rowCount = Number(await scalar(client, `SELECT COUNT(*)::bigint FROM ${tableName}`));
      const digest = await tableDigest(client, tableName);
      preflight.protectedTables[tableName] = { rowCount, digest };
    }
    writeFileSync(join(artifactDir, "01_preflight.json"), `${JSON.stringify(preflight, null, 2)}\n`);

    await client.query("CREATE SCHEMA IF NOT EXISTS ops_admin");
    await client.query("CREATE SCHEMA IF NOT EXISTS ops_archive");
    await client.query("CREATE SCHEMA IF NOT EXISTS ops_quarantine");
    await client.query(`
      CREATE TABLE IF NOT EXISTS ops_admin.cleanup_quarantine_log (
        id bigint generated always as identity primary key,
        run_id text not null,
        table_name text not null,
        candidate_class text not null,
        row_count bigint not null,
        dependency_safe boolean not null,
        has_activity boolean not null,
        action text not null,
        notes text,
        created_at timestamptz not null default now()
      )
    `);

    const dependencyReport = [];
    const archiveReport = [];
    const cleanupActions = [];

    for (const tableName of ALL_CANDIDATES) {
      assertTableName(tableName);
      if (PROTECTED_TABLES.includes(tableName)) {
        throw new Error(`Denylist violation: attempted operation on protected table ${tableName}`);
      }

      const rowCount = Number(await scalar(client, `SELECT COUNT(*)::bigint FROM ${tableName}`));
      const deps = await dependencySnapshot(client, tableName);
      const dependencySafe =
        deps.incomingFks.length === 0 &&
        deps.outgoingFks.length === 0 &&
        deps.dependentViews.length === 0 &&
        deps.triggers.length === 0 &&
        deps.functionRefs.length === 0;
      const hasActivity =
        Number(deps.stats.seq_scan) +
          Number(deps.stats.idx_scan) +
          Number(deps.stats.n_tup_ins) +
          Number(deps.stats.n_tup_upd) +
          Number(deps.stats.n_tup_del) >
        0;

      dependencyReport.push({ tableName, rowCount, dependencySafe, hasActivity, ...deps });

      const candidateClass = EMPTY_CANDIDATES.includes(tableName) ? "empty-candidate" : "archive-first";

      if (ARCHIVE_FIRST_CANDIDATES.includes(tableName) && rowCount > 0) {
        const archiveTable = toArchiveTable(tableName, runId.toLowerCase());
        const sourceDigest = await tableDigest(client, tableName);
        await client.query(`CREATE TABLE ${archiveTable} AS TABLE ${tableName}`);
        const archiveCount = Number(await scalar(client, `SELECT COUNT(*)::bigint FROM ${archiveTable}`));
        const archiveDigest = await tableDigest(client, archiveTable);

        archiveReport.push({
          tableName,
          archiveTable,
          sourceCount: rowCount,
          archiveCount,
          sourceDigest,
          archiveDigest,
          parityOk: rowCount === archiveCount && sourceDigest === archiveDigest,
        });
      }

      let action = "skip";
      let notes = "No action";

      if (EMPTY_CANDIDATES.includes(tableName)) {
        if (rowCount === 0 && dependencySafe && !hasActivity) {
          const quarantineTarget = toQuarantineTable(tableName, runId.toLowerCase());
          await client.query(`ALTER TABLE ${tableName} SET SCHEMA ops_quarantine`);
          const [, targetTable] = quarantineTarget.split(".");
          await client.query(`ALTER TABLE ops_quarantine.${tableName.split(".")[1]} RENAME TO ${targetTable}`);
          action = "quarantined";
          notes = `Moved to ${quarantineTarget}`;
          cleanupActions.push({ tableName, action, target: quarantineTarget });
        } else {
          action = "skipped";
          notes = `rowCount=${rowCount}, dependencySafe=${dependencySafe}, hasActivity=${hasActivity}`;
          cleanupActions.push({ tableName, action, reason: notes });
        }
      }

      await client.query(
        `
        INSERT INTO ops_admin.cleanup_quarantine_log
          (run_id, table_name, candidate_class, row_count, dependency_safe, has_activity, action, notes)
        VALUES
          ($1, $2, $3, $4, $5, $6, $7, $8)
        `,
        [runId, tableName, candidateClass, rowCount, dependencySafe, hasActivity, action, notes],
      );
    }

    writeFileSync(join(artifactDir, "02_dependency_report.json"), `${JSON.stringify(dependencyReport, null, 2)}\n`);
    writeFileSync(join(artifactDir, "03_archive_report.json"), `${JSON.stringify(archiveReport, null, 2)}\n`);
    writeFileSync(join(artifactDir, "04_cleanup_actions.json"), `${JSON.stringify(cleanupActions, null, 2)}\n`);

    const postVerification = { protectedTables: {} };
    for (const tableName of PROTECTED_TABLES) {
      const rowCount = Number(await scalar(client, `SELECT COUNT(*)::bigint FROM ${tableName}`));
      const digest = await tableDigest(client, tableName);
      postVerification.protectedTables[tableName] = { rowCount, digest };
    }
    writeFileSync(join(artifactDir, "05_post_verification.json"), `${JSON.stringify(postVerification, null, 2)}\n`);

    const final = {
      runId,
      artifactDir,
      archivedTables: archiveReport.length,
      quarantinedTables: cleanupActions.filter((x) => x.action === "quarantined").length,
      skippedTables: cleanupActions.filter((x) => x.action !== "quarantined").length,
      protectedTablesUnchanged: PROTECTED_TABLES.every((tableName) => {
        const before = preflight.protectedTables[tableName];
        const after = postVerification.protectedTables[tableName];
        return before.rowCount === after.rowCount && before.digest === after.digest;
      }),
    };
    writeFileSync(join(artifactDir, "06_final_summary.json"), `${JSON.stringify(final, null, 2)}\n`);

    console.log(JSON.stringify(final, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("DB cleanup run failed:", {
    message: error.message,
    code: error.code,
    detail: error.detail,
    hint: error.hint,
    where: error.where,
    position: error.position,
    stack: error.stack,
  });
  process.exitCode = 1;
});
