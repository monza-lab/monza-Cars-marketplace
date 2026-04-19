import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const TERMINAL_STATUSES = new Set(["sold", "unsold", "delisted"]);

type ListingsReadClient = Pick<SupabaseClient, "from">;

export function createTerminalStatusClient(): ListingsReadClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export async function fetchTerminalStatusSourceIds(
  client: ListingsReadClient | null,
  sourceIds: readonly string[],
): Promise<Set<string>> {
  const uniqueSourceIds = Array.from(new Set(sourceIds.filter(Boolean)));
  if (!client || uniqueSourceIds.length === 0) {
    return new Set();
  }

  const { data, error } = await client
    .from("listings")
    .select("source_id,status")
    .in("source_id", uniqueSourceIds)
    .limit(uniqueSourceIds.length);

  if (error) {
    throw new Error(`Supabase terminal status batch lookup failed: ${error.message}`);
  }

  const terminalSourceIds = new Set<string>();
  for (const row of (data ?? []) as Array<{ source_id: string | null; status: string | null }>) {
    if (row.source_id && row.status && TERMINAL_STATUSES.has(row.status)) {
      terminalSourceIds.add(row.source_id);
    }
  }

  return terminalSourceIds;
}
