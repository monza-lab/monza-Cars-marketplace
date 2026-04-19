import * as cheerio from "cheerio";
import { fetchHtml } from "./net";
import { extractAutoTraderImages, normalizeAutoTraderImageUrl } from "./imageUrls";
import { fetchAutoTraderSearchListing } from "./searchResults";

export interface AutoTraderDetailParsed {
  title: string | null;
  price: number | null;
  priceText: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  description: string | null;
  images: string[];
  vin: string | null;
  exteriorColor: string | null;
  interiorColor: string | null;
  transmission: string | null;
  engine: string | null;
  bodyStyle: string | null;
}

interface AutoTraderProductPageImage {
  url?: string | null;
  classificationTags?: Array<{
    label?: string | null;
    category?: string | null;
  }> | null;
}

interface AutoTraderProductPageSpecItem {
  label?: string | null;
  value?: string | null;
  info?: string | null;
  specKey?: string | null;
}

interface AutoTraderProductPagePayload {
  id?: string | null;
  gallery?: {
    title?: string | null;
    price?: string | null;
    images?: AutoTraderProductPageImage[] | null;
  } | null;
  heading?: {
    title?: string | null;
    subTitle?: string | null;
    priceBreakdown?: {
      price?: {
        price?: number | null;
        priceFormatted?: string | null;
      } | null;
    } | null;
    headingPills?: Array<{ label?: string | null } | null> | null;
  } | null;
  keySpecification?: AutoTraderProductPageSpecItem[] | null;
  overview?: {
    keySpecification?: AutoTraderProductPageSpecItem[] | null;
  } | null;
  overviewV2?: {
    keySpecification?: AutoTraderProductPageSpecItem[] | null;
  } | null;
  keyInformation?: {
    title?: string | null;
    subTitle?: string | null;
    marketExtensionHeaderTitle?: string | null;
    marketExtensionHeaderDescription?: string | null;
  } | null;
  pageMetaData?: {
    pageTitle?: string | null;
    pageDescription?: string | null;
    mainImageUrl?: string | null;
  } | null;
  description?: {
    title?: string | null;
    text?: string[] | null;
    strapline?: string | null;
    vehicleRegistration?: string | null;
  } | null;
}

/**
 * Fetch an AutoTrader listing detail page and extract structured data.
 * Returns all-null fields on any error (does not throw).
 */
export async function fetchAutoTraderDetail(
  url: string,
  timeoutMs = 15_000
): Promise<AutoTraderDetailParsed> {
  const empty: AutoTraderDetailParsed = {
    title: null,
    price: null,
    priceText: null,
    mileage: null,
    mileageUnit: null,
    location: null,
    description: null,
    images: [],
    vin: null,
    exteriorColor: null,
    interiorColor: null,
    transmission: null,
    engine: null,
    bodyStyle: null,
  };

  try {
    const [payload, html] = await Promise.all([
      fetchAutoTraderProductPagePayload(url, timeoutMs).catch(() => null),
      fetchHtml(url, timeoutMs).catch(() => null),
    ]);

    const structured = payload ? parseAutoTraderProductPagePayload(payload) : null;
    const parsedHtml = html ? parseAutoTraderHtml(html) : null;
    const advertId = extractAdvertId(url);

    if (structured || parsedHtml) {
      const merged: AutoTraderDetailParsed = {
        ...empty,
        ...parsedHtml,
        ...structured,
        title: structured?.title ?? parsedHtml?.title ?? null,
        price: structured?.price ?? parsedHtml?.price ?? null,
        priceText: structured?.priceText ?? parsedHtml?.priceText ?? null,
        mileage: structured?.mileage ?? parsedHtml?.mileage ?? null,
        mileageUnit: structured?.mileageUnit ?? parsedHtml?.mileageUnit ?? null,
        location: structured?.location ?? parsedHtml?.location ?? null,
        description: structured?.description ?? parsedHtml?.description ?? null,
        images:
          structured?.images && structured.images.length > 0
            ? structured.images
            : parsedHtml?.images && parsedHtml.images.length > 0
              ? parsedHtml.images
              : [],
        vin: parsedHtml?.vin ?? structured?.vin ?? null,
        exteriorColor: structured?.exteriorColor ?? parsedHtml?.exteriorColor ?? null,
        interiorColor: structured?.interiorColor ?? parsedHtml?.interiorColor ?? null,
        transmission: structured?.transmission ?? parsedHtml?.transmission ?? null,
        engine: structured?.engine ?? parsedHtml?.engine ?? null,
        bodyStyle: structured?.bodyStyle ?? parsedHtml?.bodyStyle ?? null,
      };

      if (advertId && (!merged.mileage || merged.images.length === 0)) {
        const searchListing = await fetchAutoTraderSearchListing(advertId, timeoutMs).catch(() => null);
        if (searchListing) {
          if (!merged.title && searchListing.title) merged.title = searchListing.title;
          if (!merged.price && searchListing.price != null) merged.price = searchListing.price;
          if (!merged.priceText && searchListing.priceText) merged.priceText = searchListing.priceText;
          if (!merged.location && searchListing.location) merged.location = searchListing.location;
          if (!merged.mileage && searchListing.mileage != null) {
            merged.mileage = searchListing.mileage;
            merged.mileageUnit = searchListing.mileageUnit;
          }
          if (merged.images.length === 0 && searchListing.images.length > 0) {
            merged.images = searchListing.images;
          }
        }
      }

      return merged;
    }
  } catch {
    // fall through to empty
  }

  return empty;
}

async function fetchAutoTraderProductPagePayload(
  url: string,
  timeoutMs: number,
): Promise<AutoTraderProductPagePayload | null> {
  const advertId = extractAdvertId(url);
  if (!advertId) return null;

  const endpoint = new URL(`https://www.autotrader.co.uk/product-page/v1/advert/${advertId}`);
  endpoint.searchParams.set("channel", "cars");
  endpoint.searchParams.set("postcode", "SW1A 1AA");

  const response = await fetch(endpoint.toString(), {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "application/json, text/plain, */*",
      Referer: url,
    },
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) return null;
  return (await response.json()) as AutoTraderProductPagePayload;
}

function extractAdvertId(url: string): string | null {
  const match = url.match(/\/car-details\/(\d+)(?:[/?#]|$)/i);
  return match?.[1] ?? null;
}

function normalizeSpecKey(value: string | null | undefined): string {
  return (value ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function parsePrice(text: string): number | null {
  const cleaned = text.replace(/[^0-9.]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) || num === 0 ? null : num;
}

function parseMileage(text: string): number | null {
  const cleaned = text.replace(/[^0-9]/g, "");
  const num = parseInt(cleaned, 10);
  return isNaN(num) ? null : num;
}

function parseTextNumber(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  if (!cleaned) return null;
  const num = Number.parseFloat(cleaned);
  return Number.isFinite(num) && num > 0 ? num : null;
}

function parseMileageValue(text: string | null | undefined): { mileage: number | null; unit: "km" | "miles" | null } {
  if (!text) return { mileage: null, unit: null };
  const mileage = parseTextNumber(text);
  if (mileage === null) return { mileage: null, unit: null };
  const lower = text.toLowerCase();
  const unit = lower.includes("km") || lower.includes("kilomet") ? "km" : lower.includes("mile") || lower.includes("mi") ? "miles" : null;
  return { mileage, unit };
}

function collectProductPageSpecs(payload: AutoTraderProductPagePayload): Map<string, string> {
  const specs = new Map<string, string>();
  const groups = [
    payload.keySpecification ?? [],
    payload.overview?.keySpecification ?? [],
    payload.overviewV2?.keySpecification ?? [],
  ];

  for (const group of groups) {
    for (const item of group) {
      const value = item?.value?.trim();
      if (!value) continue;
      for (const key of [item?.label, item?.specKey].map(normalizeSpecKey)) {
        if (key && !specs.has(key)) {
          specs.set(key, value);
        }
      }
    }
  }

  return specs;
}

function pickSpecValue(specs: Map<string, string>, ...labels: string[]): string | null {
  for (const label of labels) {
    const value = specs.get(normalizeSpecKey(label));
    if (value) return value;
  }
  return null;
}

function parseVin(text: string | null | undefined): string | null {
  if (!text) return null;
  const labeled = text.match(/\b(?:vin|chassis(?: number)?|frame(?: number)?)\b[:\s#-]*([A-HJ-NPR-Z0-9]{17})\b/i);
  if (labeled?.[1]) return labeled[1].toUpperCase();
  const generic = text.match(/\b[A-HJ-NPR-Z0-9]{17}\b/i);
  return generic?.[0]?.toUpperCase() ?? null;
}

function parseAutoTraderProductPagePayload(payload: AutoTraderProductPagePayload): Partial<AutoTraderDetailParsed> {
  const specs = collectProductPageSpecs(payload);
  const title = payload.heading?.title?.trim() || payload.keyInformation?.title?.trim() || null;
  const priceText =
    payload.heading?.priceBreakdown?.price?.priceFormatted?.trim()
    || payload.gallery?.price?.trim()
    || null;
  const price = payload.heading?.priceBreakdown?.price?.price ?? parsePrice(priceText ?? "");

  const mileageText =
    pickSpecValue(specs, "Mileage", "MILEAGE")
    || payload.heading?.headingPills?.map((pill) => pill?.label?.trim()).find((label) => /\b(\d[\d,]*)\s*(miles?|km|kilometres?)\b/i.test(label ?? ""))
    || payload.keyInformation?.subTitle?.match(/\b(\d[\d,]*)\s*(miles?|km|kilometres?)\b/i)?.[0]
    || null;
  const mileage = parseMileageValue(mileageText);

  const description = [
    payload.description?.text?.filter(Boolean).join("\n\n")?.trim() || null,
    payload.description?.strapline?.trim() || null,
    payload.pageMetaData?.pageDescription?.trim() || null,
  ].filter((part): part is string => Boolean(part)).join("\n\n");

  const images = (payload.gallery?.images ?? [])
    .map((image) => image?.url ?? null)
    .map((image) => (typeof image === "string" ? normalizeAutoTraderImageUrl(image) : null))
    .filter((image): image is string => image !== null);

  return {
    title,
    price: price ?? null,
    priceText,
    mileage: mileage.mileage,
    mileageUnit: mileage.unit,
    location: payload.keyInformation?.marketExtensionHeaderDescription?.trim() ?? null,
    description: description || null,
    images,
    vin: null,
    exteriorColor: pickSpecValue(specs, "Body colour", "Body color", "Exterior colour", "Exterior color", "Colour", "Color"),
    interiorColor: null,
    transmission: pickSpecValue(specs, "Gearbox", "Transmission"),
    engine: pickSpecValue(specs, "Engine", "Engine size", "Engine size litres", "Engine litres"),
    bodyStyle: pickSpecValue(specs, "Body type"),
  };
}

/** Parse AutoTrader HTML into structured fields. Exported for testing. */
export function parseAutoTraderHtml(html: string): AutoTraderDetailParsed {
  const $ = cheerio.load(html);
  const bodyText = $("body").text().replace(/\s+/g, " ").trim();

  const title = $("h1").first().text().trim()
    || $('[data-testid="vehicle-title"]').first().text().trim()
    || null;

  const priceText = $('[data-testid="price"]').first().text().trim()
    || $(".price").first().text().trim()
    || $('[class*="price"]').first().text().trim()
    || null;
  const price = priceText ? parsePrice(priceText) : null;

  const mileageText = $('[data-testid="mileage"]').first().text().trim()
    || $('[class*="mileage"]').first().text().trim()
    || bodyText.match(/\b(\d[\d,]*)\s*(miles?|km|kilometres?)\b/i)?.[0]
    || null;
  const mileage = mileageText ? parseMileage(mileageText) : null;
  const mileageUnit = mileageText?.toLowerCase().includes("km") ? "km" : "miles";

  const location = $('[data-testid="location"]').first().text().trim()
    || $('[class*="location"]').first().text().trim()
    || null;

  const description = $('[data-testid="description"]').first().text().trim()
    || $('[class*="description"]').first().text().trim()
    || null;

  const transmission = $('[data-testid="transmission"]').first().text().trim()
    || $('[class*="transmission"]').first().text().trim()
    || bodyText.match(/\b(automatic|manual|semi-automatic|semi automatic|cvt|dsg|pdk|tiptronic)\b/i)?.[0]
    || null;

  const engine = $('[data-testid="engine"]').first().text().trim()
    || $('[class*="engine"]').first().text().trim()
    || bodyText.match(/\b\d(?:\.\d)?\s?l\b/i)?.[0]
    || null;

  const exteriorColor = $('[data-testid="exterior-color"]').first().text().trim()
    || $('[class*="exterior"]').first().text().trim()
    || bodyText.match(/\b(?:body|exterior)\s+colour[:\s]+([A-Za-z][A-Za-z\s-]{1,30})/i)?.[1]?.trim()
    || null;

  const vin = parseVin(bodyText);

  const images = extractAutoTraderImages(html);

  return {
    title: title || null,
    price,
    priceText: priceText || null,
    mileage,
    mileageUnit: mileage ? mileageUnit : null,
    location: location || null,
    description: description || null,
    images,
    vin,
    exteriorColor: exteriorColor || null,
    interiorColor: null, // Not available on AutoTrader pages
    transmission: transmission || null,
    engine: engine || null,
    bodyStyle: null, // Not available on AutoTrader pages
  };
}
