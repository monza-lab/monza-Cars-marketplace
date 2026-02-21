import { fetchApifyDatasetItems } from "./apify";

export type SourceKey = "bat" | "carsandbids" | "autoscout24" | "classiccars";

export const SOURCE_NAME: Record<SourceKey, "BaT" | "CarsAndBids" | "AutoScout24" | "ClassicCars"> = {
  bat: "BaT",
  carsandbids: "CarsAndBids",
  autoscout24: "AutoScout24",
  classiccars: "ClassicCars",
};

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
  since?: string;
  from?: string;
}): Promise<Record<string, unknown>[]> {
  const token = process.env.APIFY_TOKEN;
  if (!token) throw new Error("Missing APIFY_TOKEN");

  const actorId = process.env[actorEnvKey(input.source)];
  if (!actorId) throw new Error(`Missing ${actorEnvKey(input.source)}`);

  const actorInput: Record<string, unknown> =
    input.source === "bat"
      ? buildBatInput(input.limit, { activeOnly: input.activeOnly, soldOnly: input.soldOnly })
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
    limit: input.limit,
  });
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
  filters?: { activeOnly?: boolean; soldOnly?: boolean },
): { startUrl: string; maxItems: number } {
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
