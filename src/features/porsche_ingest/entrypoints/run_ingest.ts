import { existsSync, readFileSync } from "node:fs";
import crypto from "node:crypto";

import { fetchSourceItems, SOURCE_NAME, type SourceKey } from "../adapters/sources";
import { CliConfigSchema, EnvSchema, type CliConfig } from "../contracts/config";
import type { NormalizeReject } from "../contracts/listing";
import { assertOperatorCanBackfill, assertOperatorCanWrite, type OperatorContext } from "../contracts/operator";
import { writeRunArtifacts, type RunReport } from "../observability/run_report";
import { upsertCanonicalListing } from "../repository/supabase_writer";
import { loadCheckpoint, updateCheckpoint } from "../services/checkpoint";
import { dedupeListings } from "../services/dedupe";
import { normalizeRawListing } from "../services/normalize";
import { evaluateSoldWindow } from "../services/sold_filter";

function loadEnvFromFile(relPath: string): void {
  if (!existsSync(relPath)) return;
  const raw = readFileSync(relPath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue;
    const trimmed = raw.slice(2);
    const eq = trimmed.indexOf("=");
    if (eq === -1) {
      out[trimmed] = true;
      continue;
    }
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

function parseCli(argv: string[]): CliConfig {
  const args = parseArgv(argv);
  return CliConfigSchema.parse({
    source: typeof args.source === "string" ? args.source : "bat",
    mode: typeof args.mode === "string" ? args.mode : "incremental",
    limit: typeof args.limit === "string" ? Number(args.limit) : 100,
    dryRun: args["dry-run"] === true,
    failFast: args["fail-fast"] === true,
    soldOnly: args["sold-only"] === true,
    soldWithinMonths: typeof args["sold-within-months"] === "string" ? Number(args["sold-within-months"]) : undefined,
    activeOnly: args["active-only"] === true,
    since: typeof args.since === "string" ? args.since : undefined,
    from: typeof args.from === "string" ? args.from : undefined,
    resume: typeof args.resume === "string" ? args.resume : undefined,
  });
}

function resolveSources(source: CliConfig["source"]): SourceKey[] {
  if (source === "all") return ["bat", "carsandbids", "autoscout24", "classiccars"];
  return [source];
}

export async function runIngest(argv: string[]): Promise<RunReport> {
  loadEnvFromFile(".env.local");
  loadEnvFromFile(".env");

  const config = parseCli(argv);
  const runId = config.resume ?? `run_${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}_${crypto.randomUUID().slice(0, 8)}`;
  const startedAt = new Date().toISOString();
  const env = EnvSchema.parse(process.env);

  const operator: OperatorContext = {
    actor: "operator",
    canWrite: Boolean(env.SUPABASE_SERVICE_ROLE_KEY || config.dryRun),
    canRunBackfill: Boolean(env.SUPABASE_SERVICE_ROLE_KEY),
  };
  const writeError = assertOperatorCanWrite(operator);
  if (writeError && !config.dryRun) throw new Error(writeError.message);
  if (config.mode === "backfill") {
    const backfillError = assertOperatorCanBackfill(operator);
    if (backfillError) throw new Error(backfillError.message);
  }

  const totals = { fetched: 0, normalized: 0, deduped: 0, inserted: 0, updated: 0, rejected: 0, errors: 0 };
  const rejectionReasons: Record<string, number> = {};
  const rejects: NormalizeReject[] = [];
  const errors: string[] = [];
  const checkpointPath = "var/runs/porsche-ingest/checkpoints.json";
  await loadCheckpoint(checkpointPath);

  for (const source of resolveSources(config.source)) {
    try {
      const rawItems = await fetchSourceItems({
        source,
        mode: config.mode,
        limit: config.limit,
        activeOnly: config.activeOnly,
        soldOnly: config.soldOnly,
        since: config.since,
        from: config.from,
      });
      totals.fetched += rawItems.length;

      const normalized = rawItems.map((raw) => normalizeRawListing({ source: SOURCE_NAME[source], raw }));
      const okListings = normalized.flatMap((entry) => (entry.ok ? [entry.value] : []));
      const sourceRejects = normalized.flatMap((entry) => (entry.ok ? [] : [entry.reject]));
      totals.normalized += okListings.length;
      totals.rejected += sourceRejects.length;
      for (const reject of sourceRejects) {
        rejectionReasons[reject.reason] = (rejectionReasons[reject.reason] ?? 0) + 1;
      }
      rejects.push(...sourceRejects);

      const deduped = dedupeListings(okListings);
      const filtered = deduped.filter((listing) => {
        if (config.activeOnly && listing.status !== "active") {
          totals.rejected += 1;
          rejectionReasons.not_active = (rejectionReasons.not_active ?? 0) + 1;
          rejects.push({
            source: listing.source,
            reason: "not_active",
            raw: listing.raw_payload,
            details: { status: listing.status },
          });
          return false;
        }

        const sold = evaluateSoldWindow(listing, {
          soldOnly: config.soldOnly,
          soldWithinMonths: config.soldWithinMonths,
        });
        if (sold.keep) return true;
        totals.rejected += 1;
        rejectionReasons[sold.reason] = (rejectionReasons[sold.reason] ?? 0) + 1;
        rejects.push({
          source: listing.source,
          reason: sold.reason,
          raw: listing.raw_payload,
          details: { status: listing.status, sale_date: listing.sale_date },
        });
        return false;
      });
      totals.deduped += filtered.length;

      for (const listing of filtered) {
        const write = await upsertCanonicalListing(listing, config.dryRun);
        totals.inserted += write.inserted;
        totals.updated += write.updated;
        if (write.warnings.length) {
          errors.push(...write.warnings.map((warning) => `${source}:${listing.source_id}:${warning}`));
          totals.errors += write.warnings.length;
        }
        await updateCheckpoint({
          filePath: checkpointPath,
          source,
          runId,
          lastCursor: listing.source_id,
          lastSeenAt: new Date().toISOString(),
        });
      }
    } catch (error) {
      totals.errors += 1;
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${source}:${message}`);
      if (config.failFast) throw error;
    }
  }

  const report: RunReport = {
    run_id: runId,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    mode: config.mode,
    source: config.source,
    dry_run: config.dryRun,
    totals,
    rejection_reasons: rejectionReasons,
    errors,
  };

  await writeRunArtifacts({ runId, report, rejects });
  return report;
}
