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
