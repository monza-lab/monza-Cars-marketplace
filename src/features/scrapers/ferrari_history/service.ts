import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  FerrariHistoryInputSchema,
  type FerrariComparableSale,
  type FerrariPriceHistoryEntry,
  type FerrariSoldListing,
} from "./contracts";
import {
  mapToComparableSales,
  mapToPriceHistoryEntries,
  normalizeModel,
  normalizeSoldRows,
} from "./adapters";

type ListingIdentity = {
  id: string;
  make: string;
  model: string;
};

type FerrariHistoryResult = {
  isFerrariContext: boolean;
  soldSeries: FerrariSoldListing[];
  priceHistory: FerrariPriceHistoryEntry[];
  comparables: FerrariComparableSale[];
};

function getSupabaseServerClient(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

async function getListingIdentity(
  client: SupabaseClient,
  listingId: string,
): Promise<ListingIdentity | null> {
  const { data, error } = await client
    .from("listings")
    .select("id,make,model")
    .eq("id", listingId)
    .single();

  if (error || !data) return null;

  return {
    id: data.id,
    make: data.make,
    model: data.model,
  };
}

export async function fetchFerrariHistoricalByModel(
  input: { make: string; model: string; months?: 12; limit?: number },
  options?: { requestId?: string; supabase?: SupabaseClient },
): Promise<FerrariHistoryResult> {
  const make = input.make.trim().toLowerCase();
  if (make !== "ferrari") {
    return {
      isFerrariContext: false,
      soldSeries: [],
      priceHistory: [],
      comparables: [],
    };
  }

  const validatedInput = FerrariHistoryInputSchema.safeParse({
    make,
    model: input.model,
    months: input.months,
    limit: input.limit,
  });

  if (!validatedInput.success) {
    return {
      isFerrariContext: true,
      soldSeries: [],
      priceHistory: [],
      comparables: [],
    };
  }

  const client = options?.supabase ?? getSupabaseServerClient();
  if (!client) {
    return {
      isFerrariContext: true,
      soldSeries: [],
      priceHistory: [],
      comparables: [],
    };
  }

  const cutoffDate = new Date();
  cutoffDate.setMonth(cutoffDate.getMonth() - validatedInput.data.months);

  const { data, error } = await client
    .from("listings")
    .select(
      "id,make,model,status,final_price,hammer_price,end_time,sale_date,original_currency,source,year,mileage,location,source_url",
    )
    .ilike("make", "ferrari")
    .eq("status", "sold")
    .limit(validatedInput.data.limit);

  if (error) {
    console.error("[ferrari_history] listings query failed", {
      reqId: options?.requestId,
      model: validatedInput.data.model,
      message: error.message,
    });
    return {
      isFerrariContext: true,
      soldSeries: [],
      priceHistory: [],
      comparables: [],
    };
  }

  const normalizedModel = normalizeModel(validatedInput.data.model);
  const soldSeries = normalizeSoldRows(data ?? [], normalizedModel, cutoffDate);
  const priceHistory = mapToPriceHistoryEntries(soldSeries);
  const comparables = mapToComparableSales(soldSeries);

  console.info("[ferrari_history] sold series loaded", {
    reqId: options?.requestId,
    model: validatedInput.data.model,
    rows: soldSeries.length,
  });

  return {
    isFerrariContext: true,
    soldSeries,
    priceHistory,
    comparables,
  };
}

export async function fetchFerrariHistoricalByListingId(
  listingIdOrLiveId: string,
  options?: { requestId?: string; supabase?: SupabaseClient },
): Promise<FerrariHistoryResult> {
  const listingId = listingIdOrLiveId.startsWith("live-")
    ? listingIdOrLiveId.slice(5)
    : listingIdOrLiveId;

  const client = options?.supabase ?? getSupabaseServerClient();
  if (!client) {
    return {
      isFerrariContext: false,
      soldSeries: [],
      priceHistory: [],
      comparables: [],
    };
  }

  const listing = await getListingIdentity(client, listingId);
  if (!listing) {
    return {
      isFerrariContext: false,
      soldSeries: [],
      priceHistory: [],
      comparables: [],
    };
  }

  return fetchFerrariHistoricalByModel(
    { make: listing.make, model: listing.model, months: 12, limit: 120 },
    options?.supabase
      ? { requestId: options.requestId, supabase: options.supabase }
      : { requestId: options?.requestId },
  );
}
