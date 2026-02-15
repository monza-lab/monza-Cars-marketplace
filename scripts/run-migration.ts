/**
 * Runs the listings alignment migration via Supabase's SQL API.
 * Usage: npx tsx scripts/run-migration.ts
 */
import "dotenv/config";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const sqlPath = resolve(__dirname, "../supabase/migrations/20260215_align_listings_with_auction_model.sql");
const sql = readFileSync(sqlPath, "utf-8");

// Split into individual statements and run sequentially
// (Supabase REST SQL endpoint handles multi-statement, but let's be safe)
const REST_URL = `${SUPABASE_URL}/rest/v1/rpc/`;

async function runSQL(statement: string): Promise<void> {
  const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: SERVICE_KEY!,
      Authorization: `Bearer ${SERVICE_KEY}`,
      Prefer: "return=minimal",
    },
    body: JSON.stringify({ query: statement }),
  });

  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`SQL failed (${resp.status}): ${text}`);
  }
}

// Use the Supabase management API for raw SQL
async function runMigration() {
  // Extract project ref from URL
  const match = SUPABASE_URL!.match(/https:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    console.error("Could not extract project ref from URL");
    process.exit(1);
  }

  // Use the PostgREST SQL endpoint via pg_net or direct
  // Actually, the simplest way is via the Supabase client's from().rpc()
  // But for raw DDL, we need the management API or direct connection.
  // Let's use the Supabase management API with the service role key.

  // Alternative: use createClient and call individual statements
  const { createClient } = await import("@supabase/supabase-js");
  const client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
    db: { schema: "public" },
  });

  // Split SQL into individual statements
  const statements = sql
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith("--"));

  console.log(`Running ${statements.length} SQL statements...`);

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    const preview = stmt.slice(0, 80).replace(/\n/g, " ");
    console.log(`  [${i + 1}/${statements.length}] ${preview}...`);

    const { error } = await client.rpc("exec_sql", { sql_text: stmt + ";" });
    if (error) {
      // Try alternative: some Supabase instances don't have exec_sql
      console.warn(`    rpc exec_sql failed: ${error.message}`);
      console.warn(`    Trying raw query fallback...`);

      // Use the pg REST query endpoint
      const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SERVICE_KEY!,
          Authorization: `Bearer ${SERVICE_KEY}`,
        },
        body: JSON.stringify({ sql_text: stmt + ";" }),
      });

      if (!resp.ok) {
        console.error(`    Also failed via REST: ${await resp.text()}`);
        console.error(`\n⚠️  You'll need to run this SQL manually in the Supabase SQL Editor.`);
        console.error(`    File: supabase/migrations/20260215_align_listings_with_auction_model.sql\n`);
        process.exit(1);
      }
    }
    console.log(`    ✓ done`);
  }

  console.log("\n✅ Migration complete!");
}

runMigration().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
