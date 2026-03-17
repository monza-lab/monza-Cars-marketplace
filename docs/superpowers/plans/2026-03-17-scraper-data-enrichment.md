# Scraper Data Enrichment Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill missing data fields across 40,308 listings by expanding existing scrapers and adding free enrichment sources (NHTSA VIN decoder, title parsing), without paid proxies.

**Architecture:** Six independent phases that each deliver value standalone. Phase 1A expands AutoTrader's GraphQL query to request more fields. Phase 1B batch-decodes VINs via the free NHTSA API. Phase 1C parses listing titles for engine/transmission/trim. Phase 2 runs BaT detail scraping via GitHub Actions. Phase 3 swaps Playwright for rebrowser-playwright to bypass Classic.com's Cloudflare. Phase 4 (experimental) tries plain HTTP for AutoScout24.

**Tech Stack:** TypeScript, Supabase, Node.js fetch, NHTSA vPIC API, rebrowser-playwright, GitHub Actions, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-03-17-scraper-data-enrichment-design.md`

---

## File Structure

### Phase 1A — AutoTrader GraphQL Expansion
- Modify: `src/features/scrapers/autotrader_collector/discover.ts` — expand GraphQL query + `GatewayListing` interface
- Modify: `src/features/scrapers/autotrader_collector/collector.ts` — expand `ActiveListingBase` type
- Modify: `src/features/scrapers/autotrader_collector/normalize.ts` — add `parseModelTrimFromTitle()` (if not present)
- Modify: `src/features/scrapers/autotrader_collector/discover.test.ts` — test new gateway fields

### Phase 1B — NHTSA VIN Decoder
- Create: `src/features/scrapers/common/nhtsaVinDecoder.ts` — batch decode function
- Create: `src/features/scrapers/common/nhtsaVinDecoder.test.ts` — unit tests
- Create: `scripts/enrich-from-vin.ts` — CLI script
- Create: `src/app/api/cron/enrich-vin/route.ts` — daily cron endpoint
- Modify: `vercel.json` — add cron schedule
- Modify: `src/features/scrapers/common/monitoring/types.ts` — add `'enrich-vin'` to ScraperName

### Phase 1C — Title Enrichment Parsers
- Create: `src/features/scrapers/common/titleEnrichment.ts` — regex parsers
- Create: `src/features/scrapers/common/titleEnrichment.test.ts` — unit tests (TDD)
- Create: `scripts/enrich-from-titles.ts` — CLI script
- Create: `src/app/api/cron/enrich-titles/route.ts` — daily cron endpoint
- Modify: `vercel.json` — add cron schedule
- Modify: `src/features/scrapers/common/monitoring/types.ts` — add `'enrich-titles'` to ScraperName

### Phase 2 — BaT Detail Scraper (GitHub Actions)
- Create: `scripts/bat-detail-scraper.ts` — CLI for batch detail scraping
- Create: `.github/workflows/bat-detail-scraper.yml` — daily workflow
- Modify: `src/features/scrapers/common/monitoring/types.ts` — add `'bat-detail'` to ScraperName

### Phase 3 — Classic.com rebrowser-patches
- Modify: `package.json` — add `rebrowser-playwright` dependency
- Modify: `src/features/scrapers/classic_collector/browser.ts` — use rebrowser-playwright for browser launch

### Phase 4 — AutoScout24 HTTP Discovery (Experimental)
- Create: `src/features/scrapers/autoscout24_collector/httpDiscover.ts` — plain HTTP fetch with curl-impersonate
- Create: `src/features/scrapers/autoscout24_collector/httpDiscover.test.ts` — tests
- Modify: `src/features/scrapers/autoscout24_collector/collector.ts` — add HTTP discovery option

---

## Task 1: AutoTrader GraphQL Field Validation

**Files:**
- Modify: `src/features/scrapers/autotrader_collector/discover.ts:38-55` — expand `GatewayListing` interface
- Modify: `src/features/scrapers/autotrader_collector/discover.ts:75-85` — expand `AutoTraderGatewayListing` interface
- Modify: `src/features/scrapers/autotrader_collector/discover.ts:151` — expand GraphQL query
- Modify: `src/features/scrapers/autotrader_collector/discover.ts:112-144` — expand `parseGatewayListings()`
- Test: `src/features/scrapers/autotrader_collector/discover.test.ts`

- [ ] **Step 1: Create a validation script to discover available GraphQL fields**

Create `scripts/autotrader-field-probe.ts`:

```typescript
/**
 * Probes AutoTrader's GraphQL API to discover available fields.
 * Run: npx tsx scripts/autotrader-field-probe.ts
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

const CANDIDATE_FIELDS = [
  "mileage",
  "odometerReadingMiles",
  "fuelType",
  "transmission",
  "engineSize",
  "bodyType",
  "colour",
  "doors",
  "registration",
  "co2Emissions",
  "topSpeed",
  "acceleration",
  "bhp",
  "condition",
];

async function probeField(fieldName: string): Promise<{ field: string; works: boolean; error?: string }> {
  // Build query with just the candidate field added
  const query = `query SearchResultsListingsGridQuery($filters:[FilterInput!]!,$channel:Channel!,$page:Int,$sortBy:SearchResultsSort,$listingType:[ListingType!],$searchId:String!,$featureFlags:[FeatureFlag]){searchResults(input:{facets:[],filters:$filters,channel:$channel,page:$page,sortBy:$sortBy,listingType:$listingType,searchId:$searchId,featureFlags:$featureFlags}){listings{... on SearchListing{advertId title ${fieldName}}}page{number results{count}}trackingContext{searchId}}}`;

  const body = {
    operationName: "SearchResultsListingsGridQuery",
    query,
    variables: {
      filters: [
        { filter: "price_search_type", selected: ["total"] },
        { filter: "postcode", selected: ["SW1A 1AA"] },
        { filter: "make", selected: ["Porsche"] },
      ],
      channel: "cars",
      page: 1,
      sortBy: "relevance",
      listingType: null,
      searchId: `probe-${Date.now()}`,
      featureFlags: [],
    },
  };

  try {
    const res = await fetch("https://www.autotrader.co.uk/at-gateway?opname=SearchResultsListingsGridQuery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sauron-app-name": "sauron-search-results-app",
        "x-sauron-app-version": "6c9dff0561",
        Origin: "https://www.autotrader.co.uk",
        Referer: "https://www.autotrader.co.uk/car-search?make=Porsche&postcode=SW1A+1AA",
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return { field: fieldName, works: false, error: `HTTP ${res.status}` };
    }

    const payload = await res.json() as any;
    if (payload.errors && payload.errors.length > 0) {
      return { field: fieldName, works: false, error: payload.errors[0]?.message || "GraphQL error" };
    }

    // Check if the field has actual data in any listing
    const listings = payload.data?.searchResults?.listings ?? [];
    const hasData = listings.some((l: any) => l[fieldName] != null);
    return { field: fieldName, works: true, error: hasData ? undefined : "(field accepted but all values null)" };
  } catch (err: any) {
    return { field: fieldName, works: false, error: err.message };
  }
}

async function main() {
  console.log("=== AutoTrader GraphQL Field Probe ===\n");
  console.log("Testing fields one at a time with 1s delay...\n");

  const results: Array<{ field: string; works: boolean; error?: string }> = [];

  for (const field of CANDIDATE_FIELDS) {
    const result = await probeField(field);
    const status = result.works ? "✓" : "✗";
    const note = result.error ? ` — ${result.error}` : "";
    console.log(`  ${status} ${field}${note}`);
    results.push(result);
    await new Promise((r) => setTimeout(r, 1000)); // 1s delay between probes
  }

  console.log("\n=== SUMMARY ===");
  const working = results.filter((r) => r.works);
  const failed = results.filter((r) => !r.works);
  console.log(`Working fields (${working.length}): ${working.map((r) => r.field).join(", ") || "none"}`);
  console.log(`Rejected fields (${failed.length}): ${failed.map((r) => r.field).join(", ") || "none"}`);

  // Also try introspection
  console.log("\n=== Trying GraphQL Introspection ===");
  try {
    const introspectionQuery = `{__type(name:"SearchListing"){fields{name type{name kind ofType{name}}}}}`;
    const res = await fetch("https://www.autotrader.co.uk/at-gateway?opname=IntrospectionQuery", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sauron-app-name": "sauron-search-results-app",
        Origin: "https://www.autotrader.co.uk",
        Accept: "*/*",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
      body: JSON.stringify({ query: introspectionQuery }),
      signal: AbortSignal.timeout(15000),
    });
    const payload = await res.json() as any;
    if (payload.data?.__type?.fields) {
      const fields = payload.data.__type.fields.map((f: any) => f.name);
      console.log(`SearchListing fields: ${fields.join(", ")}`);
    } else {
      console.log("Introspection blocked or type not found");
      if (payload.errors) console.log(`  Error: ${payload.errors[0]?.message}`);
    }
  } catch (err: any) {
    console.log(`Introspection failed: ${err.message}`);
  }
}

main().catch(console.error);
```

- [ ] **Step 2: Run the field probe**

Run: `npx tsx scripts/autotrader-field-probe.ts`

Expected: A list of which fields work and which are rejected. Record the working fields — these are the fields we'll add to the production query.

- [ ] **Step 3: Write tests for expanded gateway parsing**

In `src/features/scrapers/autotrader_collector/discover.test.ts`, add tests for the new fields. Use the field names discovered in Step 2. Example (adjust field names based on probe results):

```typescript
describe("parseGatewayListings with expanded fields", () => {
  it("should parse mileage and specs from expanded gateway response", () => {
    const payload = {
      data: {
        searchResults: {
          listings: [
            {
              advertId: "AT-123",
              title: "2023 Porsche 911 Carrera",
              price: "£125,000",
              vehicleLocation: "London",
              images: ["https://img.autotrader.co.uk/1.jpg"],
              // New fields (use actual names from probe):
              mileage: "12,345 miles",
              fuelType: "Petrol",
              transmission: "Manual",
              engineSize: "3.0L",
              bodyType: "Coupe",
              colour: "Guards Red",
              trackingContext: {
                advertContext: { make: "Porsche", model: "911", year: 2023 },
                advertCardFeatures: { priceIndicator: "good-price" },
              },
            },
          ],
          page: { number: 1, results: { count: 1 } },
          trackingContext: { searchId: "test-123" },
        },
      },
    };

    const result = parseGatewayListings(payload);
    expect(result.listings).toHaveLength(1);
    const listing = result.listings[0];
    expect(listing.advertId).toBe("AT-123");
    // Assert new fields (adjust based on probe results):
    expect(listing.mileageText).toBe("12,345 miles");
    expect(listing.fuelType).toBe("Petrol");
    expect(listing.transmission).toBe("Manual");
    expect(listing.engineSize).toBe("3.0L");
    expect(listing.bodyType).toBe("Coupe");
    expect(listing.colour).toBe("Guards Red");
  });

  it("should handle missing expanded fields gracefully", () => {
    const payload = {
      data: {
        searchResults: {
          listings: [
            {
              advertId: "AT-456",
              title: "2020 Porsche Cayenne",
              price: "£65,000",
              trackingContext: {
                advertContext: { make: "Porsche", model: "Cayenne", year: 2020 },
              },
              // No new fields present
            },
          ],
          page: { number: 1, results: { count: 1 } },
          trackingContext: { searchId: "test-456" },
        },
      },
    };

    const result = parseGatewayListings(payload);
    expect(result.listings).toHaveLength(1);
    const listing = result.listings[0];
    expect(listing.mileageText).toBeNull();
    expect(listing.fuelType).toBeNull();
    expect(listing.transmission).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run src/features/scrapers/autotrader_collector/discover.test.ts`
Expected: FAIL — new fields not yet on the interface.

- [ ] **Step 5: Expand GatewayListing and AutoTraderGatewayListing interfaces**

In `src/features/scrapers/autotrader_collector/discover.ts`, update the interfaces (use actual field names from probe):

Add to `GatewayListing` (line 38-55):
```typescript
interface GatewayListing {
  advertId?: string;
  title?: string;
  price?: string;
  vehicleLocation?: string;
  images?: string[];
  numberOfImages?: number;
  // New fields from expanded query:
  mileage?: string;
  fuelType?: string;
  transmission?: string;
  engineSize?: string;
  bodyType?: string;
  colour?: string;
  doors?: number;
  trackingContext?: {
    advertContext?: {
      make?: string;
      model?: string;
      year?: number;
    };
    advertCardFeatures?: {
      priceIndicator?: string;
    };
  };
}
```

Add to `AutoTraderGatewayListing` (line 75-85):
```typescript
export interface AutoTraderGatewayListing {
  advertId: string;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  priceText: string | null;
  vehicleLocation: string | null;
  images: string[];
  priceIndicator: string | null;
  // New fields:
  mileageText: string | null;
  fuelType: string | null;
  transmission: string | null;
  engineSize: string | null;
  bodyType: string | null;
  colour: string | null;
}
```

- [ ] **Step 6: Expand the GraphQL query string**

In `discover.ts` line 151, update the query to request new fields (use actual names from probe):

```typescript
const query = `query SearchResultsListingsGridQuery($filters:[FilterInput!]!,$channel:Channel!,$page:Int,$sortBy:SearchResultsSort,$listingType:[ListingType!],$searchId:String!,$featureFlags:[FeatureFlag]){searchResults(input:{facets:[],filters:$filters,channel:$channel,page:$page,sortBy:$sortBy,listingType:$listingType,searchId:$searchId,featureFlags:$featureFlags}){listings{... on SearchListing{advertId title price vehicleLocation images mileage fuelType transmission engineSize bodyType colour trackingContext{advertContext{make model year} advertCardFeatures{priceIndicator}}}}page{number results{count}}trackingContext{searchId}}}`;
```

- [ ] **Step 7: Update parseGatewayListings to extract new fields**

In `discover.ts` lines 112-144, update `parseGatewayListings()`:

```typescript
listings.push({
  advertId,
  title,
  make: row.trackingContext?.advertContext?.make ?? null,
  model: row.trackingContext?.advertContext?.model ?? null,
  year: typeof row.trackingContext?.advertContext?.year === "number" ? row.trackingContext.advertContext.year : null,
  priceText: row.price ?? null,
  vehicleLocation: row.vehicleLocation ?? null,
  images: Array.isArray(row.images) ? row.images.filter((u): u is string => typeof u === "string" && u.length > 0) : [],
  priceIndicator: row.trackingContext?.advertCardFeatures?.priceIndicator ?? null,
  // New fields:
  mileageText: typeof row.mileage === "string" ? row.mileage : null,
  fuelType: typeof row.fuelType === "string" ? row.fuelType : null,
  transmission: typeof row.transmission === "string" ? row.transmission : null,
  engineSize: typeof row.engineSize === "string" ? row.engineSize : null,
  bodyType: typeof row.bodyType === "string" ? row.bodyType : null,
  colour: typeof row.colour === "string" ? row.colour : null,
});
```

- [ ] **Step 8: Update ActiveListingBase in collector.ts (lines 35-51)**

In `src/features/scrapers/autotrader_collector/collector.ts` lines 35-51, add new fields to the type:

```typescript
type ActiveListingBase = {
  source: SourceKey;
  url: string;
  externalId: string | null;
  title: string;
  make: string | null;
  model: string | null;
  year: number | null;
  mileage: number | null;
  mileageUnit: string | null;
  price: number | null;
  priceText: string | null;
  status: string | null;
  location: string | null;
  images: string[];
  priceIndicator: string | null;
  // New fields from gateway:
  fuelType: string | null;
  transmission: string | null;
  engineSize: string | null;
  bodyType: string | null;
  colour: string | null;
};
```

- [ ] **Step 8b: Update scrapeActiveListings() to pass new fields (lines 348-365)**

In `scrapeActiveListings()`, the `listings.push()` block (~line 348-365) currently hardcodes `mileage: null, mileageUnit: null`. Update it to use parsed gateway data:

```typescript
        // Parse mileage from gateway mileageText
        const mileageParsed = parseMileageFromGateway(row.mileageText);

        listings.push({
          source,
          url: canonicalizeUrl(`https://www.autotrader.co.uk/car-details/${row.advertId}`),
          externalId: row.advertId,
          title: row.title,
          make: row.make,
          model: row.model,
          year: row.year,
          mileage: mileageParsed.mileage,       // was: null
          mileageUnit: mileageParsed.unit,       // was: null
          price: parsePrice(row.priceText ?? ""),
          priceText: row.priceText,
          status: "active",
          location: row.vehicleLocation,
          images: row.images,
          priceIndicator: row.priceIndicator,
          // New fields:
          fuelType: row.fuelType,
          transmission: row.transmission,
          engineSize: row.engineSize,
          bodyType: row.bodyType,
          colour: row.colour,
        });
```

- [ ] **Step 8c: Update normalizeFromBaseAndUrl listingData construction (lines 528-546)**

In `normalizeFromBaseAndUrl()`, the ternary that builds `listingData` from `input.base` (~lines 528-546) currently hardcodes `vin: null, exteriorColor: null, interiorColor: null, transmission: null, engine: null, bodyStyle: null`. Update these to use the new gateway fields:

```typescript
  const listingData = input.base
    ? {
        title: input.base.title,
        price: input.base.price,
        priceText: input.base.priceText,
        status: input.base.status,
        mileage: input.base.mileage,
        mileageUnit: input.base.mileageUnit,
        location: input.base.location,
        description: null,
        images: input.base.images,
        vin: null,                                          // Still null from gateway
        exteriorColor: input.base.colour ?? null,           // was: null
        interiorColor: null,                                // Still null from gateway
        transmission: input.base.transmission ?? null,      // was: null
        engine: input.base.engineSize ?? null,              // was: null
        bodyStyle: input.base.bodyType ?? null,             // was: null
        priceIndicator: input.base.priceIndicator,
      }
    : (await fetchListingDataWithRetry(url, limiter)).data;
```

This is the critical change that makes the expanded GraphQL fields actually flow into the `NormalizedListing` and then the database.

- [ ] **Step 9: Parse mileage from gateway mileageText**

In `collector.ts`, where mileage is assigned in `ActiveListingBase` creation, parse the text:

```typescript
// Parse mileage from gateway text like "12,345 miles"
function parseMileageFromGateway(text: string | null): { mileage: number | null; unit: string | null } {
  if (!text) return { mileage: null, unit: null };
  const match = text.match(/([\d,]+)\s*(miles?|km|kilometers?)/i);
  if (!match) return { mileage: null, unit: null };
  const num = parseInt(match[1].replace(/,/g, ""), 10);
  if (isNaN(num)) return { mileage: null, unit: null };
  const unit = /km|kilo/i.test(match[2]) ? "km" : "miles";
  return { mileage: num, unit };
}

// Then use it:
const { mileage, unit } = parseMileageFromGateway(a.mileageText);
// ... assign to ActiveListingBase
```

- [ ] **Step 10: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/autotrader_collector/discover.test.ts`
Expected: PASS

- [ ] **Step 11: Run full AutoTrader test suite**

Run: `npx vitest run src/features/scrapers/autotrader_collector/`
Expected: All tests pass (existing + new).

- [ ] **Step 12: Commit**

```bash
git add src/features/scrapers/autotrader_collector/discover.ts \
       src/features/scrapers/autotrader_collector/collector.ts \
       src/features/scrapers/autotrader_collector/discover.test.ts \
       scripts/autotrader-field-probe.ts
git commit -m "feat(autotrader): expand GraphQL query with mileage, engine, transmission, color fields"
```

**Important note:** Steps 5-9 depend on the probe results from Step 2. If the probe shows different field names than expected, adjust accordingly. If NO fields work, skip this task entirely and rely on Phases 1B/1C for AutoTrader enrichment.

---

## Task 2: NHTSA VIN Decoder Module (TDD)

**Files:**
- Create: `src/features/scrapers/common/nhtsaVinDecoder.ts`
- Create: `src/features/scrapers/common/nhtsaVinDecoder.test.ts`

- [ ] **Step 1: Write failing tests for VIN decoder**

Create `src/features/scrapers/common/nhtsaVinDecoder.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock fetch for unit tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import {
  decodeVinBatch,
  mapNhtsaToListingFields,
  type NhtsaDecodedVin,
  type VinEnrichmentFields,
} from "./nhtsaVinDecoder";

describe("nhtsaVinDecoder", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("decodeVinBatch", () => {
    it("should decode a batch of VINs via NHTSA API", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Count: 2,
          Results: [
            {
              VIN: "WP0AB2A71KS123456",
              Make: "PORSCHE",
              Model: "911",
              ModelYear: "2019",
              BodyClass: "Coupe",
              DriveType: "RWD",
              DisplacementL: "3.0",
              EngineCylinders: "6",
              EngineConfiguration: "Horizontally Opposed",
              FuelTypePrimary: "Gasoline",
              TransmissionStyle: "Manual",
              Doors: "2",
              ErrorCode: "0",
              ErrorText: "",
            },
            {
              VIN: "WP0CA2A85FS123789",
              Make: "PORSCHE",
              Model: "Cayman",
              ModelYear: "2015",
              BodyClass: "Coupe",
              DriveType: "RWD",
              DisplacementL: "2.7",
              EngineCylinders: "6",
              FuelTypePrimary: "Gasoline",
              TransmissionStyle: "Dual-Clutch",
              ErrorCode: "0",
              ErrorText: "",
            },
          ],
        }),
      });

      const results = await decodeVinBatch(["WP0AB2A71KS123456", "WP0CA2A85FS123789"]);
      expect(results).toHaveLength(2);
      expect(results[0].VIN).toBe("WP0AB2A71KS123456");
      expect(results[0].Make).toBe("PORSCHE");
      expect(results[0].DisplacementL).toBe("3.0");

      // Verify fetch was called with correct format
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, opts] = mockFetch.mock.calls[0];
      expect(url).toBe("https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/");
      expect(opts.method).toBe("POST");
      // URLSearchParams encodes semicolons as %3B
      expect(opts.body).toContain("WP0AB2A71KS123456");
      expect(opts.body).toContain("WP0CA2A85FS123789");
    });

    it("should handle empty VIN array", async () => {
      const results = await decodeVinBatch([]);
      expect(results).toEqual([]);
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it("should handle API errors gracefully", async () => {
      mockFetch.mockResolvedValueOnce({ ok: false, status: 500, text: async () => "Server Error" });

      const results = await decodeVinBatch(["WP0AB2A71KS123456"]);
      expect(results).toEqual([]);
    });

    it("should filter out results with error codes", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          Count: 1,
          Results: [
            {
              VIN: "INVALID12345678901",
              ErrorCode: "1",
              ErrorText: "1 - Check Digit (9th position) does not calculate properly",
              Make: "",
              Model: "",
            },
          ],
        }),
      });

      const results = await decodeVinBatch(["INVALID12345678901"]);
      expect(results).toEqual([]);
    });
  });

  describe("mapNhtsaToListingFields", () => {
    it("should map NHTSA response to listing fields", () => {
      const decoded: NhtsaDecodedVin = {
        VIN: "WP0AB2A71KS123456",
        Make: "PORSCHE",
        Model: "911",
        ModelYear: "2019",
        BodyClass: "Coupe",
        DriveType: "RWD",
        DisplacementL: "3.0",
        EngineCylinders: "6",
        EngineConfiguration: "Horizontally Opposed",
        FuelTypePrimary: "Gasoline",
        TransmissionStyle: "Manual",
        Doors: "2",
        ErrorCode: "0",
        ErrorText: "",
      };

      const fields = mapNhtsaToListingFields(decoded);
      expect(fields.engine).toBe("3.0L Horizontally Opposed 6-Cylinder");
      expect(fields.transmission).toBe("Manual");
      expect(fields.bodyStyle).toBe("Coupe");
      expect(fields.driveType).toBe("RWD");
    });

    it("should handle partial data", () => {
      const decoded: NhtsaDecodedVin = {
        VIN: "WP0AB2A71KS123456",
        Make: "PORSCHE",
        Model: "",
        ModelYear: "",
        BodyClass: "",
        DriveType: "",
        DisplacementL: "3.0",
        EngineCylinders: "6",
        EngineConfiguration: "",
        FuelTypePrimary: "",
        TransmissionStyle: "",
        Doors: "",
        ErrorCode: "0",
        ErrorText: "",
      };

      const fields = mapNhtsaToListingFields(decoded);
      expect(fields.engine).toBe("3.0L 6-Cylinder");
      expect(fields.transmission).toBeNull();
      expect(fields.bodyStyle).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/scrapers/common/nhtsaVinDecoder.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the NHTSA VIN decoder**

Create `src/features/scrapers/common/nhtsaVinDecoder.ts`:

```typescript
const NHTSA_BATCH_URL = "https://vpic.nhtsa.dot.gov/api/vehicles/DecodeVINValuesBatch/";
const MAX_BATCH_SIZE = 50;

export interface NhtsaDecodedVin {
  VIN: string;
  Make: string;
  Model: string;
  ModelYear: string;
  BodyClass: string;
  DriveType: string;
  DisplacementL: string;
  EngineCylinders: string;
  EngineConfiguration: string;
  FuelTypePrimary: string;
  TransmissionStyle: string;
  Doors: string;
  ErrorCode: string;
  ErrorText: string;
}

export interface VinEnrichmentFields {
  engine: string | null;
  transmission: string | null;
  bodyStyle: string | null;
  driveType: string | null;
}

/**
 * Batch-decode up to 50 VINs via the free NHTSA vPIC API.
 * Returns only successfully decoded results (ErrorCode === "0").
 */
export async function decodeVinBatch(vins: string[]): Promise<NhtsaDecodedVin[]> {
  if (vins.length === 0) return [];
  if (vins.length > MAX_BATCH_SIZE) {
    throw new Error(`Batch size ${vins.length} exceeds max ${MAX_BATCH_SIZE}`);
  }

  const body = new URLSearchParams();
  body.set("format", "json");
  body.set("data", vins.join(";"));

  try {
    const res = await fetch(NHTSA_BATCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      console.error(`[NHTSA] HTTP ${res.status}: ${await res.text().catch(() => "(unreadable)")}`);
      return [];
    }

    const payload = (await res.json()) as { Count: number; Results: NhtsaDecodedVin[] };
    // Filter out errors (ErrorCode "0" means success)
    return (payload.Results ?? []).filter(
      (r) => r.ErrorCode === "0" && r.Make && r.Make.length > 0
    );
  } catch (err) {
    console.error(`[NHTSA] Batch decode failed:`, err);
    return [];
  }
}

/**
 * Map NHTSA decoded VIN data to the fields we store in the listings table.
 */
export function mapNhtsaToListingFields(decoded: NhtsaDecodedVin): VinEnrichmentFields {
  // Build engine string: "3.0L Horizontally Opposed 6-Cylinder"
  const engineParts: string[] = [];
  if (decoded.DisplacementL && decoded.DisplacementL !== "0") {
    engineParts.push(`${decoded.DisplacementL}L`);
  }
  if (decoded.EngineConfiguration) {
    engineParts.push(decoded.EngineConfiguration);
  }
  if (decoded.EngineCylinders && decoded.EngineCylinders !== "0") {
    engineParts.push(`${decoded.EngineCylinders}-Cylinder`);
  }
  const engine = engineParts.length > 0 ? engineParts.join(" ") : null;

  return {
    engine,
    transmission: decoded.TransmissionStyle || null,
    bodyStyle: decoded.BodyClass || null,
    driveType: decoded.DriveType || null,
  };
}

/**
 * Process VINs in batches of 50 with a configurable delay between batches.
 */
export async function decodeVinsInBatches(
  vins: string[],
  opts?: { delayMs?: number; onBatch?: (batch: number, total: number) => void }
): Promise<Map<string, VinEnrichmentFields>> {
  const delayMs = opts?.delayMs ?? 1000;
  const result = new Map<string, VinEnrichmentFields>();
  const batches = Math.ceil(vins.length / MAX_BATCH_SIZE);

  for (let i = 0; i < batches; i++) {
    const batchVins = vins.slice(i * MAX_BATCH_SIZE, (i + 1) * MAX_BATCH_SIZE);
    opts?.onBatch?.(i + 1, batches);

    const decoded = await decodeVinBatch(batchVins);
    for (const d of decoded) {
      result.set(d.VIN, mapNhtsaToListingFields(d));
    }

    // Delay between batches (skip after last batch)
    if (i < batches - 1) {
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }

  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/common/nhtsaVinDecoder.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/nhtsaVinDecoder.ts \
       src/features/scrapers/common/nhtsaVinDecoder.test.ts
git commit -m "feat(enrichment): add NHTSA batch VIN decoder with tests"
```

---

## Task 3: NHTSA VIN Enrichment CLI + Cron

**Files:**
- Create: `scripts/enrich-from-vin.ts`
- Create: `src/app/api/cron/enrich-vin/route.ts`
- Modify: `vercel.json`
- Modify: `src/features/scrapers/common/monitoring/types.ts`

- [ ] **Step 1: Add all new ScraperName entries at once**

In `src/features/scrapers/common/monitoring/types.ts` line 1, add all three new scraper names in one edit (to avoid merge conflicts across tasks):

```typescript
export type ScraperName = 'porsche' | 'ferrari' | 'autotrader' | 'beforward' | 'classic' | 'autoscout24' | 'backfill-images' | 'enrich-vin' | 'enrich-titles' | 'bat-detail';
```

- [ ] **Step 2: Create the CLI script**

Create `scripts/enrich-from-vin.ts`:

```typescript
/**
 * CLI: Enrich listings with missing engine/transmission/body by decoding their VINs via NHTSA.
 *
 * Usage:
 *   npx tsx scripts/enrich-from-vin.ts
 *   npx tsx scripts/enrich-from-vin.ts --limit=500 --dryRun
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local
const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import { decodeVinsInBatches } from "../src/features/scrapers/common/nhtsaVinDecoder";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 1000, dryRun: false, delayMs: 1000 };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "delayMs") opts.delayMs = parseInt(val, 10);
    } else {
      if (arg.slice(2) === "dryRun") opts.dryRun = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n=== VIN Enrichment ===`);
  console.log(`Limit: ${opts.limit}, Dry run: ${opts.dryRun}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Query listings with VINs but missing engine/transmission/body_style
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, vin, engine, transmission, body_style")
    .not("vin", "is", null)
    .neq("vin", "")
    .or("engine.is.null,transmission.is.null,body_style.is.null")
    .eq("status", "active")
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} listings with VINs needing enrichment`);
  if (listings.length === 0) return;

  const vins = listings.map((l) => l.vin as string);
  const decoded = await decodeVinsInBatches(vins, {
    delayMs: opts.delayMs,
    onBatch: (batch, total) => console.log(`  Batch ${batch}/${total}...`),
  });

  console.log(`\nDecoded ${decoded.size}/${vins.length} VINs successfully`);

  let updated = 0;
  for (const listing of listings) {
    const fields = decoded.get(listing.vin);
    if (!fields) continue;

    // Only fill null fields — never overwrite existing data
    const updates: Record<string, string> = {};
    if (!listing.engine && fields.engine) updates.engine = fields.engine;
    if (!listing.transmission && fields.transmission) updates.transmission = fields.transmission;
    if (!listing.body_style && fields.bodyStyle) updates.body_style = fields.bodyStyle;

    if (Object.keys(updates).length === 0) continue;

    if (opts.dryRun) {
      console.log(`  [DRY RUN] ${listing.id}: ${JSON.stringify(updates)}`);
    } else {
      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);
      if (updateErr) {
        console.error(`  Error updating ${listing.id}: ${updateErr.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${listings.length}`);
  console.log(`VINs decoded: ${decoded.size}`);
  console.log(`Listings updated: ${updated}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Create the cron route**

Create `src/app/api/cron/enrich-vin/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { decodeVinsInBatches } from "@/features/scrapers/common/nhtsaVinDecoder";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring/record";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // VIN decode is fast — 60s is plenty

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const startedAt = new Date(startTime).toISOString();

  await markScraperRunStarted({
    scraperName: "enrich-vin",
    runId,
    startedAt,
    runtime: "vercel_cron",
  });

  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Get up to 500 active listings with VINs but missing fields
    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, vin, engine, transmission, body_style")
      .not("vin", "is", null)
      .neq("vin", "")
      .or("engine.is.null,transmission.is.null,body_style.is.null")
      .eq("status", "active")
      .limit(500);

    if (error) throw new Error(`Query error: ${error.message}`);

    const discovered = listings.length;
    if (discovered === 0) {
      await recordScraperRun({
        scraper_name: "enrich-vin",
        run_id: runId,
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        success: true,
        runtime: "vercel_cron",
        duration_ms: Date.now() - startTime,
        discovered: 0,
        written: 0,
        errors_count: 0,
      });
      await clearScraperRunActive("enrich-vin");
      return NextResponse.json({ success: true, runId, discovered: 0, written: 0 });
    }

    const vins = listings.map((l) => l.vin as string);
    const decoded = await decodeVinsInBatches(vins, { delayMs: 1000 });

    let written = 0;
    const errors: string[] = [];

    for (const listing of listings) {
      const fields = decoded.get(listing.vin);
      if (!fields) continue;

      const updates: Record<string, string> = {};
      if (!listing.engine && fields.engine) updates.engine = fields.engine;
      if (!listing.transmission && fields.transmission) updates.transmission = fields.transmission;
      if (!listing.body_style && fields.bodyStyle) updates.body_style = fields.bodyStyle;

      if (Object.keys(updates).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);

      if (updateErr) {
        errors.push(`${listing.id}: ${updateErr.message}`);
        continue;
      }
      written++;
    }

    await recordScraperRun({
      scraper_name: "enrich-vin",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
    await clearScraperRunActive("enrich-vin");

    return NextResponse.json({
      success: true,
      runId,
      duration: `${Date.now() - startTime}ms`,
      discovered,
      decoded: decoded.size,
      written,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    await recordScraperRun({
      scraper_name: "enrich-vin",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [err.message],
    });
    await clearScraperRunActive("enrich-vin");
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add cron schedule to vercel.json**

Add to the crons array:

```json
{ "path": "/api/cron/enrich-vin", "schedule": "0 7 * * *" }
```

- [ ] **Step 5: Run the CLI with --dryRun to verify**

Run: `npx tsx scripts/enrich-from-vin.ts --limit=10 --dryRun`
Expected: Finds listings with VINs, decodes them, shows what would be updated.

- [ ] **Step 6: Run for real with small batch**

Run: `npx tsx scripts/enrich-from-vin.ts --limit=10`
Expected: Updates ~5-10 listings with engine/transmission/body data.

- [ ] **Step 7: Commit**

```bash
git add scripts/enrich-from-vin.ts \
       src/app/api/cron/enrich-vin/route.ts \
       src/features/scrapers/common/monitoring/types.ts \
       vercel.json
git commit -m "feat(enrichment): add NHTSA VIN enrichment CLI + daily cron"
```

---

## Task 4: Title Enrichment Parsers (TDD)

**Files:**
- Create: `src/features/scrapers/common/titleEnrichment.ts`
- Create: `src/features/scrapers/common/titleEnrichment.test.ts`

- [ ] **Step 1: Write failing tests for title parsers**

Create `src/features/scrapers/common/titleEnrichment.test.ts`:

```typescript
import { describe, it, expect } from "vitest";

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "./titleEnrichment";

describe("titleEnrichment", () => {
  describe("parseEngineFromText", () => {
    it("should extract displacement + config", () => {
      expect(parseEngineFromText("2019 Porsche 911 3.0L Twin-Turbo")).toBe("3.0L Twin-Turbo");
    });

    it("should extract liter pattern with hyphen", () => {
      expect(parseEngineFromText("4.0-Liter Flat-Six")).toBe("4.0L Flat-Six");
    });

    it("should extract V8 pattern", () => {
      expect(parseEngineFromText("Ferrari 488 3.9L V8 Twin-Turbo")).toBe("3.9L V8 Twin-Turbo");
    });

    it("should extract flat-six without displacement", () => {
      expect(parseEngineFromText("Porsche 911 Flat-Six Engine")).toBe("Flat-Six");
    });

    it("should extract supercharged", () => {
      expect(parseEngineFromText("5.2L V10 Supercharged")).toBe("5.2L V10 Supercharged");
    });

    it("should return null for no engine info", () => {
      expect(parseEngineFromText("2020 Porsche Cayenne S")).toBeNull();
    });

    it("should not false-match on mileage text", () => {
      expect(parseEngineFromText("12,000 Miles")).toBeNull();
    });
  });

  describe("parseTransmissionFromText", () => {
    it("should extract N-speed manual", () => {
      expect(parseTransmissionFromText("6-Speed Manual")).toBe("6-Speed Manual");
    });

    it("should extract PDK", () => {
      expect(parseTransmissionFromText("7-Speed PDK")).toBe("7-Speed PDK");
    });

    it("should extract automatic", () => {
      expect(parseTransmissionFromText("8-Speed Automatic")).toBe("8-Speed Automatic");
    });

    it("should extract DCT", () => {
      expect(parseTransmissionFromText("7-Speed DCT")).toBe("7-Speed DCT");
    });

    it("should extract standalone manual/automatic", () => {
      expect(parseTransmissionFromText("Manual Transmission Porsche")).toBe("Manual");
    });

    it("should extract tiptronic", () => {
      expect(parseTransmissionFromText("5-Speed Tiptronic")).toBe("5-Speed Tiptronic");
    });

    it("should return null for no transmission", () => {
      expect(parseTransmissionFromText("2020 Porsche 911 Carrera")).toBeNull();
    });
  });

  describe("parseBodyStyleFromText", () => {
    it("should extract Coupe", () => {
      expect(parseBodyStyleFromText("2023 Porsche 911 Coupe")).toBe("Coupe");
    });

    it("should extract Cabriolet", () => {
      expect(parseBodyStyleFromText("911 Carrera Cabriolet")).toBe("Cabriolet");
    });

    it("should extract Targa", () => {
      expect(parseBodyStyleFromText("Porsche 911 Targa 4S")).toBe("Targa");
    });

    it("should extract Spider/Spyder", () => {
      expect(parseBodyStyleFromText("Ferrari 488 Spider")).toBe("Spider");
      expect(parseBodyStyleFromText("Porsche 718 Spyder")).toBe("Spyder");
    });

    it("should extract Convertible", () => {
      expect(parseBodyStyleFromText("BMW M4 Convertible")).toBe("Convertible");
    });

    it("should extract SUV", () => {
      expect(parseBodyStyleFromText("Porsche Cayenne SUV")).toBe("SUV");
    });

    it("should extract Sedan", () => {
      expect(parseBodyStyleFromText("Porsche Panamera Sedan")).toBe("Sedan");
    });

    it("should return null when no body style", () => {
      expect(parseBodyStyleFromText("2020 Porsche 911 Carrera 4S")).toBeNull();
    });
  });

  describe("parseTrimFromText", () => {
    it("should extract GT3 RS", () => {
      expect(parseTrimFromText("2023 Porsche 911 GT3 RS")).toBe("GT3 RS");
    });

    it("should extract GT3", () => {
      expect(parseTrimFromText("2022 Porsche 911 GT3")).toBe("GT3");
    });

    it("should extract Turbo S", () => {
      expect(parseTrimFromText("Porsche 911 Turbo S")).toBe("Turbo S");
    });

    it("should extract Turbo", () => {
      expect(parseTrimFromText("Porsche 911 Turbo")).toBe("Turbo");
    });

    it("should extract GTS", () => {
      expect(parseTrimFromText("2024 Porsche 911 Carrera GTS")).toBe("GTS");
    });

    it("should extract Carrera 4S", () => {
      expect(parseTrimFromText("Porsche 911 Carrera 4S")).toBe("Carrera 4S");
    });

    it("should extract Carrera S", () => {
      expect(parseTrimFromText("Porsche 911 Carrera S")).toBe("Carrera S");
    });

    it("should extract GT4", () => {
      expect(parseTrimFromText("718 Cayman GT4")).toBe("GT4");
    });

    it("should return null for base model", () => {
      expect(parseTrimFromText("2023 Porsche Cayenne")).toBeNull();
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/features/scrapers/common/titleEnrichment.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement the title parsers**

Create `src/features/scrapers/common/titleEnrichment.ts`:

```typescript
/**
 * Regex-based parsers for extracting structured data from listing titles/descriptions.
 * These are best-effort: they only fill null fields, never overwrite existing data.
 */

/**
 * Extract engine description from text.
 * Matches patterns like "3.0L Twin-Turbo", "4.0-Liter Flat-Six", "V8", "Flat-Six".
 */
export function parseEngineFromText(text: string): string | null {
  // Pattern: displacement + optional config + optional forced induction
  // e.g., "3.0L Twin-Turbo", "4.0-Liter Flat-Six", "3.9L V8 Twin-Turbo"
  const displacementPattern =
    /\b(\d\.\d)\s*(?:-\s*)?(?:L(?:iter)?|litre)\s*((?:(?:Twin-?\s*)?Turbo(?:charged)?|Supercharged|(?:Flat|Boxer|Inline|Straight|V)-?\s*\d+|V\d+|I\d+)(?:\s+(?:(?:Twin-?\s*)?Turbo(?:charged)?|Supercharged))?)/i;

  const dispMatch = text.match(displacementPattern);
  if (dispMatch) {
    const displacement = `${dispMatch[1]}L`;
    const config = dispMatch[2].trim();
    return `${displacement} ${config}`;
  }

  // Displacement only: "3.0L" (without following config)
  const dispOnly = text.match(/\b(\d\.\d)\s*(?:-\s*)?(?:L(?:iter)?|litre)\b/i);

  // Config without displacement: "Flat-Six", "V8 Twin-Turbo"
  const configPattern =
    /\b((?:Flat|Boxer|Inline|Straight)-?\s*(?:Six|Four|Eight|6|4|8|12)|V\s*(?:6|8|10|12)|I\s*(?:4|6))\s*((?:Twin-?\s*)?Turbo(?:charged)?|Supercharged)?/i;

  const configMatch = text.match(configPattern);
  if (configMatch) {
    // Guard: don't match in mileage context
    if (/\b\d[\d,]*\s*(?:miles?|km|kilometers?)\b/i.test(text) && !dispOnly && !configMatch[2]) {
      // Only engine config, no displacement, and text looks like mileage — skip
      const configStart = text.indexOf(configMatch[0]);
      const before = text.slice(Math.max(0, configStart - 20), configStart);
      if (/\d/.test(before)) return null;
    }

    const parts: string[] = [];
    if (dispOnly) parts.push(`${dispOnly[1]}L`);
    parts.push(configMatch[1].trim());
    if (configMatch[2]) parts.push(configMatch[2].trim());
    return parts.join(" ");
  }

  if (dispOnly) {
    return `${dispOnly[1]}L`;
  }

  // Standalone forced induction (rare but useful)
  const turboOnly = text.match(/\b((?:Twin-?\s*)?Turbo(?:charged)?|Supercharged)\b/i);
  if (turboOnly) {
    // Guard: "Turbo" is also a Porsche trim — only match if there's more engine context
    const hasEngineContext = /\b(?:engine|motor|power|hp|bhp|displacement|cylinder)\b/i.test(text);
    if (hasEngineContext) return turboOnly[1];
  }

  return null;
}

/**
 * Extract transmission type from text.
 * Matches: "6-Speed Manual", "PDK", "7-Speed DCT", "Automatic", "Tiptronic".
 */
export function parseTransmissionFromText(text: string): string | null {
  // N-speed + type: "6-Speed Manual", "7-Speed PDK", "8-Speed Automatic"
  const speedPattern =
    /\b(\d)\s*-?\s*(?:speed|spd)\s+(manual|automatic|auto|PDK|DCT|DSG|SMG|F1|Tiptronic|sequential)\b/i;
  const speedMatch = text.match(speedPattern);
  if (speedMatch) {
    const speed = speedMatch[1];
    let type = speedMatch[2];
    // Capitalize
    type = type.charAt(0).toUpperCase() + type.slice(1);
    if (type.toLowerCase() === "auto") type = "Automatic";
    return `${speed}-Speed ${type}`;
  }

  // Standalone keywords (case-insensitive, word boundary)
  const standalonePattern =
    /\b(PDK|DCT|DSG|SMG|Tiptronic|F1\s*gearbox|Sequential)\b/i;
  const standaloneMatch = text.match(standalonePattern);
  if (standaloneMatch) return standaloneMatch[1];

  // "Manual" or "Automatic" as standalone word (not part of "manual steering" etc.)
  const simplePattern = /\b(Manual|Automatic)\s*(?:Transmission|Gearbox|Trans\.?)?\b/i;
  const simpleMatch = text.match(simplePattern);
  if (simpleMatch) {
    // Guard: avoid false positives with "manual steering", "manual windows"
    const word = simpleMatch[1];
    const afterWord = text.slice(text.indexOf(simpleMatch[0]) + simpleMatch[0].length, text.indexOf(simpleMatch[0]) + simpleMatch[0].length + 20);
    if (/^\s*(steering|window|mirror|seat|lock|brake)/i.test(afterWord)) return null;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  return null;
}

/**
 * Extract body style from text.
 * Matches: Coupe, Cabriolet, Targa, Spider/Spyder, Convertible, Sedan, Wagon, SUV.
 */
export function parseBodyStyleFromText(text: string): string | null {
  const pattern =
    /\b(Coup[eé]|Cabriolet|Targa|Spider|Spyder|Berlinetta|Roadster|Convertible|Sedan|Saloon|Wagon|Estate|Shooting\s*Brake|SUV|Hatchback|GTB|GTC)\b/i;
  const match = text.match(pattern);
  if (!match) return null;

  // Normalize casing
  const raw = match[1];
  const lower = raw.toLowerCase();
  const MAP: Record<string, string> = {
    coupe: "Coupe",
    coupé: "Coupe",
    cabriolet: "Cabriolet",
    targa: "Targa",
    spider: "Spider",
    spyder: "Spyder",
    berlinetta: "Berlinetta",
    roadster: "Roadster",
    convertible: "Convertible",
    sedan: "Sedan",
    saloon: "Sedan",
    wagon: "Wagon",
    estate: "Wagon",
    suv: "SUV",
    hatchback: "Hatchback",
    gtb: "GTB",
    gtc: "GTC",
  };
  // Handle "Shooting Brake" separately
  if (/shooting\s*brake/i.test(raw)) return "Shooting Brake";
  return MAP[lower] ?? raw;
}

/**
 * Extract trim level from text.
 * Matches known Porsche and collector car trims in priority order.
 */
export function parseTrimFromText(text: string): string | null {
  // Order matters: check compound trims first, then simpler ones
  const TRIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bGT3\s*RS\b/i, label: "GT3 RS" },
    { pattern: /\bGT2\s*RS\b/i, label: "GT2 RS" },
    { pattern: /\bTurbo\s+S\b/i, label: "Turbo S" },
    { pattern: /\bCarrera\s+4\s*GTS\b/i, label: "Carrera 4 GTS" },
    { pattern: /\bCarrera\s+GTS\b/i, label: "Carrera GTS" },
    { pattern: /\bCarrera\s+4S\b/i, label: "Carrera 4S" },
    { pattern: /\bCarrera\s+4\b/i, label: "Carrera 4" },
    { pattern: /\bCarrera\s+S\b/i, label: "Carrera S" },
    { pattern: /\bTarga\s+4\s*GTS\b/i, label: "Targa 4 GTS" },
    { pattern: /\bTarga\s+4S\b/i, label: "Targa 4S" },
    { pattern: /\bTarga\s+4\b/i, label: "Targa 4" },
    { pattern: /\bGT3\b/i, label: "GT3" },
    { pattern: /\bGT2\b/i, label: "GT2" },
    { pattern: /\bGT4\s*RS\b/i, label: "GT4 RS" },
    { pattern: /\bGT4\b/i, label: "GT4" },
    { pattern: /\bGTS\b/i, label: "GTS" },
    { pattern: /\bTurbo\b/i, label: "Turbo" },
    { pattern: /\bCarrera\b/i, label: "Carrera" },
    // Ferrari trims
    { pattern: /\bSpeciale\s*A?\b/i, label: "Speciale" },
    { pattern: /\bScuderia\b/i, label: "Scuderia" },
    { pattern: /\bPista\s*Spider\b/i, label: "Pista Spider" },
    { pattern: /\bPista\b/i, label: "Pista" },
    { pattern: /\bCompetizione\b/i, label: "Competizione" },
    // BMW trims
    { pattern: /\bCompetition\b/i, label: "Competition" },
    { pattern: /\bCS\b/, label: "CS" }, // case-sensitive to avoid "cs" in URLs
  ];

  for (const { pattern, label } of TRIM_PATTERNS) {
    if (pattern.test(text)) return label;
  }

  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/features/scrapers/common/titleEnrichment.test.ts`
Expected: PASS

- [ ] **Step 5: Fix any failing tests, iterate**

Adjust regex patterns based on test results. This is the TDD iteration cycle — keep running tests until all pass.

- [ ] **Step 6: Commit**

```bash
git add src/features/scrapers/common/titleEnrichment.ts \
       src/features/scrapers/common/titleEnrichment.test.ts
git commit -m "feat(enrichment): add title parsing for engine, transmission, body, trim"
```

---

## Task 5: Title Enrichment CLI + Cron

**Files:**
- Create: `scripts/enrich-from-titles.ts`
- Create: `src/app/api/cron/enrich-titles/route.ts`
- Modify: `vercel.json`
- Modify: `src/features/scrapers/common/monitoring/types.ts`

- [ ] **Step 1: (Already done in Task 3 Step 1 — ScraperName includes 'enrich-titles')**

- [ ] **Step 2: Create the CLI script**

Create `scripts/enrich-from-titles.ts`:

```typescript
/**
 * CLI: Enrich listings with missing engine/transmission/trim/body by parsing titles.
 *
 * Usage:
 *   npx tsx scripts/enrich-from-titles.ts
 *   npx tsx scripts/enrich-from-titles.ts --limit=5000 --dryRun
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "../src/features/scrapers/common/titleEnrichment";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = { limit: 5000, dryRun: false, source: "" };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "source") opts.source = val;
    } else {
      if (arg.slice(2) === "dryRun") opts.dryRun = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  console.log(`\n=== Title Enrichment ===`);
  console.log(`Limit: ${opts.limit}, Dry run: ${opts.dryRun}`);
  if (opts.source) console.log(`Source filter: ${opts.source}`);
  console.log();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Query listings with at least one null field that could be enriched from title
  let query = supabase
    .from("listings")
    .select("id, title, engine, transmission, body_style, trim, source")
    .or("engine.is.null,transmission.is.null,body_style.is.null,trim.is.null")
    .eq("status", "active")
    .not("title", "is", null)
    .limit(opts.limit);

  if (opts.source) {
    query = query.eq("source", opts.source);
  }

  const { data: listings, error } = await query;

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} listings with parseable titles\n`);

  let updated = 0;
  let skipped = 0;
  const stats = { engine: 0, transmission: 0, bodyStyle: 0, trim: 0 };

  for (const listing of listings) {
    const title = listing.title as string;
    const updates: Record<string, string> = {};

    if (!listing.engine) {
      const engine = parseEngineFromText(title);
      if (engine) {
        updates.engine = engine;
        stats.engine++;
      }
    }
    if (!listing.transmission) {
      const transmission = parseTransmissionFromText(title);
      if (transmission) {
        updates.transmission = transmission;
        stats.transmission++;
      }
    }
    if (!listing.body_style) {
      const bodyStyle = parseBodyStyleFromText(title);
      if (bodyStyle) {
        updates.body_style = bodyStyle;
        stats.bodyStyle++;
      }
    }
    if (!listing.trim) {
      const trim = parseTrimFromText(title);
      if (trim) {
        updates.trim = trim;
        stats.trim++;
      }
    }

    if (Object.keys(updates).length === 0) {
      skipped++;
      continue;
    }

    if (opts.dryRun) {
      if (updated < 20) {
        console.log(`  [DRY] "${title.slice(0, 60)}" → ${JSON.stringify(updates)}`);
      }
    } else {
      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);
      if (updateErr) {
        console.error(`  Error updating ${listing.id}: ${updateErr.message}`);
        continue;
      }
    }
    updated++;
  }

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings scanned: ${listings.length}`);
  console.log(`Updated: ${updated}`);
  console.log(`Skipped (no parseable data): ${skipped}`);
  console.log(`Fields filled — engine: ${stats.engine}, transmission: ${stats.transmission}, body: ${stats.bodyStyle}, trim: ${stats.trim}`);
  console.log(`Done!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Create the cron route**

Create `src/app/api/cron/enrich-titles/route.ts` following the same pattern as `enrich-vin/route.ts`:

```typescript
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  parseEngineFromText,
  parseTransmissionFromText,
  parseBodyStyleFromText,
  parseTrimFromText,
} from "@/features/scrapers/common/titleEnrichment";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "@/features/scrapers/common/monitoring/record";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Title parsing is CPU-only, very fast

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  const startTime = Date.now();
  const runId = crypto.randomUUID();
  const startedAt = new Date(startTime).toISOString();

  await markScraperRunStarted({
    scraperName: "enrich-titles",
    runId,
    startedAt,
    runtime: "vercel_cron",
  });

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    const { data: listings, error } = await supabase
      .from("listings")
      .select("id, title, engine, transmission, body_style, trim")
      .or("engine.is.null,transmission.is.null,body_style.is.null,trim.is.null")
      .eq("status", "active")
      .not("title", "is", null)
      .limit(5000);

    if (error) throw new Error(`Query error: ${error.message}`);

    const discovered = listings.length;
    let written = 0;
    const errors: string[] = [];

    for (const listing of listings) {
      const title = listing.title as string;
      const updates: Record<string, string> = {};

      if (!listing.engine) {
        const engine = parseEngineFromText(title);
        if (engine) updates.engine = engine;
      }
      if (!listing.transmission) {
        const transmission = parseTransmissionFromText(title);
        if (transmission) updates.transmission = transmission;
      }
      if (!listing.body_style) {
        const bodyStyle = parseBodyStyleFromText(title);
        if (bodyStyle) updates.body_style = bodyStyle;
      }
      if (!listing.trim) {
        const trim = parseTrimFromText(title);
        if (trim) updates.trim = trim;
      }

      if (Object.keys(updates).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);

      if (updateErr) {
        errors.push(`${listing.id}: ${updateErr.message}`);
        continue;
      }
      written++;
    }

    await recordScraperRun({
      scraper_name: "enrich-titles",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: true,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered,
      written,
      errors_count: errors.length,
      error_messages: errors.length > 0 ? errors : undefined,
    });
    await clearScraperRunActive("enrich-titles");

    return NextResponse.json({
      success: true,
      runId,
      duration: `${Date.now() - startTime}ms`,
      discovered,
      written,
      errors: errors.slice(0, 10),
    });
  } catch (err: any) {
    await recordScraperRun({
      scraper_name: "enrich-titles",
      run_id: runId,
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      success: false,
      runtime: "vercel_cron",
      duration_ms: Date.now() - startTime,
      discovered: 0,
      written: 0,
      errors_count: 1,
      error_messages: [err.message],
    });
    await clearScraperRunActive("enrich-titles");
    return NextResponse.json({ success: false, error: err.message }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add cron schedule to vercel.json**

Add to the crons array:

```json
{ "path": "/api/cron/enrich-titles", "schedule": "15 7 * * *" }
```

- [ ] **Step 5: Test CLI with --dryRun**

Run: `npx tsx scripts/enrich-from-titles.ts --limit=100 --dryRun`
Expected: Shows which titles would get which parsed fields. Spot-check 10-20 results for accuracy.

- [ ] **Step 6: Run for real with small batch**

Run: `npx tsx scripts/enrich-from-titles.ts --limit=100`
Expected: Updates ~30-60 listings with parsed engine/transmission/trim/body.

- [ ] **Step 7: Commit**

```bash
git add scripts/enrich-from-titles.ts \
       src/app/api/cron/enrich-titles/route.ts \
       src/features/scrapers/common/monitoring/types.ts \
       vercel.json
git commit -m "feat(enrichment): add title enrichment CLI + daily cron"
```

---

## Task 6: BaT Detail Scraper Pre-flight & CLI

**Files:**
- Create: `scripts/bat-detail-scraper.ts`
- Modify: `src/features/scrapers/common/monitoring/types.ts`

- [ ] **Step 1: (Already done in Task 3 Step 1 — ScraperName includes 'bat-detail')**

- [ ] **Step 2: Create the BaT detail scraper CLI**

Create `scripts/bat-detail-scraper.ts`:

```typescript
/**
 * CLI: Scrape BaT detail pages for listings missing key fields.
 * Designed for GitHub Actions (30-minute budget).
 *
 * Usage:
 *   npx tsx scripts/bat-detail-scraper.ts
 *   npx tsx scripts/bat-detail-scraper.ts --limit=10 --dryRun
 *   npx tsx scripts/bat-detail-scraper.ts --timeBudgetMs=1800000
 */
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(__dirname, "../.env.local");
if (existsSync(envPath)) {
  const envContent = readFileSync(envPath, "utf-8");
  for (const line of envContent.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const k = trimmed.slice(0, eqIdx).trim();
    const v = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[k]) process.env[k] = v;
  }
}

import { scrapeDetail, type BaTAuction } from "../src/features/scrapers/auctions/bringATrailer";
import {
  markScraperRunStarted,
  recordScraperRun,
  clearScraperRunActive,
} from "../src/features/scrapers/common/monitoring/record";

function parseArgs() {
  const args = process.argv.slice(2);
  const opts = {
    limit: 700,
    timeBudgetMs: 20 * 60 * 1000, // 20 minutes (safe margin for 30-min workflow)
    delayMs: 2500,
    dryRun: false,
    preflight: false,
  };
  for (const arg of args) {
    if (!arg.startsWith("--")) continue;
    const eqIdx = arg.indexOf("=");
    if (eqIdx > 0) {
      const key = arg.slice(2, eqIdx);
      const val = arg.slice(eqIdx + 1);
      if (key === "limit") opts.limit = parseInt(val, 10);
      if (key === "timeBudgetMs") opts.timeBudgetMs = parseInt(val, 10);
      if (key === "delayMs") opts.delayMs = parseInt(val, 10);
    } else {
      const key = arg.slice(2);
      if (key === "dryRun") opts.dryRun = true;
      if (key === "preflight") opts.preflight = true;
    }
  }
  return opts;
}

async function main() {
  const opts = parseArgs();
  const startTime = Date.now();
  const runId = crypto.randomUUID();

  console.log(`\n=== BaT Detail Scraper ===`);
  console.log(`Limit: ${opts.limit}`);
  console.log(`Time budget: ${Math.round(opts.timeBudgetMs / 1000)}s`);
  console.log(`Delay: ${opts.delayMs}ms`);
  console.log(`Dry run: ${opts.dryRun}`);
  console.log(`Pre-flight: ${opts.preflight}\n`);

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE env vars");
    process.exit(1);
  }
  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Record run start
  const runtime = process.env.GITHUB_ACTIONS ? "github_actions" as const : "cli" as const;
  await markScraperRunStarted({
    scraperName: "bat-detail",
    runId,
    startedAt: new Date(startTime).toISOString(),
    runtime,
  });

  // Query BaT listings needing enrichment
  const { data: listings, error } = await supabase
    .from("listings")
    .select("id, source_url, title, images, engine, mileage_km, vin, transmission, exterior_color, interior_color")
    .eq("source", "BaT")
    .eq("status", "active")
    .or("engine.is.null,mileage_km.is.null,vin.is.null,images.eq.{}")
    .order("scrape_timestamp", { ascending: true })
    .limit(opts.limit);

  if (error) {
    console.error("Query error:", error.message);
    process.exit(1);
  }

  console.log(`Found ${listings.length} BaT listings needing enrichment\n`);

  if (opts.preflight) {
    // Pre-flight: test first 5 to verify scrapeDetail works
    console.log("=== PRE-FLIGHT CHECK ===\n");
    const sample = listings.slice(0, 5);
    let passed = 0;
    for (const listing of sample) {
      const stub: BaTAuction = {
        externalId: listing.id,
        platform: "BRING_A_TRAILER",
        title: listing.title || "",
        make: "Porsche",
        model: "",
        year: 0,
        mileage: null,
        mileageUnit: "miles",
        transmission: null,
        engine: null,
        exteriorColor: null,
        interiorColor: null,
        location: null,
        currentBid: null,
        bidCount: 0,
        endTime: null,
        url: listing.source_url,
        imageUrl: null,
        description: null,
        sellerNotes: null,
        status: "active",
        vin: null,
        images: [],
        reserveStatus: null,
        bodyStyle: null,
      };

      try {
        const enriched = await scrapeDetail(stub);
        const hasImages = enriched.images.length > 0;
        const hasEngine = !!enriched.engine;
        const hasMileage = enriched.mileage != null;
        console.log(`  ${listing.source_url}`);
        console.log(`    images: ${enriched.images.length}, engine: ${enriched.engine || "null"}, mileage: ${enriched.mileage ?? "null"}, vin: ${enriched.vin || "null"}`);
        if (hasImages || hasEngine || hasMileage) passed++;
        await new Promise((r) => setTimeout(r, opts.delayMs));
      } catch (err: any) {
        console.log(`  ERROR: ${listing.source_url} — ${err.message}`);
      }
    }
    console.log(`\nPre-flight: ${passed}/${sample.length} returned enriched data`);
    if (passed < 3) {
      console.error("WARNING: Pre-flight check failed (<3 enriched). Investigate before batch run.");
      process.exit(1);
    }
    console.log("Pre-flight PASSED. Run without --preflight for batch execution.\n");
    await clearScraperRunActive("bat-detail");
    return;
  }

  // Batch execution
  let enriched = 0;
  let written = 0;
  const errors: string[] = [];

  for (let i = 0; i < listings.length; i++) {
    // Time budget check
    if (Date.now() - startTime > opts.timeBudgetMs) {
      console.log(`\nTime budget reached after ${i} listings.`);
      break;
    }

    const listing = listings[i];
    const stub: BaTAuction = {
      externalId: listing.id,
      platform: "BRING_A_TRAILER",
      title: listing.title || "",
      make: "",
      model: "",
      year: 0,
      mileage: null,
      mileageUnit: "miles",
      transmission: null,
      engine: null,
      exteriorColor: null,
      interiorColor: null,
      location: null,
      currentBid: null,
      bidCount: 0,
      endTime: null,
      url: listing.source_url,
      imageUrl: null,
      description: null,
      sellerNotes: null,
      status: "active",
      vin: null,
      images: [],
      reserveStatus: null,
      bodyStyle: null,
    };

    try {
      const detail = await scrapeDetail(stub);
      enriched++;

      if (opts.dryRun) {
        console.log(`  [DRY] ${listing.source_url}: images=${detail.images.length}, engine=${detail.engine}, mileage=${detail.mileage}`);
        written++;
        continue;
      }

      // Build update: only fill null fields
      const updates: Record<string, any> = {};
      if (detail.images.length > 0 && (!listing.images || listing.images.length === 0 || (listing.images.length === 1 && listing.images[0] === ""))) {
        updates.images = detail.images;
        updates.photos_count = detail.images.length;
      }
      if (!listing.engine && detail.engine) updates.engine = detail.engine;
      if (!listing.mileage_km && detail.mileage != null) {
        const km = detail.mileageUnit === "km" ? detail.mileage : Math.round(detail.mileage * 1.609344);
        updates.mileage_km = km;
        updates.mileage_unit_stored = "km";
      }
      if (!listing.vin && detail.vin) updates.vin = detail.vin;
      if (!listing.transmission && detail.transmission) updates.transmission = detail.transmission;
      // Only fill null fields — never overwrite existing data
      if (detail.exteriorColor && !listing.exterior_color) updates.exterior_color = detail.exteriorColor;
      if (detail.interiorColor && !listing.interior_color) updates.interior_color = detail.interiorColor;
      if (detail.bodyStyle) updates.body_style = detail.bodyStyle;
      if (detail.description) updates.description_text = detail.description;
      if (detail.sellerNotes) updates.seller_notes = detail.sellerNotes;

      if (Object.keys(updates).length === 0) continue;

      const { error: updateErr } = await supabase
        .from("listings")
        .update(updates)
        .eq("id", listing.id);

      if (updateErr) {
        errors.push(`${listing.id}: ${updateErr.message}`);
        continue;
      }
      written++;

      if (written % 50 === 0) {
        console.log(`  Progress: ${written} updated, ${i + 1}/${listings.length} processed`);
      }
    } catch (err: any) {
      errors.push(`${listing.source_url}: ${err.message}`);
    }

    // Rate limit
    await new Promise((r) => setTimeout(r, opts.delayMs));
  }

  // Record run
  await recordScraperRun({
    scraper_name: "bat-detail",
    run_id: runId,
    started_at: new Date(startTime).toISOString(),
    finished_at: new Date().toISOString(),
    success: errors.length < listings.length / 2,
    runtime,
    duration_ms: Date.now() - startTime,
    discovered: listings.length,
    written,
    errors_count: errors.length,
    details_fetched: enriched,
    error_messages: errors.length > 0 ? errors.slice(0, 50) : undefined,
  });
  await clearScraperRunActive("bat-detail");

  console.log(`\n=== SUMMARY ===`);
  console.log(`Listings queried: ${listings.length}`);
  console.log(`Detail pages fetched: ${enriched}`);
  console.log(`DB updates: ${written}`);
  console.log(`Errors: ${errors.length}`);
  console.log(`Duration: ${Math.round((Date.now() - startTime) / 1000)}s`);
  if (errors.length > 0) {
    console.log(`\nFirst 10 errors:`);
    for (const err of errors.slice(0, 10)) console.log(`  - ${err}`);
  }
  console.log(`\nDone!`);
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
```

- [ ] **Step 3: Run pre-flight check**

Run: `npx tsx scripts/bat-detail-scraper.ts --preflight`
Expected: Tests 5 BaT URLs and verifies scrapeDetail() returns data. Must pass 3/5 to continue.

- [ ] **Step 4: Test with small batch**

Run: `npx tsx scripts/bat-detail-scraper.ts --limit=10`
Expected: Enriches ~5-10 BaT listings with images, engine, mileage, VIN.

- [ ] **Step 5: Commit**

```bash
git add scripts/bat-detail-scraper.ts \
       src/features/scrapers/common/monitoring/types.ts
git commit -m "feat(bat): add detail scraper CLI with pre-flight check"
```

---

## Task 7: BaT Detail Scraper GitHub Actions Workflow

**Files:**
- Create: `.github/workflows/bat-detail-scraper.yml`

- [ ] **Step 1: Create the workflow file**

Create `.github/workflows/bat-detail-scraper.yml`:

```yaml
name: BaT Detail Scraper

on:
  schedule:
    - cron: '30 1 * * *'  # 01:30 UTC daily (after Porsche cron at 01:00)
  workflow_dispatch:
    inputs:
      limit:
        description: 'Max listings to process'
        default: '700'
      time_budget_minutes:
        description: 'Time budget in minutes'
        default: '20'
      dry_run:
        description: 'Skip DB writes'
        default: 'false'

concurrency:
  group: bat-detail-scraper
  cancel-in-progress: false

jobs:
  scrape:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: '20'

      - run: npm ci

      - name: Run BaT Detail Scraper
        env:
          NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.NEXT_PUBLIC_SUPABASE_URL }}
          SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
        run: |
          BUDGET_MS=$(( ${{ github.event.inputs.time_budget_minutes || '20' }} * 60 * 1000 ))
          npx tsx scripts/bat-detail-scraper.ts \
            --limit=${{ github.event.inputs.limit || '700' }} \
            --timeBudgetMs=$BUDGET_MS \
            ${{ github.event.inputs.dry_run == 'true' && '--dryRun' || '' }}
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/bat-detail-scraper.yml
git commit -m "ci(bat): add daily GitHub Actions workflow for detail scraping"
```

---

## Task 8: Classic.com rebrowser-patches Integration

**Files:**
- Modify: `package.json` — add `rebrowser-playwright` dependency
- Modify: `src/features/scrapers/classic_collector/browser.ts` — use rebrowser for browser launch

- [ ] **Step 1: Install rebrowser-playwright**

Run: `npm install rebrowser-playwright`

This installs the patched Playwright that bypasses CDP detection. It has the same API as `playwright`.

- [ ] **Step 2: Read the current browser.ts to understand the import pattern**

Read `src/features/scrapers/classic_collector/browser.ts` and note exactly how it imports from `@/features/scrapers/common/serverless-browser` and which functions it uses.

- [ ] **Step 3: Modify browser.ts to use rebrowser-playwright for local/GA execution**

In `src/features/scrapers/classic_collector/browser.ts`, change the `launchStealthBrowser` function to use `rebrowser-playwright` when NOT running on Vercel:

```typescript
// At the top of browser.ts, add:
import type { Browser, BrowserContext, Page } from "playwright-core";

// In launchStealthBrowser, replace the serverless-browser call with:
export async function launchStealthBrowser(config: BrowserConfig): Promise<Browser> {
  // On Vercel: use existing serverless-browser (sparticuz/chromium)
  if (process.env.VERCEL) {
    const { launchServerlessBrowser } = await import("@/features/scrapers/common/serverless-browser");
    return launchServerlessBrowser({
      headless: config.headless,
      args: STEALTH_ARGS,
      proxyServer: config.proxyServer,
      proxyUsername: config.proxyUsername,
      proxyPassword: config.proxyPassword,
    });
  }

  // Local / GitHub Actions: use rebrowser-playwright for Cloudflare bypass
  const { chromium } = await import("rebrowser-playwright");
  const launchOptions: any = {
    headless: config.headless,
    args: STEALTH_ARGS,
  };

  if (config.proxyServer) {
    launchOptions.proxy = {
      server: config.proxyServer,
      username: config.proxyUsername,
      password: config.proxyPassword,
    };
  }

  return chromium.launch(launchOptions) as unknown as Browser;
}
```

**Key design: ONLY Classic.com's browser.ts is changed.** The shared `serverless-browser.ts` and AutoScout24's `browser.ts` remain untouched.

- [ ] **Step 4: Test against Classic.com without proxy**

Run: `npx tsx scripts/backfill-classic-images.ts --maxListings=20`

Expected:
- If rebrowser-patches works: >10 listings backfilled without Cloudflare blocks
- If still blocked: <3 listings before circuit-break. In this case, revert changes and fall back to proxy approach.

- [ ] **Step 5: If successful, test with larger batch**

Run: `npx tsx scripts/backfill-classic-images.ts --maxListings=100 --timeBudgetMs=600000`

Expected: 50+ listings backfilled.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json \
       src/features/scrapers/classic_collector/browser.ts
git commit -m "feat(classic): use rebrowser-playwright for Cloudflare bypass"
```

**Rollback plan:** If rebrowser-patches stops working in the future:
1. `npm uninstall rebrowser-playwright`
2. Revert `browser.ts` to use `launchServerlessBrowser` unconditionally
3. Re-add proxy support via GitHub secrets

---

## Task 9: Final Verification & Monitoring Update

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run src/features/scrapers/`
Expected: All existing + new tests pass.

- [ ] **Step 2: Verify vercel.json is valid**

Run: `node -e "const v = require('./vercel.json'); console.log(JSON.stringify(v.crons, null, 2))"`
Expected: Shows all cron entries including new `enrich-vin` (07:00) and `enrich-titles` (07:15).

- [ ] **Step 3: Run enrichment dry runs to verify end-to-end**

Run in parallel:
```bash
npx tsx scripts/enrich-from-vin.ts --limit=20 --dryRun
npx tsx scripts/enrich-from-titles.ts --limit=50 --dryRun
```
Expected: Both show listings that would be enriched.

- [ ] **Step 4: Commit any remaining changes**

```bash
git add -A
git commit -m "chore(enrichment): final verification and cleanup"
```

- [ ] **Step 5: Run live enrichment**

```bash
npx tsx scripts/enrich-from-vin.ts --limit=500
npx tsx scripts/enrich-from-titles.ts --limit=5000
npx tsx scripts/bat-detail-scraper.ts --limit=50
```

Expected: Significant number of listings enriched. Report totals.

---

## Notes

### Phase 4 (AutoScout24 HTTP Discovery) is intentionally excluded from this plan.
It's marked as experimental in the spec. If Phases 1A-3 succeed, the value of Phase 4 diminishes. It can be planned separately if needed.

### Field name contingency for Task 1
The AutoTrader GraphQL field names in this plan are estimates. The probe script (Step 1) will discover the actual names. If all fields are rejected, skip Task 1 and rely on Phases 1B/1C.

### GitHub Actions minutes budget
After adding BaT detail scraper (20 min/day), estimated total:
- Classic.com: ~20 min/day
- AutoScout24: ~20 min/day
- BaT detail: ~20 min/day
- **Total: ~1800 min/month** (within 2000 free minutes)

If close to limit, reduce BaT to every-other-day by changing cron to `30 1 */2 * *`.
