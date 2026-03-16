import {
  ComparableSaleSchema,
  FerrariSoldListingRowSchema,
  FerrariSoldListingSchema,
  PriceHistoryEntrySchema,
  type FerrariComparableSale,
  type FerrariPriceHistoryEntry,
  type FerrariSoldListing,
  type FerrariSoldListingRow,
} from "./contracts";

function normalizeText(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function parsePositivePrice(value: number | string | null): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) && value > 0 ? value : null;
  }

  if (typeof value === "string") {
    const parsed = Number(value.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  }

  return null;
}

function resolveSoldAt(row: FerrariSoldListingRow): string | null {
  const raw = row.end_time ?? row.sale_date;
  if (!raw) return null;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

export function normalizeSoldRows(
  rows: unknown[],
  normalizedModel: string,
  cutoffDate: Date,
): FerrariSoldListing[] {
  const validRows: FerrariSoldListingRow[] = [];

  for (const row of rows) {
    const parsed = FerrariSoldListingRowSchema.safeParse(row);
    if (parsed.success) validRows.push(parsed.data);
  }

  const normalized: FerrariSoldListing[] = [];

  for (const row of validRows) {
    const status = normalizeText(row.status);
    if (status !== "sold") continue;

    const soldAt = resolveSoldAt(row);
    if (!soldAt) continue;

    const soldPrice = parsePositivePrice(row.final_price ?? row.hammer_price);
    if (!soldPrice) continue;

    const model = normalizeText(row.model);
    if (model !== normalizedModel) continue;

    const soldAtDate = new Date(soldAt);
    if (soldAtDate < cutoffDate) continue;

    const normalizedRow = FerrariSoldListingSchema.safeParse({
      id: row.id,
      make: row.make,
      model: row.model,
      sold_price: soldPrice,
      sold_at: soldAt,
      currency: row.original_currency ?? "USD",
      source_platform: row.source,
      year: row.year,
      mileage: row.mileage,
      location: row.location,
      listing_url: row.source_url,
    });

    if (normalizedRow.success) {
      normalized.push(normalizedRow.data);
    }
  }

  normalized.sort((a, b) => {
    const timeDiff = new Date(a.sold_at).getTime() - new Date(b.sold_at).getTime();
    if (timeDiff !== 0) return timeDiff;
    return a.id.localeCompare(b.id);
  });

  const deduped: FerrariSoldListing[] = [];
  const seenIds = new Set<string>();
  for (const row of normalized) {
    if (seenIds.has(row.id)) continue;
    seenIds.add(row.id);
    deduped.push(row);
  }

  return deduped;
}

export function mapToPriceHistoryEntries(
  rows: FerrariSoldListing[],
): FerrariPriceHistoryEntry[] {
  const entries: FerrariPriceHistoryEntry[] = [];

  for (const row of rows) {
    const parsed = PriceHistoryEntrySchema.safeParse({
      id: `sold-${row.id}`,
      bid: row.sold_price,
      timestamp: row.sold_at,
    });
    if (parsed.success) entries.push(parsed.data);
  }

  return entries;
}

export function mapToComparableSales(
  rows: FerrariSoldListing[],
): FerrariComparableSale[] {
  const comparables: FerrariComparableSale[] = [];

  for (const row of rows.slice(-8).reverse()) {
    const parsed = ComparableSaleSchema.safeParse({
      title: row.year ? `${row.year} ${row.make} ${row.model}` : `${row.make} ${row.model}`,
      soldPrice: row.sold_price,
      soldDate: row.sold_at.slice(0, 10),
      platform: row.source_platform ?? "Market Sale",
      mileage: row.mileage,
      url: row.listing_url,
    });
    if (parsed.success) comparables.push(parsed.data);
  }

  return comparables;
}

export function normalizeModel(value: string): string {
  return normalizeText(value);
}
