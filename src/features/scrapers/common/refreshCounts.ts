import type { SupabaseClient } from "@supabase/supabase-js";

export async function refreshListingsActiveCounts(supabase: SupabaseClient): Promise<void> {
  const { error } = await supabase.rpc("refresh_listings_active_counts");
  if (error) {
    // Do not throw — refresh is non-critical. Log and move on.
    console.error("[refreshListingsActiveCounts] failed:", error.message);
  }
}
