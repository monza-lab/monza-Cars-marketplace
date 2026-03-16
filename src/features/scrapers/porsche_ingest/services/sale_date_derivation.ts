import type { CanonicalListing } from "../contracts/listing";

type DeriveOptions = {
  strictMode: boolean;
  soldOnly: boolean;
  cache: Map<string, string | null>;
};

function toDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDateCandidate(value: string): string | null {
  const mmddyy = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mmddyy) {
    const mm = Number(mmddyy[1]);
    const dd = Number(mmddyy[2]);
    const rawYear = Number(mmddyy[3]);
    const yyyy = rawYear < 100 ? 2000 + rawYear : rawYear;
    const parsed = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (Number.isNaN(parsed.getTime())) return null;
    return toDateOnly(parsed);
  }

  const d = new Date(value);
  if (!Number.isNaN(d.getTime())) return toDateOnly(d);
  return null;
}

function extractDateFromText(text: string): string | null {
  const patterns = [
    /sold\s+for[^\n]{0,160}?\son\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i,
    /sold\s+on\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i,
    /auction\s+ended\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})/i,
    /sold\s+for[^\n]{0,160}?\son\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
    /sold\s+on\s+(\d{1,2}\/\d{1,2}\/\d{2,4})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseDateCandidate(match[1].trim());
    if (parsed) return parsed;
  }
  return null;
}

function explicitDateFromListing(listing: CanonicalListing): string | null {
  const raw = listing.raw_payload;
  const candidates: unknown[] = [
    listing.sale_date,
    raw.sale_date,
    raw.saleDate,
    raw.endedAt,
    raw.ended_at,
    raw.soldAt,
    raw.sold_at,
    raw.endDate,
    raw.createdDate,
    raw.modifiedDate,
    raw.created_at,
    raw.updated_at,
  ];
  for (const candidate of candidates) {
    if (typeof candidate !== "string" || !candidate.trim()) continue;
    const parsed = parseDateCandidate(candidate.trim());
    if (parsed) return parsed;
  }
  return null;
}

function textDateFromRawPayload(listing: CanonicalListing): string | null {
  const raw = listing.raw_payload;
  const chunks: string[] = [];
  const stack: unknown[] = [raw];
  let visited = 0;

  while (stack.length > 0 && visited < 1200) {
    visited += 1;
    const item = stack.pop();
    if (typeof item === "string") {
      if (item.length > 4) chunks.push(item);
      continue;
    }
    if (Array.isArray(item)) {
      for (const child of item) stack.push(child);
      continue;
    }
    if (item && typeof item === "object") {
      for (const value of Object.values(item as Record<string, unknown>)) stack.push(value);
    }
  }

  for (const chunk of chunks) {
    const parsed = extractDateFromText(chunk);
    if (parsed) return parsed;
  }
  return null;
}

async function pageDateFallback(url: string, cache: Map<string, string | null>): Promise<string | null> {
  if (cache.has(url)) return cache.get(url) ?? null;
  try {
    const response = await fetch(url);
    if (!response.ok) {
      cache.set(url, null);
      return null;
    }
    const html = await response.text();

    const endDateMatch = html.match(/"endDate"\s*:\s*"([^"]+)"/i);
    if (endDateMatch?.[1]) {
      const parsed = parseDateCandidate(endDateMatch[1]);
      if (parsed) {
        cache.set(url, parsed);
        return parsed;
      }
    }

    const textParsed = extractDateFromText(html);
    if (textParsed) {
      cache.set(url, textParsed);
      return textParsed;
    }

    cache.set(url, null);
    return null;
  } catch {
    cache.set(url, null);
    return null;
  }
}

export async function deriveSaleDate(listing: CanonicalListing, options: DeriveOptions): Promise<string | null> {
  if (!options.strictMode || !options.soldOnly) {
    const explicit = explicitDateFromListing(listing);
    if (explicit) return explicit;
    return toDateOnly(new Date());
  }
  if (listing.sale_date) return listing.sale_date;

  const explicit = explicitDateFromListing(listing);
  if (explicit) return explicit;

  const fromPayloadText = textDateFromRawPayload(listing);
  if (fromPayloadText) return fromPayloadText;

  if (listing.source === "BaT" && listing.source_url) {
    return await pageDateFallback(listing.source_url, options.cache);
  }

  return null;
}

export const __testables = {
  extractDateFromText,
  parseDateCandidate,
};
