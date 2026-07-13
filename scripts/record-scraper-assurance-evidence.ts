import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { Client } from "pg";

import { ASSURANCE_FIELDS, getAssuranceSource, type AssuranceField } from "../src/features/scrapers/common/assurance/manifest";
import { assertSafeListingPatch, buildEvidencePatch } from "../src/features/scrapers/common/assurance/repairPolicy";

type EvidenceState = "unavailable_at_source" | "temporarily_blocked" | "invalid_source_value";

interface CliOptions {
  listing: string;
  field: AssuranceField;
  state: EvidenceState;
  sourceUrl: string;
  method: string;
  evidenceHash: string;
  retryAfter?: string;
}

interface LockedListing {
  id: string;
  source: string | null;
  source_url: string | null;
  status: string | null;
  enrichment_meta: Record<string, unknown> | null;
}

const ARGUMENTS = new Set([
  "listing",
  "field",
  "state",
  "source-url",
  "method",
  "evidence-hash",
  "retry-after",
]);
const STATES = new Set<EvidenceState>([
  "unavailable_at_source",
  "temporarily_blocked",
  "invalid_source_value",
]);

function loadEnvFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const separator = trimmed.indexOf("=");
    if (separator < 1) continue;
    const key = trimmed.slice(0, separator).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

export function parseEvidenceArgs(args: string[]): CliOptions {
  const values = new Map<string, string>();
  for (const argument of args) {
    const match = /^--([^=]+)=(.*)$/.exec(argument);
    if (!match || !ARGUMENTS.has(match[1])) throw new Error(`Unsupported argument: ${argument}`);
    if (values.has(match[1])) throw new Error(`Duplicate argument: --${match[1]}`);
    values.set(match[1], match[2]);
  }
  for (const required of ["listing", "field", "state", "source-url", "method", "evidence-hash"]) {
    if (!values.get(required)?.trim()) throw new Error(`Missing --${required}=...`);
  }

  const listing = values.get("listing")!;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(listing)) {
    throw new Error("--listing must be a UUID");
  }
  const field = values.get("field")!;
  if (!ASSURANCE_FIELDS.includes(field as AssuranceField)) throw new Error(`Unknown assurance field: ${field}`);
  const state = values.get("state")! as EvidenceState;
  if (!STATES.has(state)) throw new Error(`Unsupported evidence state: ${state}`);

  return {
    listing,
    field: field as AssuranceField,
    state,
    sourceUrl: values.get("source-url")!,
    method: values.get("method")!,
    evidenceHash: values.get("evidence-hash")!,
    ...(values.get("retry-after") ? { retryAfter: values.get("retry-after") } : {}),
  };
}

export async function recordEvidence(options: CliOptions): Promise<Record<string, string>> {
  loadEnvFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFile(path.resolve(process.cwd(), ".env"));
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is required");

  const client = new Client({
    connectionString,
    ssl: /sslmode=disable/i.test(connectionString) ? undefined : { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    await client.query("BEGIN");
    const locked = await client.query(
      `SELECT id, source, source_url, status, enrichment_meta
       FROM public.listings
       WHERE id = $1
       FOR UPDATE`,
      [options.listing],
    ) as { rows: LockedListing[] };
    const listing = locked.rows[0];
    if (!listing) throw new Error("Active listing not found");
    if (listing.status !== "active") throw new Error("Listing is not active");
    if (listing.source_url !== options.sourceUrl) throw new Error("Source URL does not match the active listing");
    const source = listing.source ? getAssuranceSource(listing.source) : undefined;
    if (!source) throw new Error(`Unregistered listing source: ${listing.source ?? "null"}`);
    if (!source.requiredFields.includes(options.field)) {
      throw new Error(`${options.field} is not part of the ${source.id} assurance contract`);
    }
    if (options.state === "unavailable_at_source" && !source.unavailableFields.includes(options.field)) {
      throw new Error(`${options.field} cannot be unavailable for ${source.id}`);
    }

    const checkedAt = new Date().toISOString();
    const patch = buildEvidencePatch({
      field: options.field,
      state: options.state,
      checkedAt,
      sourceUrl: options.sourceUrl,
      method: options.method,
      evidenceHash: options.evidenceHash,
      retryAfter: options.retryAfter,
      existingMeta: listing.enrichment_meta,
    });
    assertSafeListingPatch(patch);
    await client.query(
      `UPDATE public.listings
       SET enrichment_meta = $2::jsonb
       WHERE id = $1`,
      [listing.id, JSON.stringify(patch.enrichment_meta)],
    );
    const verified = await client.query(
      `SELECT enrichment_meta
       FROM public.listings
       WHERE id = $1`,
      [listing.id],
    ) as { rows: Array<{ enrichment_meta: Record<string, unknown> }> };
    if (!verified.rows[0]?.enrichment_meta) throw new Error("Evidence update verification failed");
    await client.query("COMMIT");
    return { listingId: listing.id, field: options.field, state: options.state, checkedAt };
  } catch (error) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw error;
  } finally {
    await client.end();
  }
}

async function main(): Promise<void> {
  const confirmation = await recordEvidence(parseEvidenceArgs(process.argv.slice(2)));
  console.log(JSON.stringify(confirmation));
}

const isDirectRun = process.argv[1]
  ? fileURLToPath(import.meta.url) === path.resolve(process.argv[1])
  : false;

if (isDirectRun) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
