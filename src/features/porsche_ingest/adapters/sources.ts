import { fetchApifyDatasetItems } from "./apify";

export type SourceKey = "bat" | "carsandbids" | "autoscout24" | "classiccars";

export const SOURCE_NAME: Record<SourceKey, "BaT" | "CarsAndBids" | "AutoScout24" | "ClassicCars"> = {
  bat: "BaT",
  carsandbids: "CarsAndBids",
  autoscout24: "AutoScout24",
  classiccars: "ClassicCars",
};

const AUTOSCOUT24_PORSCHE_EUROPE_URL =
  "https://www.autoscout24.com/lst/porsche?sort=age&desc=1&ustate=N%2CU&atype=C&cy=D%2CA%2CI%2CB%2CNL%2CE%2CL%2CF&source=homepage_search-mask";
const AUTOSCOUT24_COUNTRY_CODES = ["D", "A", "I", "B", "NL", "E", "L", "F"] as const;

function actorEnvKey(source: SourceKey): string {
  if (source === "bat") return "APIFY_BAT_ACTOR_ID";
  if (source === "carsandbids") return "APIFY_CARSANDBIDS_ACTOR_ID";
  if (source === "autoscout24") return "APIFY_AUTOSCOUT24_ACTOR_ID";
  return "APIFY_CLASSICCARS_ACTOR_ID";
}

export async function fetchSourceItems(input: {
  source: SourceKey;
  mode: "sample" | "incremental" | "backfill";
  limit: number;
  activeOnly?: boolean;
  soldOnly?: boolean;
  batStartUrl?: string;
  batMaxItems?: number;
  since?: string;
  from?: string;
  autoscoutCountry?: string;
}): Promise<Record<string, unknown>[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Missing APIFY_TOKEN");

  const actorId = process.env[actorEnvKey(input.source)];
  if (!actorId) throw new Error(`Missing ${actorEnvKey(input.source)}`);

  const effectiveLimit = input.source === "bat" && input.batMaxItems ? input.batMaxItems : input.limit;

  const actorInput: Record<string, unknown> =
    input.source === "bat"
      ? buildBatInput(effectiveLimit, {
          activeOnly: input.activeOnly,
          soldOnly: input.soldOnly,
          startUrlOverride: input.batStartUrl,
        })
      : input.source === "autoscout24"
        ? buildAutoScout24Input(input.mode, input.limit, { country: input.autoscoutCountry })
        : {
            query: "Porsche",
            make: "Porsche",
            mode: input.mode,
            limit: input.limit,
            from: input.from,
            since: input.since,
            porscheOnly: true,
          };

  if (input.source === "carsandbids") {
    actorInput.urls = buildCarsAndBidsUrls(input.mode, input.limit).map((url) => ({ url }));
    actorInput.maxItems = input.limit;
    actorInput.maxChargedResults = input.limit;
  }

  return await fetchApifyDatasetItems({
    actorId,
    token,
    actorInput,
    limit: effectiveLimit,
  });
}

export function buildAutoScout24Input(
  mode: "sample" | "incremental" | "backfill",
  limit: number,
  options: { country?: string } = {},
): {
  startUrls: string[];
  resultLimitPerThread: number;
  maxChargedResults: number;
  reviewLimit: number;
  lightningMode: boolean;
  customRunFailureThresholdPercent: number;
} {
  const sortedByNewest = mode === "backfill" ? "sort=standard" : "sort=age";
  const baseUrl = AUTOSCOUT24_PORSCHE_EUROPE_URL.replace("sort=age", sortedByNewest);
  const scopedCountry = options.country?.toUpperCase();
  if (scopedCountry && !AUTOSCOUT24_COUNTRY_CODES.includes(scopedCountry as (typeof AUTOSCOUT24_COUNTRY_CODES)[number])) {
    throw new Error(`Unsupported AutoScout24 country shard: ${scopedCountry}`);
  }
  const shardCountries = scopedCountry ? [scopedCountry] : [...AUTOSCOUT24_COUNTRY_CODES];
  const startUrls = mode === "sample"
    ? [baseUrl]
    : shardCountries.map((countryCode) => baseUrl.replace("cy=D%2CA%2CI%2CB%2CNL%2CE%2CL%2CF", `cy=${countryCode}`));
  const clampedLimit = Math.max(1, Math.min(4000, Math.ceil(limit / startUrls.length)));
  return {
    startUrls,
    resultLimitPerThread: clampedLimit,
    maxChargedResults: Math.max(1, limit),
    reviewLimit: 0,
    lightningMode: true,
    customRunFailureThresholdPercent: 50,
  };
}

export function buildCarsAndBidsUrls(mode: "sample" | "incremental" | "backfill", limit: number): string[] {
  const base = [
    "https://carsandbids.com/auctions",
    "https://carsandbids.com/auctions/past",
  ];
  if (mode === "backfill") {
    const pages = Math.max(2, Math.min(10, Math.ceil(limit / 50)));
    for (let page = 2; page <= pages; page += 1) {
      base.push(`https://carsandbids.com/auctions/past?page=${page}`);
    }
  }
  return base;
}

export function buildBatInput(
  limit: number,
  filters?: { activeOnly?: boolean; soldOnly?: boolean; startUrlOverride?: string },
): { startUrl: string; maxItems: number } {
  if (filters?.startUrlOverride) {
    return { startUrl: filters.startUrlOverride, maxItems: Math.max(1, limit) };
  }
  const startUrl = filters?.activeOnly
    ? "https://bringatrailer.com/auctions/"
    : filters?.soldOnly
      ? "https://bringatrailer.com/auctions/?search=Porsche&result=sold"
      : "https://bringatrailer.com/auctions/?search=Porsche";
  return {
    startUrl,
    maxItems: Math.max(1, limit),
  };
}
