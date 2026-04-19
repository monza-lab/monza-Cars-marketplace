import { toUsd } from "@/lib/exchangeRates";
import { extractSeries, getSeriesConfig } from "@/lib/brandConfig";
import type { DerivedPrice } from "./types";
import { sourceToCanonicalMarket, isAuctionSource } from "./canonicalMarket";

export interface RawListing {
  source: string;
  status: string | null;
  year: number;
  make: string;
  model: string;
  hammer_price: number | null;
  final_price: number | null;
  current_bid: number | null;
  original_currency: string | null;
}

interface DeriveContext {
  rates: Record<string, number>;
}

function pickRawAmount(row: RawListing): number | null {
  if (row.hammer_price != null && row.hammer_price > 0) return row.hammer_price;
  if (row.final_price != null && row.final_price > 0) return row.final_price;
  if (row.current_bid != null && row.current_bid > 0) return row.current_bid;
  return null;
}

function isSold(row: RawListing): boolean {
  if (row.status !== "sold") return false;
  if (isAuctionSource(row.source)) return true;
  if (row.source === "BeForward") return true;
  return false;
}

function extractFamily(row: RawListing): string | null {
  const series = extractSeries(row.model, row.year, row.make);
  if (!series) return null;
  const config = getSeriesConfig(series, row.make);
  return series || config?.family || null;
}

export function derivePrice(row: RawListing, ctx: DeriveContext): DerivedPrice {
  const market = sourceToCanonicalMarket(row.source);
  const family = extractFamily(row);
  const raw = pickRawAmount(row);
  if (raw == null) {
    return { soldPriceUsd: null, askingPriceUsd: null, basis: "unknown", canonicalMarket: market, family };
  }
  const usd = toUsd(raw, row.original_currency, ctx.rates);
  if (!(usd > 0)) {
    return { soldPriceUsd: null, askingPriceUsd: null, basis: "unknown", canonicalMarket: market, family };
  }
  if (market === null) {
    return { soldPriceUsd: null, askingPriceUsd: null, basis: "unknown", canonicalMarket: null, family };
  }
  if (isSold(row)) {
    return { soldPriceUsd: usd, askingPriceUsd: null, basis: "sold", canonicalMarket: market, family };
  }
  return { soldPriceUsd: null, askingPriceUsd: usd, basis: "asking", canonicalMarket: market, family };
}
