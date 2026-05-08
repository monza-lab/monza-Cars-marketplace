// scripts/restore-autotrader-active.ts
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load env
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t.slice(eq + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) { console.error("Missing Supabase env"); process.exit(1); }

  const client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Count before
  const { count: before } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("source", "AutoTrader")
    .eq("status", "unsold");
  console.log(`AutoTrader unsold before restore: ${before}`);

  if (!before || before === 0) {
    console.log("Nothing to restore.");
    return;
  }

  // Restore in batches of 200 (smaller to avoid URL length limits)
  let restored = 0;
  while (true) {
    const { data: batch } = await client
      .from("listings")
      .select("id")
      .eq("source", "AutoTrader")
      .eq("status", "unsold")
      .limit(200);

    if (!batch || batch.length === 0) break;

    const ids = batch.map((r) => r.id);
    const { error } = await client
      .from("listings")
      .update({ status: "active", updated_at: new Date().toISOString() })
      .in("id", ids);

    if (error) {
      console.error("Batch update error:", error.message);
      break;
    }
    restored += ids.length;
    console.log(`  Restored ${restored}...`);
  }

  // Count after
  const { count: activeAfter } = await client
    .from("listings")
    .select("*", { count: "exact", head: true })
    .eq("source", "AutoTrader")
    .eq("status", "active");
  console.log(`\nDone. AutoTrader active after restore: ${activeAfter}`);
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
