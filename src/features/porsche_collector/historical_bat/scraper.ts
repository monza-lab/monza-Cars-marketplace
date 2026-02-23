import type { BatCompletedItem, BatCompletedPayload } from "./parse_embedded_data";

export type HistoricalBatListing = {
  source: "BaT";
  source_id: string;
  source_url: string;
  title: string;
  make: "Porsche";
  model: string;
  year: number | null;
  status: "sold" | "unsold";
  sale_date: string | null;
  sale_date_confidence: "explicit" | "sold_text" | "timestamp_end" | "none";
  current_bid: number | null;
  currency: string | null;
  raw_payload: Record<string, unknown>;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchWithRetry(url: string): Promise<Response> {
  let last: Response | null = null;
  for (let attempt = 1; attempt <= 5; attempt += 1) {
    const response = await fetch(url);
    if (response.ok) return response;
    last = response;
    const retryable = response.status === 429 || (response.status >= 500 && response.status <= 599);
    if (!retryable || attempt === 5) break;
    const delayMs = 500 * attempt;
    await sleep(delayMs);
  }
  if (last) return last;
  throw new Error(`BaT endpoint fetch failed for ${url}`);
}

function toDateOnly(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function parseDateAny(value: unknown): string | null {
  if (typeof value !== "string" && typeof value !== "number") return null;
  const text = String(value).trim();
  if (!text) return null;

  const mmddyy = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (mmddyy) {
    const mm = Number(mmddyy[1]);
    const dd = Number(mmddyy[2]);
    const rawYear = Number(mmddyy[3]);
    const yyyy = rawYear < 100 ? 2000 + rawYear : rawYear;
    const date = new Date(Date.UTC(yyyy, mm - 1, dd));
    if (!Number.isNaN(date.getTime())) return toDateOnly(date);
  }

  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return null;
  return toDateOnly(date);
}

function soldDateFromSoldText(soldText: string): string | null {
  const patterns = [
    /\bon\s+(\d{1,2}\/\d{1,2}\/\d{2,4})\b/i,
    /\bon\s+([A-Za-z]{3,9}\s+\d{1,2},\s+\d{4})\b/i,
  ];
  for (const pattern of patterns) {
    const match = soldText.match(pattern);
    if (!match?.[1]) continue;
    const parsed = parseDateAny(match[1]);
    if (parsed) return parsed;
  }
  return null;
}

function numberFromUnknown(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const numeric = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function modelFromTitle(title: string): string {
  const cleaned = title.replace(/\b(19\d{2}|20\d{2})\b/g, "").replace(/porsche/gi, "").trim();
  return cleaned.split(" ").filter(Boolean).slice(0, 3).join(" ") || "Unknown";
}

function yearFromTitle(title: string): number | null {
  const match = title.match(/\b(19\d{2}|20\d{2})\b/);
  if (!match) return null;
  return Number(match[1]);
}

function deriveSoldStatus(item: BatCompletedItem): "sold" | "unsold" {
  const soldText = String(item.sold_text ?? item.soldText ?? "").toLowerCase();
  if (soldText.includes("bid to") || soldText.includes("unsold") || soldText.includes("no sale")) return "unsold";
  return "sold";
}

export function mapCompletedItem(item: BatCompletedItem): HistoricalBatListing {
  const title = String(item.title ?? "").trim();
  const sourceId = String(item.id ?? item.auctionId ?? item.listingId ?? item.url ?? "");
  const sourceUrl = String(item.url ?? item.auctionUrl ?? "").trim();
  const soldText = String(item.sold_text ?? item.soldText ?? "").trim();

  const explicitSoldDate = parseDateAny(item.sale_date ?? item.sold_date ?? item.date_end ?? item.end_date);
  const soldTextDate = soldText ? soldDateFromSoldText(soldText) : null;
  const timestampDate = parseDateAny(item.timestamp_end ?? item.endTimestamp);

  let saleDate: string | null = null;
  let confidence: HistoricalBatListing["sale_date_confidence"] = "none";
  if (explicitSoldDate) {
    saleDate = explicitSoldDate;
    confidence = "explicit";
  } else if (soldTextDate) {
    saleDate = soldTextDate;
    confidence = "sold_text";
  } else if (timestampDate) {
    saleDate = timestampDate;
    confidence = "timestamp_end";
  }

  return {
    source: "BaT",
    source_id: sourceId,
    source_url: sourceUrl,
    title,
    make: "Porsche",
    model: String(item.model ?? modelFromTitle(title) ?? "Unknown"),
    year: typeof item.year === "number" ? item.year : yearFromTitle(title),
    status: deriveSoldStatus(item),
    sale_date: saleDate,
    sale_date_confidence: confidence,
    current_bid: numberFromUnknown(item.current_bid ?? item.currentBid),
    currency: String(item.currency ?? "").trim() || null,
    raw_payload: item as Record<string, unknown>,
  };
}

export async function fetchCompletedPage(input: {
  timeFrame: string;
  page: number;
}): Promise<{ payload: BatCompletedPayload; url: string }> {
  const apiUrl =
    `https://bringatrailer.com/wp-json/bringatrailer/1.0/data/listings-filter` +
    `?page=${input.page}` +
    `&per_page=24` +
    `&get_items=1` +
    `&get_stats=0` +
    `&base_filter%5Bkeyword_s%5D=Porsche` +
    `&base_filter%5Bitems_type%5D=make` +
    `&sort=td` +
    `&recency=${encodeURIComponent(input.timeFrame)}`;

  const apiResponse = await fetchWithRetry(apiUrl);
  if (!apiResponse.ok) {
    throw new Error(`BaT endpoint fetch failed (${apiResponse.status}) for ${apiUrl}`);
  }

  const json = await apiResponse.json() as BatCompletedPayload;
  return {
    payload: {
      page_current: Number(json.page_current ?? input.page),
      pages_total: Number(json.pages_total ?? input.page),
      items_total: Number(json.items_total ?? 0),
      items: Array.isArray(json.items) ? json.items : [],
    },
    url: apiUrl,
  };
}
