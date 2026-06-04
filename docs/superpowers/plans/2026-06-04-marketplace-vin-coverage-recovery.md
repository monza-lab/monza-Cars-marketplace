# Marketplace VIN Coverage Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Increase trustworthy VIN coverage across marketplaces that currently under-retrieve identifiers, while keeping chassis/frame/serial values separate from decodable 17-character VINs.

**Architecture:** Keep retrieval source-native first: marketplace scrapers extract identifiers only from source-exposed structured payloads, JSON-LD, labeled page fields, or audited API payloads. Use the existing `src/features/scrapers/common/vehicleIdentifier.ts` boundary for classification, write true `vin_17` values into `listings.vin`, and preserve non-VIN source identifiers in metadata or a dedicated schema after a migration is explicitly verified.

**Tech Stack:** TypeScript, Vitest, Cheerio, existing scraper collectors, existing Supabase client, current `listings` table, `agents/testscripts/artifacts` audit outputs. Runtime deps: 0. Dev deps: 0.

---

## Phase Zero Context

Latest evidence from `agents/testscripts/artifacts/vin-retrieval-audit-2026-06-04T17-27-27-673Z.json`:

| Source | Active rows | Identifier rows | VIN-17 rows | Short ID rows | Invalid/noisy rows | Priority |
|---|---:|---:|---:|---:|---:|---|
| AutoScout24 | 16,904 | 1 | 1 | 0 | 0 | P0 proof audit, likely source-limited |
| Elferspot | 3,851 | 1,060 | 1,060 | 0 | 0 | P0 enrichment targeting and historical rerun |
| AutoTrader | 817 | 3 | 3 | 0 | 0 | P0 structured payload and Scrapling proof audit |
| ClassicCom | 753 | 753 | 719 | 34 | 0 | P2 protect; already strong |
| BeForward | 422 | 71 | 36 | 8 | 27 | P0 clean legacy/noisy semantics and recover true VINs |
| BaT | 196 | 189 | 160 | 29 | 0 | P2 protect; already strong |

Definition of success:

- Increase true 17-character VIN coverage only where source data exposes true VINs.
- Increase retained vehicle identifier coverage by preserving labeled chassis/frame/serial values separately.
- Do not improve metrics by truncating, fabricating, or misclassifying non-VIN values.
- Produce a repeatable audit artifact before and after every major phase.

## File, LOC, Dependency Budget

Planned file budget:

| File | Action | Estimated LOC change |
|---|---|---:|
| `scripts/vin-retrieval-audit.ts` | Extend audit to include `enrichment_meta` and source identifier counts | +80 |
| `src/features/scrapers/common/vehicleIdentifier.ts` | Add metadata serialization helpers only if duplication reaches three call sites | +60 |
| `src/features/scrapers/autoscout24_collector/detail.test.ts` | Add parser fixtures for JSON-LD, labeled body, and unlabeled token guards | +120 |
| `src/features/scrapers/autoscout24_collector/detail.ts` | Classify JSON-LD/labeled identifiers, remove unsafe truncation path if needed | +50 |
| `src/features/scrapers/autoscout24_collector/scrapling.test.ts` | Add fixture tests around parsed Scrapling JSON payloads if exports allow it | +100 |
| `src/features/scrapers/autoscout24_collector/supabase_writer.ts` | Stop blind VIN truncation; preserve source identifier metadata if available | +40 |
| `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts` | Replace long-VIN truncation expectation with classification behavior | +80 |
| `scripts/as24_scrapling_fetch.py` | Add source-labeled identifier extraction only if audit fixtures prove fields exist | +70 |
| `agents/testscripts/as24-vin-proof-audit.ts` | Create sampled active-row proof audit for AS24 source payloads | +180 |
| `src/features/scrapers/autotrader_collector/detail.ts` | Extend structured payload identifier discovery and expose debug samples | +40 |
| `src/features/scrapers/autotrader_collector/detail.test.ts` | Add nested payload, spec label, and unlabeled-token tests | +90 |
| `scripts/autotrader_scrapling_fetch.py` | Replace broad body regex with labeled classifier-equivalent extraction | +80 |
| `agents/testscripts/autotrader-vin-proof-audit.ts` | Create sampled product-page/Scrapling proof audit | +160 |
| `src/features/scrapers/beforward_porsche_collector/*` | Persist source identifier metadata consistently and clean legacy invalid rows | +140 across files |
| `scripts/beforward-identifier-cleanup.ts` | Dry-run/apply cleanup for legacy truncated/noisy VIN rows | +180 |
| `src/app/api/cron/enrich-elferspot/route.ts` | Ensure active rows missing `vin` are targeted independent of trim/detail fields | +50 |
| `src/app/api/cron/enrich-elferspot/route.test.ts` | Add query targeting tests for rows missing VIN | +100 |
| `agents/testscripts/elferspot-vin-gap-audit.ts` | Sample missing-identifier rows and classify page evidence | +150 |
| `docs/scrapers/SCRAPERS.md` | Update source matrix after each phase | +120 |

Dependency budget:

- Runtime deps: **0**
- Dev deps: **0**
- External paid data providers: **0 in this plan**. If source-native audits prove sources do not expose VINs, propose a separate paid-data enrichment plan with legal/provider review.

Largest touched file target remains under 1,000 added/changed LOC. Split any file before it exceeds 2,000 LOC.

## Task 1: Strengthen the Baseline Audit

**Files:**

- Modify: `scripts/vin-retrieval-audit.ts`
- Test: `src/features/scrapers/common/vehicleIdentifier.test.ts`

- [ ] **Step 1: Write failing audit assertions for metadata-aware summaries**

Add tests by extending `src/features/scrapers/common/vehicleIdentifier.test.ts` with a pure helper export if `summarize()` is extracted from the script:

```ts
it("counts source metadata identifiers separately from vin column values", () => {
  const rows = [
    { source: "BeForward", vin: null, enrichment_meta: { beforward: { vehicleIdentifier: { normalized: "9113601234", kind: "chassis_or_serial" } } } },
    { source: "BeForward", vin: "WP0AA299XYS123456", enrichment_meta: null },
  ];
  const summaries = summarizeVinRetrievalRows(rows);
  expect(summaries[0]).toMatchObject({
    source: "BeForward",
    vin17Rows: 1,
    metadataIdentifierRows: 1,
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
npx vitest run src/features/scrapers/common/vehicleIdentifier.test.ts
```

Expected: FAIL because `summarizeVinRetrievalRows` is not exported.

- [ ] **Step 3: Extract pure summarizer from `scripts/vin-retrieval-audit.ts`**

Create a small exported type and function in the script:

```ts
export type VinRetrievalAuditRow = {
  source: string | null;
  vin: string | null;
  enrichment_meta?: unknown;
};

export function summarizeVinRetrievalRows(rows: VinRetrievalAuditRow[]): SourceSummary[] {
  // Move current summarize(rows) logic here.
  // Add metadataIdentifierRows and metadata samples by reading:
  // enrichment_meta.beforward.vehicleIdentifier.normalized
}
```

- [ ] **Step 4: Include metadata counts in artifact output**

Add fields to each source summary:

```ts
metadataIdentifierRows: number;
metadataChassisOrSerialRows: number;
metadataVin17Rows: number;
```

Update the query:

```ts
.select("id,source,source_url,make,status,vin,enrichment_meta")
```

- [ ] **Step 5: Verify baseline audit**

Run:

```powershell
npx vitest run src/features/scrapers/common/vehicleIdentifier.test.ts
npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active
```

Expected:

- Test passes.
- JSON artifact includes `metadataIdentifierRows`.
- Console table includes metadata identifier counts.

## Task 2: AutoScout24 Proof Audit Before Parser Work

**Why:** AutoScout24 has 16,904 active rows and only 1 VIN row. Existing code suggests the source usually hides VINs. Do not spend broad parser effort until samples prove an exposed field exists.

**Files:**

- Create: `agents/testscripts/as24-vin-proof-audit.ts`
- Read-only inputs: `src/features/scrapers/autoscout24_collector/detail.ts`, `src/features/scrapers/autoscout24_collector/scrapling.ts`, `scripts/as24_scrapling_fetch.py`
- Artifact: `agents/testscripts/artifacts/as24-vin-proof-audit-<timestamp>.json`

- [ ] **Step 1: Write the proof-audit script skeleton**

Create `agents/testscripts/as24-vin-proof-audit.ts`:

```ts
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { extractVehicleIdentifierFromText } from "../../src/features/scrapers/common/vehicleIdentifier";

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[key] = value;
  }
}
```

- [ ] **Step 2: Query active AS24 rows missing VIN**

Add:

```ts
async function fetchSample(limit: number) {
  loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
  loadEnvFromFile(path.resolve(process.cwd(), ".env"));
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client
    .from("listings")
    .select("id,source_url,title,vin")
    .eq("source", "AutoScout24")
    .eq("make", "Porsche")
    .eq("status", "active")
    .is("vin", null)
    .limit(limit);
  if (error) throw new Error(error.message);
  return data ?? [];
}
```

- [ ] **Step 3: Fetch pages and inspect evidence without writing DB**

Use `fetch` with browser-like headers and classify only labeled evidence:

```ts
async function inspectUrl(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(20_000),
  });
  const html = await response.text();
  const labeled = extractVehicleIdentifierFromText(html.replace(/<[^>]+>/g, " "));
  return {
    ok: response.ok,
    status: response.status,
    hasNextData: html.includes("__NEXT_DATA__"),
    hasJsonLdVehicleIdentifier: /vehicleIdentificationNumber/i.test(html),
    labeledIdentifier: labeled,
  };
}
```

- [ ] **Step 4: Write the artifact**

Run:

```powershell
npx tsx agents/testscripts/as24-vin-proof-audit.ts --limit=25
```

Expected:

- Artifact saved under `agents/testscripts/artifacts/`.
- Each sample reports whether any source-exposed identifier field exists.

- [ ] **Step 5: Decision gate**

Proceed to Task 3 only if at least one sample contains `vehicleIdentificationNumber`, labeled `VIN`, labeled `Chassis`, labeled `Frame`, or labeled `Serial`.

If zero samples expose identifiers:

- Mark AS24 as source-limited in `docs/scrapers/SCRAPERS.md`.
- Do not add broad body regex extraction.
- Keep AS24 priority at monitoring-only.

## Task 3: AutoScout24 Parser and Writer Fixes If Proof Succeeds

**Files:**

- Modify: `src/features/scrapers/autoscout24_collector/detail.ts`
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.ts`
- Modify: `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`
- Test: add or extend `src/features/scrapers/autoscout24_collector/detail.test.ts`

- [ ] **Step 1: Add failing detail parser tests**

Create `src/features/scrapers/autoscout24_collector/detail.test.ts` if it does not exist:

```ts
import { describe, expect, it } from "vitest";
import { parseDetailHtml } from "./detail";

describe("AutoScout24 detail identifier extraction", () => {
  it("extracts JSON-LD vehicleIdentificationNumber", () => {
    const html = `<html><body><script type="application/ld+json">
      {"@type":"Vehicle","vehicleIdentificationNumber":"wp0aa299xys123456"}
    </script></body></html>`;
    expect(parseDetailHtml(html).vin).toBe("WP0AA299XYS123456");
  });

  it("does not extract unlabeled VIN-looking tokens", () => {
    const html = `<html><body><p>Internal reference WP0AA299XYS123456</p></body></html>`;
    expect(parseDetailHtml(html).vin).toBeNull();
  });

  it("extracts labeled chassis identifiers", () => {
    const html = `<html><body><dl><dt>Chassis number</dt><dd>9113601234</dd></dl></body></html>`;
    expect(parseDetailHtml(html).vin).toBe("9113601234");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```powershell
npx vitest run src/features/scrapers/autoscout24_collector/detail.test.ts
```

Expected: JSON-LD and labeled chassis tests fail against current parser.

- [ ] **Step 3: Implement parser through shared classifier**

In `src/features/scrapers/autoscout24_collector/detail.ts`, import:

```ts
import { classifyVehicleIdentifier, extractVehicleIdentifierFromText } from "@/features/scrapers/common/vehicleIdentifier";
```

Extend `JsonLdData`:

```ts
vin: string | null;
```

Initialize:

```ts
const result: JsonLdData = { title: null, price: null, currency: null, year: null, make: null, model: null, mileageKm: null, images: [], vin: null };
```

Inside JSON-LD parsing:

```ts
const identifier = classifyVehicleIdentifier(data.vehicleIdentificationNumber, "Vehicle Identification Number");
if (identifier) result.vin = identifier.normalized;
```

Replace body regex with:

```ts
const labeledIdentifier =
  classifyVehicleIdentifier(specs.get("VIN"), "VIN")
  ?? classifyVehicleIdentifier(specs.get("Vehicle identification number"), "Vehicle Identification Number")
  ?? classifyVehicleIdentifier(specs.get("Chassis number"), "Chassis number")
  ?? classifyVehicleIdentifier(specs.get("Chassis"), "Chassis")
  ?? extractVehicleIdentifierFromText($("body").text());
const vin = labeledIdentifier?.normalized ?? jsonLd.vin;
```

- [ ] **Step 4: Replace writer truncation behavior**

In `src/features/scrapers/autoscout24_collector/supabase_writer.test.ts`, replace the long-VIN truncation expectation with:

```ts
it("does not silently truncate overlong identifiers into vin", () => {
  const row = mapNormalizedListingToListingsRow({ ...baseListing, vin: "WVWZZZ3CZWE123456789" }, meta);
  expect(row.vin).toBeNull();
});
```

In `src/features/scrapers/autoscout24_collector/supabase_writer.ts`, use:

```ts
const vinIdentifier = classifyVehicleIdentifier(listing.vin, "VIN");
vin: vinIdentifier?.kind === "vin_17" ? vinIdentifier.normalized : null,
```

- [ ] **Step 5: Verify AS24 slice**

Run:

```powershell
npx vitest run src/features/scrapers/autoscout24_collector
npx tsx agents/testscripts/as24-vin-proof-audit.ts --limit=25
```

Expected:

- Parser tests pass.
- Writer no longer truncates overlong identifiers into `vin`.
- Audit proves at least one AS24 source field exists before code is considered valuable.

## Task 4: AutoTrader Structured Payload and Scrapling Recovery

**Why:** AutoTrader has 817 active Porsche rows and 3 VIN rows. Current TypeScript parser checks structured payloads, but the Python Scrapling fallback still needs equivalent label-only extraction.

**Files:**

- Modify: `src/features/scrapers/autotrader_collector/detail.ts`
- Modify: `src/features/scrapers/autotrader_collector/detail.test.ts`
- Modify: `scripts/autotrader_scrapling_fetch.py`
- Create: `agents/testscripts/autotrader-vin-proof-audit.ts`

- [ ] **Step 1: Add nested payload tests**

Extend `src/features/scrapers/autotrader_collector/detail.test.ts`:

```ts
it("extracts nested product payload VIN fields", async () => {
  vi.spyOn(global, "fetch")
    .mockResolvedValueOnce(new Response(JSON.stringify({
      vehicle: { identifiers: { chassisNumber: "9113601234" } },
      heading: { title: "1973 Porsche 911" },
      gallery: { images: [] },
    }), { status: 200, headers: { "content-type": "application/json" } }))
    .mockResolvedValueOnce(new Response("<html><body></body></html>", { status: 200 }));

  const detail = await fetchAutoTraderDetail("https://www.autotrader.co.uk/car-details/202603261021846");
  expect(detail.vin).toBe("9113601234");
});
```

- [ ] **Step 2: Run tests to verify failure or coverage**

Run:

```powershell
npx vitest run src/features/scrapers/autotrader_collector/detail.test.ts
```

Expected:

- If this already passes, the TypeScript payload walker is sufficient.
- If it fails, extend the key walker to inspect nested objects up to depth 8.

- [ ] **Step 3: Patch Python Scrapling fallback to avoid broad regex**

In `scripts/autotrader_scrapling_fetch.py`, replace:

```py
vin_match = re.search(r"\b[A-HJ-NPR-Z0-9]{17}\b", body_text)
```

with:

```py
def normalize_identifier(raw):
    value = re.sub(r"[^A-Za-z0-9]", "", raw or "").upper()
    return value if 5 <= len(value) <= 20 else None

def find_labeled_identifier(text):
    pattern = re.compile(r"\b(VIN|Vehicle Identification Number|Chassis(?: Number)?|Frame(?: Number)?|Serial(?: Number)?)\b\s*(?:[:#-]|no\.?|number)?\s*([A-Za-z0-9][A-Za-z0-9\s._-]{3,24}[A-Za-z0-9])", re.I)
    for match in pattern.finditer(text or ""):
        normalized = normalize_identifier(match.group(2))
        if normalized:
            if len(normalized) == 17 and not re.match(r"^[A-HJ-NPR-Z0-9]{17}$", normalized):
                continue
            return normalized
    return None

vehicle["vin"] = find_labeled_identifier(body_text)
```

- [ ] **Step 4: Add proof audit**

Create `agents/testscripts/autotrader-vin-proof-audit.ts` modeled after Task 2, but fetch:

- product-page endpoint `https://www.autotrader.co.uk/product-page/v1/advert/<advertId>?channel=cars&postcode=SW1A%201AA`
- HTML detail URL

Record for each sampled missing-VIN row:

```ts
{
  source_url,
  productPayloadIdentifierKeys: string[],
  htmlLabeledIdentifier,
  htmlUnlabeledVinLikeTokenCount
}
```

- [ ] **Step 5: Verify AutoTrader recovery**

Run:

```powershell
npx vitest run src/features/scrapers/autotrader_collector
npx tsx agents/testscripts/autotrader-vin-proof-audit.ts --limit=25
```

Expected:

- No unlabeled body token populates `vin`.
- Any source-exposed product payload identifier is classified and recorded.

## Task 5: BeForward Legacy VIN Cleanup and True VIN Recovery

**Why:** BeForward currently has 71 identifier rows, but only 36 are true VIN-17 and 27 are invalid/noisy legacy values. New writes preserve chassis metadata, but old rows need cleanup.

**Files:**

- Create: `scripts/beforward-identifier-cleanup.ts`
- Modify: `src/features/scrapers/beforward_porsche_collector/supabase_writer.ts`
- Modify: `src/app/api/cron/enrich-beforward/route.ts`
- Test: `src/features/scrapers/beforward_porsche_collector/supabase_writer.test.ts`
- Test: `src/app/api/cron/enrich-beforward/route.test.ts`

- [ ] **Step 1: Add cleanup script dry-run behavior**

Create `scripts/beforward-identifier-cleanup.ts`:

```ts
import { createClient } from "@supabase/supabase-js";
import { classifyVehicleIdentifier } from "../src/features/scrapers/common/vehicleIdentifier";

type Row = { id: string; vin: string | null; enrichment_meta: unknown };

function migrateRow(row: Row) {
  const vin = row.vin?.trim() ?? null;
  if (!vin) return null;
  const vinIdentifier = classifyVehicleIdentifier(vin, "VIN");
  if (vinIdentifier?.kind === "vin_17") return null;
  const chassisIdentifier = classifyVehicleIdentifier(vin, "Chassis No.");
  if (!chassisIdentifier) return { id: row.id, patch: { vin: null }, reason: "invalid_vin_value" };
  return {
    id: row.id,
    patch: {
      vin: null,
      enrichment_meta: {
        ...((row.enrichment_meta && typeof row.enrichment_meta === "object" && !Array.isArray(row.enrichment_meta)) ? row.enrichment_meta as Record<string, unknown> : {}),
        beforward: { vehicleIdentifier: chassisIdentifier },
      },
    },
    reason: "moved_chassis_to_metadata",
  };
}
```

- [ ] **Step 2: Add command flags**

Support:

```powershell
npx tsx scripts/beforward-identifier-cleanup.ts --dryRun
npx tsx scripts/beforward-identifier-cleanup.ts --apply --limit=100
```

The script must refuse to update unless `--apply` is present.

- [ ] **Step 3: Add pure function tests**

Create `scripts/beforward-identifier-cleanup.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { migrateBeForwardIdentifierRow } from "./beforward-identifier-cleanup";

it("moves short chassis from vin to enrichment metadata", () => {
  expect(migrateBeForwardIdentifierRow({ id: "1", vin: "9113601234", enrichment_meta: null })).toMatchObject({
    patch: { vin: null, enrichment_meta: { beforward: { vehicleIdentifier: { normalized: "9113601234" } } } },
  });
});

it("keeps true VIN rows unchanged", () => {
  expect(migrateBeForwardIdentifierRow({ id: "1", vin: "WP0AA299XYS123456", enrichment_meta: null })).toBeNull();
});
```

- [ ] **Step 4: Verify and run dry audit**

Run:

```powershell
npx vitest run scripts/beforward-identifier-cleanup.test.ts src/features/scrapers/beforward_porsche_collector src/app/api/cron/enrich-beforward
npx tsx scripts/beforward-identifier-cleanup.ts --dryRun
```

Expected:

- Script reports counts for `moved_chassis_to_metadata` and `invalid_vin_value`.
- No DB writes in dry-run mode.

- [ ] **Step 5: Apply only after dry-run review**

Run:

```powershell
npx tsx scripts/beforward-identifier-cleanup.ts --apply --limit=100
npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active
```

Expected:

- BeForward invalid/noisy `vin` rows decrease.
- Metadata identifier rows increase.
- True VIN-17 count does not decrease except for rows proven invalid by classifier.

## Task 6: Elferspot Missing-Identifier Enrichment Targeting

**Why:** Elferspot already has 1,060 active VIN-17 rows, but 2,791 active rows still lack identifiers. The parser is improved; the enrichment job must target missing-identifier rows directly.

**Files:**

- Modify: `src/app/api/cron/enrich-elferspot/route.ts`
- Create or extend: `src/app/api/cron/enrich-elferspot/route.test.ts`
- Create: `agents/testscripts/elferspot-vin-gap-audit.ts`

- [ ] **Step 1: Add failing query targeting test**

Create `src/app/api/cron/enrich-elferspot/route.test.ts` if absent. Mock Supabase query chaining and assert the select includes rows where `vin` is null:

```ts
it("targets active Elferspot rows missing vin", async () => {
  await GET(makeRequest());
  expect(mockFrom).toHaveBeenCalledWith("listings");
  expect(mockIs).toHaveBeenCalledWith("vin", null);
  expect(mockEq).toHaveBeenCalledWith("source", "Elferspot");
  expect(mockEq).toHaveBeenCalledWith("status", "active");
});
```

- [ ] **Step 2: Run test to verify failure**

Run:

```powershell
npx vitest run src/app/api/cron/enrich-elferspot/route.test.ts
```

Expected: FAIL if current query targets only unrelated missing detail fields.

- [ ] **Step 3: Update query to prioritize missing identifiers**

In `src/app/api/cron/enrich-elferspot/route.ts`, use:

```ts
.select("id,source_url,vin,images")
.eq("source", "Elferspot")
.eq("status", "active")
.is("vin", null)
.order("updated_at", { ascending: true })
.limit(50)
```

Keep existing enrichment fields in updates.

- [ ] **Step 4: Add gap audit**

Create `agents/testscripts/elferspot-vin-gap-audit.ts` that samples active rows where `vin is null`, fetches detail pages, and records:

```ts
{
  source_url,
  pageFetched: boolean,
  labeledIdentifierFound: boolean,
  genericVinFound: boolean,
  parserVin: string | null
}
```

- [ ] **Step 5: Verify Elferspot**

Run:

```powershell
npx vitest run src/features/scrapers/elferspot_collector src/app/api/cron/enrich-elferspot
npx tsx agents/testscripts/elferspot-vin-gap-audit.ts --limit=25
```

Expected:

- Enrichment query tests pass.
- Gap audit estimates how many missing rows are recoverable with the current parser.

## Task 7: Classic.com and Auction Scraper Protection

**Why:** ClassicCom and BaT are already strong. The plan should protect this coverage while work focuses on low-coverage sources.

**Files:**

- Modify: `src/features/scrapers/classic_collector/detail.test.ts`
- Modify: `tests/scrapers/bringATrailer.fixture.test.ts`
- Modify: `tests/scrapers/carsAndBids.fixture.test.ts`
- Modify: `tests/scrapers/collectingCars.fixture.test.ts`

- [ ] **Step 1: Add Classic.com chassis classification guard**

Add to `src/features/scrapers/classic_collector/detail.test.ts`:

```ts
it("keeps URL VIN extraction stable for valid VIN URLs", () => {
  const parsed = parseClassicDetailHtml(`<html><body></body></html>`, "https://www.classic.com/veh/2005-porsche-911-wp0ca298x5l001385-abc/");
  expect(parsed.raw.vin).toBe("WP0CA298X5L001385");
});
```

- [ ] **Step 2: Add auction fixture identifier guards**

For each auction fixture test file, add one assertion for short chassis and one for modern VIN:

```ts
expect(enriched.vin).toBe("WP0AA299XYS123456");
```

and:

```ts
expect(enriched.vin).toBe("9113601234");
```

- [ ] **Step 3: Verify protection suite**

Run:

```powershell
npx vitest run src/features/scrapers/classic_collector/detail.test.ts src/features/scrapers/auctions tests/scrapers/bringATrailer.fixture.test.ts tests/scrapers/carsAndBids.fixture.test.ts tests/scrapers/collectingCars.fixture.test.ts
```

Expected:

- Existing strong sources stay green.
- No broad body regex is introduced into auction scrapers.

## Task 8: Cross-Source Reporting and Decision Gate

**Files:**

- Modify: `docs/scrapers/SCRAPERS.md`
- Modify: `docs/superpowers/plans/2026-06-04-marketplace-vin-coverage-recovery.md` only to record final observations after execution
- Artifact: `agents/testscripts/artifacts/vin-retrieval-audit-<timestamp>.json`

- [ ] **Step 1: Run before/after audit comparison**

Run before applying source-specific writes:

```powershell
npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active
```

Run again after each source phase:

```powershell
npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active
```

Record the latest artifact path in the execution notes.

- [ ] **Step 2: Update marketplace matrix**

In `docs/scrapers/SCRAPERS.md`, update the Vehicle Identifier Retrieval matrix with:

```md
| AutoScout24 | Source-limited / Recoverable | Evidence from `as24-vin-proof-audit-...json` |
| AutoTrader UK | Source-limited / Recoverable | Evidence from `autotrader-vin-proof-audit-...json` |
| Elferspot | Recoverable via enrichment rerun | Evidence from `elferspot-vin-gap-audit-...json` |
| BeForward | Chassis-heavy with metadata preservation | Evidence from cleanup output |
```

- [ ] **Step 3: V3 report gate**

Keep this rule unchanged unless audit coverage materially improves:

```md
VIN/chassis intelligence may be shown opportunistically per listing. It should not become a prominent report section until active VIN/chassis coverage materially improves or the report UI clearly handles missing values.
```

- [ ] **Step 4: Final verification**

Run:

```powershell
npx vitest run src/features/scrapers/common/vehicleIdentifier.test.ts
npx vitest run src/features/scrapers/autoscout24_collector src/features/scrapers/autotrader_collector src/features/scrapers/elferspot_collector src/features/scrapers/beforward_porsche_collector src/features/scrapers/auctions
npx tsx scripts/vin-retrieval-audit.ts --make=Porsche --status=active
```

Then run the repo-wide check:

```powershell
npm test
```

Expected:

- Focused scraper suites pass.
- Audit artifact is generated.
- If repo-wide `npm test` fails in unrelated areas, record exact failing files and do not claim full-suite success.

## Marketplace Execution Priority

1. **Elferspot:** Highest chance of real VIN gains because parser and detail pages already expose data for many rows.
2. **BeForward:** Highest data-quality risk; clean noisy legacy `vin` rows and preserve chassis metadata.
3. **AutoTrader:** Medium volume; one structured payload proof pass, then stop if source-limited.
4. **AutoScout24:** Huge volume but likely source-limited; proof audit first, parser work only if evidence exists.
5. **ClassicCom, BaT, Cars & Bids, Collecting Cars:** Protect strong coverage and avoid regressions.

## Plan Self-Review

Spec coverage:

- Covers all low-coverage marketplaces from the latest audit: AutoScout24, AutoTrader, Elferspot, BeForward.
- Covers strong marketplaces as protection tasks: ClassicCom, BaT, Cars & Bids, Collecting Cars.
- Separates true VIN gains from chassis/serial preservation.
- Includes source-limited decision gates before spending broad AS24/AutoTrader effort.
- Includes audit artifact requirements before and after changes.

Placeholder scan:

- No `TBD`, `TODO`, or open-ended implementation placeholders remain.
- Every implementation task names files, commands, and expected observations.

Type consistency:

- Shared classifier API matches current `classifyVehicleIdentifier` and `extractVehicleIdentifierFromText`.
- Audit artifact paths match existing `agents/testscripts/artifacts` convention.
- Supabase table and column names match current `listings`, `vin`, `source`, `source_url`, `status`, `make`, and `enrichment_meta` usage.
