/**
 * One-shot cleanup: strip stored source-page dumps out of
 * listings.description_text / listings.seller_notes.
 *
 * Some scrapers (Classic.com first among them) stored the whole page as the
 * listing description, so a MonzaHaus listing rendered a competitor's
 * navigation, subscription pricing table and disclaimers. The read path and the
 * scraper are fixed in code (src/lib/listingDescription.ts); this repairs the
 * rows already written.
 *
 * Usage:
 *   npx tsx scripts/clean-scraped-descriptions.ts              # dry run
 *   npx tsx scripts/clean-scraped-descriptions.ts --apply      # write
 *   npx tsx scripts/clean-scraped-descriptions.ts --source=ClassicCom --apply
 *
 * Requires env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Does NOT run automatically from any cron or test.
 */

import { resolve } from "path";
import { existsSync, readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";
import {
  hasScrapedChrome,
  sanitizeListingDescription,
} from "../src/lib/listingDescription";

// Load .env.local if it exists (local development)
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

type CleanupRow = {
  id: string;
  source: string | null;
  description_text: string | null;
  seller_notes: string | null;
};

type CleanupPatch = {
  id: string;
  description_text?: string | null;
  seller_notes?: string | null;
};

// ---------------------------------------------------------------------------
// Pure mapping function — exported for unit tests
// ---------------------------------------------------------------------------

export function mapRowToCleanup(row: CleanupRow): CleanupPatch | null {
  const patch: CleanupPatch = { id: row.id };
  let dirty = false;

  if (hasScrapedChrome(row.description_text)) {
    patch.description_text = sanitizeListingDescription(row.description_text);
    dirty = true;
  }
  if (hasScrapedChrome(row.seller_notes)) {
    patch.seller_notes = sanitizeListingDescription(row.seller_notes);
    dirty = true;
  }

  return dirty ? patch : null;
}

// ---------------------------------------------------------------------------
// Main loop
// ---------------------------------------------------------------------------

const PAGE_SIZE = 500;
const CHUNK_SIZE = 100;

async function main(): Promise<void> {
  const apply = process.argv.includes("--apply");
  const sourceArg = process.argv.find((arg) => arg.startsWith("--source="));
  const source = sourceArg ? sourceArg.slice("--source=".length) : null;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error(
      "[clean-descriptions] Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY",
    );
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let lastId = "";
  let scanned = 0;
  let affected = 0;
  let salvaged = 0;
  let page = 0;

  console.log(
    `[clean-descriptions] ${apply ? "APPLY" : "DRY RUN"}${source ? ` · source=${source}` : ""}`,
  );

  while (true) {
    page += 1;

    const query = supabase
      .from("listings")
      .select("id, source, description_text, seller_notes")
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (source) query.eq("source", source);
    if (lastId) query.gt("id", lastId);

    const { data, error } = await query;
    if (error) {
      console.error(`[clean-descriptions] Query error on page ${page}:`, error.message);
      process.exit(1);
    }
    const rows = (data ?? []) as CleanupRow[];
    if (rows.length === 0) break;

    scanned += rows.length;
    lastId = rows[rows.length - 1].id;

    const patches = rows
      .map(mapRowToCleanup)
      .filter((patch): patch is CleanupPatch => patch !== null);

    affected += patches.length;
    salvaged += patches.filter(
      (patch) => typeof patch.description_text === "string" || typeof patch.seller_notes === "string",
    ).length;

    if (patches.length > 0 && !apply) {
      for (const patch of patches.slice(0, 3)) {
        console.log(
          `[clean-descriptions] would clean ${patch.id} → description_text=${
            patch.description_text === null ? "NULL" : "salvaged seller block"
          }`,
        );
      }
    }

    if (patches.length > 0 && apply) {
      for (let index = 0; index < patches.length; index += CHUNK_SIZE) {
        const chunk = patches.slice(index, index + CHUNK_SIZE);
        for (const patch of chunk) {
          const { id, ...values } = patch;
          const { error: updateError } = await supabase
            .from("listings")
            .update(values)
            .eq("id", id);
          if (updateError) {
            console.error(`[clean-descriptions] Update error on ${id}:`, updateError.message);
            process.exit(1);
          }
        }
      }
    }

    console.log(
      `[clean-descriptions] page ${page}: scanned ${rows.length}, to clean ${patches.length} (lastId=${lastId})`,
    );

    if (rows.length < PAGE_SIZE) break;
  }

  console.log(
    `[clean-descriptions] Summary: scanned ${scanned} rows, ${affected} carry source-page chrome, ${salvaged} keep a salvaged seller block. ${
      apply ? "Rows updated." : "No rows written — re-run with --apply."
    }`,
  );
}

// Self-execution guard: only run when this file is the entry point
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
