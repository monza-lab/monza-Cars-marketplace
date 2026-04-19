import { normalizeAutoTraderImageUrl } from "./imageUrls";

interface AutoTraderSearchBadge {
  type?: string | null;
  displayText?: string | null;
}

interface AutoTraderSearchListing {
  advertId?: string | null;
  title?: string | null;
  subTitle?: string | null;
  price?: string | null;
  vehicleLocation?: string | null;
  images?: Array<string | null> | null;
  numberOfImages?: number | null;
  badges?: Array<AutoTraderSearchBadge | null> | null;
}

interface AutoTraderSearchResultsResponse {
  data?: {
    searchResults?: {
      listings?: Array<AutoTraderSearchListing | null> | null;
    } | null;
  } | null;
}

export interface AutoTraderSearchListingParsed {
  title: string | null;
  price: number | null;
  priceText: string | null;
  location: string | null;
  mileage: number | null;
  mileageUnit: "miles" | null;
  images: string[];
}

const SEARCH_RESULTS_QUERY = `query SearchResultsListingsGridQuery($filters: [FilterInput!]!, $channel: Channel!, $page: Int, $sortBy: SearchResultsSort, $listingType: [ListingType!], $searchId: String!, $featureFlags: [FeatureFlag]) {
  searchResults(
    input: {
      facets: []
      filters: $filters
      channel: $channel
      page: $page
      sortBy: $sortBy
      listingType: $listingType
      searchId: $searchId
      featureFlags: $featureFlags
    }
  ) {
    listings {
      ... on SearchListing {
        advertId
        title
        subTitle
        price
        vehicleLocation
        images
        numberOfImages
        badges {
          type
          displayText
        }
      }
    }
  }
}`;

const SEARCH_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "application/json, text/plain, */*",
  "Content-Type": "application/json",
  "x-sauron-app-name": "search-results-app",
  "x-sauron-app-version": "main-DqUNEWa0",
};

function parsePrice(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9.]/g, "");
  const value = Number.parseFloat(cleaned);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseMileage(text: string | null | undefined): number | null {
  if (!text) return null;
  const cleaned = text.replace(/[^0-9]/g, "");
  const value = Number.parseInt(cleaned, 10);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function parseMileageFromBadges(badges: Array<AutoTraderSearchBadge | null> | null | undefined): number | null {
  for (const badge of badges ?? []) {
    const displayText = badge?.displayText?.trim();
    if (!displayText) continue;
    if (badge?.type === "MILEAGE" || /\bmiles?\b/i.test(displayText)) {
      return parseMileage(displayText);
    }
  }
  return null;
}

function parseImages(images: Array<string | null> | null | undefined): string[] {
  const normalized = new Set<string>();
  for (const image of images ?? []) {
    if (!image) continue;
    const url = normalizeAutoTraderImageUrl(image);
    if (url) normalized.add(url);
  }
  return [...normalized];
}

export async function fetchAutoTraderSearchListing(
  advertId: string,
  timeoutMs = 15_000,
): Promise<AutoTraderSearchListingParsed | null> {
  const response = await fetch("https://www.autotrader.co.uk/at-gateway", {
    method: "POST",
    headers: SEARCH_HEADERS,
    body: JSON.stringify({
      operationName: "SearchResultsListingsGridQuery",
      query: SEARCH_RESULTS_QUERY,
      variables: {
        filters: [
          { filter: "price_search_type", selected: ["monthly-price"] },
          { filter: "advert_id", selected: [advertId] },
          { filter: "postcode", selected: ["SW1A 1AA"] },
        ],
        channel: "cars",
        page: 1,
        sortBy: "relevance",
        listingType: ["NATURAL_LISTING"],
        searchId: crypto.randomUUID(),
        featureFlags: [],
      },
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });

  if (!response.ok) return null;

  const data = (await response.json()) as AutoTraderSearchResultsResponse;
  const listing = data.data?.searchResults?.listings?.find(
    (item) => item?.advertId === advertId,
  ) ?? null;
  if (!listing) return null;

  const mileage = parseMileageFromBadges(listing.badges);

  return {
    title: listing.title?.trim() || null,
    price: parsePrice(listing.price),
    priceText: listing.price?.trim() || null,
    location: listing.vehicleLocation?.trim() || null,
    mileage,
    mileageUnit: mileage != null ? "miles" : null,
    images: parseImages(listing.images),
  };
}
