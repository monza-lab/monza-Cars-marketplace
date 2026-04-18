import { createClient } from "@supabase/supabase-js";
import type { ListingRow } from "../types";
import {
  ALLOWED_PLATFORMS,
  COLLECTOR_TRIM_REGEX,
  COLLECTOR_SERIES_IDS,
  GATE_1,
  WORKER,
} from "../config";
import { extractSeries } from "@/lib/brandConfig";

const COLLECTOR_SERIES_IDS_SET = new Set<string>(COLLECTOR_SERIES_IDS);

export function matchesCollectorThesis(l: ListingRow): boolean {
  const trim = (l.trim ?? "").trim();
  const title = (l.title ?? "").trim();
  if (trim && COLLECTOR_TRIM_REGEX.test(trim)) return true;

  if (title && /\bGT3\b|\bGT2\b|\bCarrera RS\b|\bSpeedster\b|\bCarrera GT\b|\bSinger\b/i.test(title)) return true;

  if (l.make === "Porsche" && l.model && l.year) {
    const series = extractSeries(l.model, l.year, l.make);
    if (series && COLLECTOR_SERIES_IDS_SET.has(series)) return true;
  }

  return false;
}

export function computeQualityScore(l: ListingRow): number {
  let score = 0;
  if (l.platform === "ELFERSPOT") score += 40;
  else if (l.platform === "BRING_A_TRAILER") score += 32;
  else if (l.platform === "AUTO_SCOUT_24") score += 20;

  const fields: (keyof ListingRow)[] = [
    "engine", "transmission", "mileage", "color_exterior", "location",
  ];
  for (const f of fields) if (l[f] != null && l[f] !== "") score += 8;

  if (l.photos_count != null) {
    score += Math.min(20, Math.floor((l.photos_count / 50) * 20));
  }
  return Math.min(100, score);
}

function makeClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
}

export async function fetchGate1Candidates(): Promise<ListingRow[]> {
  const supa = makeClient();
  const cutoff = new Date(Date.now() - GATE_1.lookbackDays * 864e5).toISOString();

  const { data, error } = await supa
    .from("listings")
    .select(
      "id, title, year, make, model, trim, platform, status, photos_count, data_quality_score, images, final_price, current_bid, engine, transmission, mileage, color_exterior, color_interior, location, reserve_status, seller_notes, created_at",
    )
    .eq("status", "active")
    .in("platform", ALLOWED_PLATFORMS as unknown as string[])
    .gte("photos_count", GATE_1.minPhotosCount)
    .gte("data_quality_score", GATE_1.minDataQualityScore)
    .gte("created_at", cutoff)
    .eq("make", "Porsche")
    .order("data_quality_score", { ascending: false })
    .limit(WORKER.maxCandidatesFromGate1 * 3);
  if (error) throw error;

  const listingIds = (data ?? []).map((r) => r.id);
  if (listingIds.length === 0) return [];

  const { data: existing, error: e2 } = await supa
    .from("social_post_drafts")
    .select("listing_id")
    .in("listing_id", listingIds);
  if (e2) throw e2;
  const existingIds = new Set((existing ?? []).map((r) => r.listing_id));

  const filtered = (data ?? [])
    .filter((r) => !existingIds.has(r.id))
    .filter((r) => matchesCollectorThesis(r as ListingRow));

  return filtered
    .map((r) => ({ row: r as ListingRow, score: computeQualityScore(r as ListingRow) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, WORKER.maxCandidatesFromGate1)
    .map((x) => x.row);
}
