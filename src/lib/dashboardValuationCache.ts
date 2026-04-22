import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { resolveRequestedMake } from "./makeProfiles";
import { computeSegmentStats } from "./pricing/segmentStats";
import type { CanonicalMarket, DerivedPrice, SegmentStats } from "./pricing/types";

const SUPABASE_TIMEOUT_MS = 30_000;
const DASHBOARD_VALUATION_TABLE = "dashboard_valuation_by_family";
const MARKETS: readonly CanonicalMarket[] = ["US", "EU", "UK", "JP"] as const;

export type RegionalValByFamily = Record<string, Record<CanonicalMarket, SegmentStats>>;

function createSupabaseClient(url: string, key: string, options: { timeoutMs?: number; signal?: AbortSignal } = {}): SupabaseClient {
  const timeoutMs = options.timeoutMs ?? SUPABASE_TIMEOUT_MS;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const externalAbort = () => controller.abort();

        if (options.signal) {
          if (options.signal.aborted) {
            controller.abort();
          } else {
            options.signal.addEventListener("abort", externalAbort, { once: true });
          }
        }

        return fetch(input, {
          ...init,
          signal: controller.signal,
        }).finally(() => {
          clearTimeout(timeoutId);
          if (options.signal) {
            options.signal.removeEventListener("abort", externalAbort);
          }
        });
      },
    },
  });
}

export function aggregateRegionalValuationByFamily(prices: DerivedPrice[]): RegionalValByFamily {
  const families = Array.from(
    new Set(prices.map((price) => price.family).filter((family): family is string => !!family)),
  );
  const out: RegionalValByFamily = {};

  for (const family of families) {
    const perMarket = {} as Record<CanonicalMarket, SegmentStats>;
    for (const market of MARKETS) {
      perMarket[market] = computeSegmentStats(prices, { market, family });
    }
    out[family] = perMarket;
  }

  return out;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isCanonicalMarket(value: unknown): value is CanonicalMarket {
  return value === "US" || value === "EU" || value === "UK" || value === "JP";
}

function isConfidenceTier(value: unknown): value is SegmentStats["marketValue"]["tier"] {
  return value === "high" || value === "medium" || value === "low" || value === "insufficient";
}

function isFactorSource(value: unknown): value is SegmentStats["askMedian"]["factorSource"] {
  return value === "family" || value === "porsche_wide" || value === "none";
}

function isNumberOrNull(value: unknown): value is number | null {
  return value === null || (typeof value === "number" && Number.isFinite(value));
}

function isValidSegmentStats(value: unknown): value is SegmentStats {
  if (!isObject(value)) return false;
  if (!isCanonicalMarket(value.market)) return false;
  if (typeof value.family !== "string" || value.family.length === 0) return false;

  const marketValue = value.marketValue;
  const askMedian = value.askMedian;
  if (!isObject(marketValue) || !isObject(askMedian)) return false;

  return (
    isNumberOrNull(marketValue.valueUsd) &&
    isNumberOrNull(marketValue.p25Usd) &&
    isNumberOrNull(marketValue.p75Usd) &&
    typeof marketValue.soldN === "number" &&
    Number.isInteger(marketValue.soldN) &&
    marketValue.soldN >= 0 &&
    isConfidenceTier(marketValue.tier) &&
    isNumberOrNull(askMedian.valueUsd) &&
    isNumberOrNull(askMedian.rawMedianUsd) &&
    isNumberOrNull(askMedian.p25Usd) &&
    isNumberOrNull(askMedian.p75Usd) &&
    typeof askMedian.askingN === "number" &&
    Number.isInteger(askMedian.askingN) &&
    askMedian.askingN >= 0 &&
    (askMedian.factorApplied === null || (typeof askMedian.factorApplied === "number" && Number.isFinite(askMedian.factorApplied))) &&
    isFactorSource(askMedian.factorSource) &&
    isConfidenceTier(askMedian.tier)
  );
}

export function isRegionalValByFamily(value: unknown): value is RegionalValByFamily {
  if (!isObject(value)) return false;
  if (Object.keys(value).length === 0) return false;

  for (const familyVal of Object.values(value)) {
    if (!isObject(familyVal)) return false;
    for (const market of MARKETS) {
      if (!isValidSegmentStats(familyVal[market])) return false;
    }
  }

  return true;
}

function isMissingValuationTableError(errorMessage: string): boolean {
  return /(relation.*dashboard_valuation_by_family.*does not exist)|(could not find the table)/i.test(
    errorMessage,
  );
}

export async function fetchDashboardRegionalValuationByFamily(
  make: string,
  options?: { timeoutMs?: number; signal?: AbortSignal },
): Promise<RegionalValByFamily | null> {
  const normalizedMake = resolveRequestedMake(make);
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) return null;

  const supabase = createSupabaseClient(url, key, {
    timeoutMs: options?.timeoutMs,
    signal: options?.signal,
  });

  try {
    const { data, error } = await supabase
      .from(DASHBOARD_VALUATION_TABLE)
      .select("regional_val_by_family")
      .eq("make", normalizedMake)
      .maybeSingle();

    if (error) {
      const message = error.message ?? String(error);
      if (isMissingValuationTableError(message)) {
        console.warn(
          "[dashboardValuationCache] dashboard_valuation_by_family table missing — apply the migration and run the refresh cron.",
        );
        return null;
      }

      console.error("[dashboardValuationCache] cached valuation query failed:", message);
      return null;
    }

    const payload = data?.regional_val_by_family;
    if (!isRegionalValByFamily(payload)) {
      return null;
    }

    return payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboardValuationCache] cached valuation query threw:", message);
    return null;
  }
}

export async function storeDashboardRegionalValuationByFamily(
  supabase: SupabaseClient,
  make: string,
  prices: DerivedPrice[],
): Promise<void> {
  const normalizedMake = resolveRequestedMake(make);
  const payload = {
    make: normalizedMake,
    regional_val_by_family: aggregateRegionalValuationByFamily(prices),
    source_row_count: prices.length,
    refreshed_at: new Date().toISOString(),
  };

  try {
    const { error } = await supabase
      .from(DASHBOARD_VALUATION_TABLE)
      .upsert(payload, { onConflict: "make" });

    if (error) {
      const message = error.message ?? String(error);
      if (isMissingValuationTableError(message)) {
        console.warn(
          "[dashboardValuationCache] dashboard_valuation_by_family table missing — apply the migration before refreshing.",
        );
        return;
      }

      console.error("[dashboardValuationCache] cached valuation refresh failed:", message);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[dashboardValuationCache] cached valuation refresh threw:", message);
  }
}
