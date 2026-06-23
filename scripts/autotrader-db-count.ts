import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
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

loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFromFile(path.resolve(process.cwd(), ".env"));

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const client = createClient(url, key, { auth: { persistSession: false } });

async function countWhere(filters: (q: any) => any): Promise<number> {
  const { count, error } = await filters(
    client.from("listings").select("*", { count: "exact", head: true }).eq("source", "AutoTrader")
  );
  if (error) throw error;
  return count ?? 0;
}

(async () => {
  const total = await countWhere((q) => q);
  const active = await countWhere((q) => q.eq("status", "active"));
  const sold = await countWhere((q) => q.eq("status", "sold"));
  const delisted = await countWhere((q) => q.eq("status", "delisted"));

  // distinct statuses present
  const { data: statusRows } = await client
    .from("listings")
    .select("status")
    .eq("source", "AutoTrader")
    .limit(5000);
  const byStatus: Record<string, number> = {};
  for (const r of statusRows ?? []) byStatus[(r as any).status ?? "null"] = (byStatus[(r as any).status ?? "null"] ?? 0) + 1;

  console.log(JSON.stringify({ source: "AutoTrader", total, active, sold, delisted, statusBreakdownSample: byStatus }, null, 2));
})().catch((e) => {
  console.error("ERROR:", e.message ?? e);
  process.exit(1);
});
