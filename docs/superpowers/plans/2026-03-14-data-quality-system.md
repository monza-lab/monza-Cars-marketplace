# Data Quality System Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent bad model data ("PORSCHE", "Others", colors, non-cars) from being saved to the listings table, and fix/delete existing bad entries.

**Architecture:** Shared `listingValidator.ts` module provides `validateListing()` called by all 6 scraper writers before upsert (Layer 2), plus a `/api/cron/validate` endpoint (Layer 3) that scans recent listings and fixes/deletes bad ones. Existing cleanup cron gets extended with boat/bike rules (Layer 0).

**Tech Stack:** TypeScript, Supabase, Vitest, Next.js API routes, Vercel Cron

**Spec:** `docs/superpowers/specs/2026-03-14-data-quality-system-design.md`

---

## Chunk 1: Shared Validator + Tests

### Task 1: Create `listingValidator.ts` with tests

**Files:**
- Create: `src/lib/listingValidator.ts`
- Create: `tests/lib/listingValidator.test.ts`

- [ ] **Step 1: Write the test file**

```typescript
// tests/lib/listingValidator.test.ts
import { describe, it, expect } from "vitest";
import { validateListing, isNonCar, tryExtractModel } from "@/lib/listingValidator";

describe("isNonCar", () => {
  it("rejects tractors in model", () => {
    expect(isNonCar("tractor", "")).toBe("non-car:tractor");
  });
  it("rejects boats in model", () => {
    expect(isNonCar("craft 168", "")).toBe("non-car:craft");
  });
  it("rejects bikes in model", () => {
    expect(isNonCar("bike", "")).toBe("non-car:bike");
  });
  it("rejects diesel tractors but NOT Cayenne Diesel", () => {
    expect(isNonCar("diesel", "")).toBe("non-car:diesel");
    expect(isNonCar("cayenne diesel", "")).toBeNull();
  });
  it("accepts normal Porsche models", () => {
    expect(isNonCar("911 carrera 4s", "2020 Porsche 911 Carrera 4S")).toBeNull();
    expect(isNonCar("cayenne turbo gt", "")).toBeNull();
  });
});

describe("tryExtractModel", () => {
  it("extracts model from title with year and make", () => {
    const result = tryExtractModel("2019 Porsche 911 Carrera S", 2019, "Porsche");
    expect(result).toBeTruthy();
    expect(result!.toLowerCase()).toContain("911");
  });
  it("extracts Cayenne from title", () => {
    const result = tryExtractModel("2022 Porsche Cayenne Turbo GT", 2022, "Porsche");
    expect(result).toBeTruthy();
  });
  it("returns null for title with no extractable model", () => {
    const result = tryExtractModel("PORSCHE OTHERS", undefined, "Porsche");
    expect(result).toBeNull();
  });
  it("returns null for non-car titles", () => {
    const result = tryExtractModel("Craig Craft 168 Boss Porsche Boat", undefined, "Porsche");
    expect(result).toBeNull();
  });
});

describe("validateListing", () => {
  it("rejects non-Porsche makes", () => {
    const result = validateListing({ make: "Ferrari", model: "488", title: "Ferrari 488", year: 2020 });
    expect(result.valid).toBe(false);
    expect(result.reason).toContain("non-porsche");
  });
  it("rejects non-car items", () => {
    const result = validateListing({ make: "Porsche", model: "Tractor", title: "Porsche Tractor", year: 1960 });
    expect(result.valid).toBe(false);
  });
  it("fixes bad model 'PORSCHE' when title has valid model", () => {
    const result = validateListing({
      make: "Porsche", model: "PORSCHE", title: "2019 Porsche 911 Carrera S", year: 2019,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeTruthy();
  });
  it("rejects bad model 'PORSCHE' when title has no model", () => {
    const result = validateListing({
      make: "Porsche", model: "PORSCHE", title: "PORSCHE OTHERS", year: undefined,
    });
    expect(result.valid).toBe(false);
  });
  it("fixes model 'Others' when title has valid model", () => {
    const result = validateListing({
      make: "Porsche", model: "Others", title: "Porsche Cayenne 2021", year: 2021,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeTruthy();
  });
  it("detects color-as-model and tries to fix from title", () => {
    const result = validateListing({
      make: "Porsche", model: "Racing Green Metallic", title: "2023 Porsche 911 GT3 RS", year: 2023,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeTruthy();
  });
  it("accepts valid Porsche listings", () => {
    const result = validateListing({
      make: "Porsche", model: "911 Carrera 4S", title: "2020 Porsche 911 Carrera 4S", year: 2020,
    });
    expect(result.valid).toBe(true);
    expect(result.fixedModel).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/listingValidator.test.ts`
Expected: FAIL — module `@/lib/listingValidator` does not exist

- [ ] **Step 3: Write the implementation**

```typescript
// src/lib/listingValidator.ts
import { extractSeries, getSeriesConfig } from "./brandConfig";

// ─── Constants ───

const NON_CAR_KEYWORDS = [
  "tractor", "literature", "press kit", "tool kit",
  "apal", "genie", "kenworth", "boat", "craft", "bike",
  "minibike", "scooter", "autonacional", "projects unlimited",
] as const;

const INVALID_MODELS = ["porsche", "others", "other"] as const;

const PORSCHE_COLORS = [
  "racing green", "guards red", "speed yellow", "miami blue",
  "gentian blue", "lava orange", "frozen blue", "crayon",
  "irish green", "signal green", "riviera blue", "mexico blue",
  "rubystone red", "maritime blue", "gulf blue", "python green",
  "chalk white", "nardo grey", "oak green", "stone grey",
  "arena red", "jet black", "night blue", "shark blue",
] as const;

// ─── Types ───

export interface ValidationResult {
  valid: boolean;
  fixedModel?: string;
  reason?: string;
}

interface ListingInput {
  make: string;
  model: string;
  title: string;
  year?: number;
}

// ─── Public API ───

/**
 * Check if model field indicates a non-car item.
 * Only checks the model field — title is NOT checked here to avoid false positives
 * (e.g. "handcrafted" matching "craft"). Title-based rejection is handled in
 * validateListing() only when the model is already suspicious.
 * Returns rejection reason string, or null if it's a valid car.
 */
export function isNonCar(model: string, title: string): string | null {
  const lModel = model.toLowerCase().trim();

  // Special diesel rule: reject UNLESS it's a Cayenne Diesel
  if (lModel.includes("diesel") && !lModel.includes("cayenne")) {
    return "non-car:diesel";
  }

  for (const kw of NON_CAR_KEYWORDS) {
    if (lModel.includes(kw)) return `non-car:${kw}`;
  }

  return null;
}

/**
 * Try to extract a valid model from the title string.
 * Returns the model substring (e.g. "911 Carrera S") or null.
 */
export function tryExtractModel(
  title: string,
  year: number | undefined,
  make: string,
): string | null {
  if (!title || title.trim().length < 3) return null;

  // Strip year pattern (4-digit number) and make from title
  let candidate = title
    .replace(/\b(19|20)\d{2}\b/g, "")   // remove years
    .replace(new RegExp(make, "gi"), "") // remove make
    .replace(/\s+/g, " ")
    .trim();

  if (!candidate || candidate.length < 2) return null;

  // Check if this candidate maps to a known series
  const seriesId = extractSeries(candidate, year ?? 0, make);
  const config = getSeriesConfig(seriesId, make);

  if (config) {
    return candidate;
  }

  // Also try the raw title (extractSeries strips make internally)
  const rawSeriesId = extractSeries(title, year ?? 0, make);
  const rawConfig = getSeriesConfig(rawSeriesId, make);

  if (rawConfig && candidate.length >= 2) {
    return candidate;
  }

  return null;
}

/**
 * Check if a model value is actually a Porsche color name.
 */
function isColorAsModel(model: string): boolean {
  const lModel = model.toLowerCase().trim();
  if (lModel.length < 3) return false;

  for (const color of PORSCHE_COLORS) {
    if (lModel.startsWith(color)) return true;
  }
  // Also catch "X Metallic" patterns (e.g. "Racing Green Metallic")
  if (lModel.endsWith("metallic")) return true;
  return false;
}

/**
 * Check if a model value is in the invalid/empty list.
 */
function isInvalidModel(model: string): boolean {
  const lModel = model.toLowerCase().trim();
  if (lModel === "") return true;
  return INVALID_MODELS.some((inv) => lModel === inv);
}

/**
 * Main validation function. Call before writing a listing to the DB.
 */
export function validateListing(listing: ListingInput): ValidationResult {
  const make = (listing.make ?? "").trim();
  const model = (listing.model ?? "").trim();
  const title = (listing.title ?? "").trim();

  // Rule 1: Non-Porsche make → reject
  if (make.toLowerCase() !== "porsche") {
    return { valid: false, reason: `non-porsche-make:${make}` };
  }

  // Rule 2: Non-car item (model field check) → reject
  const nonCarReason = isNonCar(model, title);
  if (nonCarReason) {
    return { valid: false, reason: nonCarReason };
  }

  // Rule 3: Invalid/empty model or color-as-model → try to fix from title
  const modelIsSuspicious = isInvalidModel(model) || isColorAsModel(model);

  // Rule 3a: Title-based non-car check — only when model is already suspicious
  // (avoids false positives like "handcrafted" matching "craft" on valid listings)
  if (modelIsSuspicious) {
    const titleNonCar = ["boat", "craft", "bike", "minibike", "scooter", "tractor"];
    const lTitle = title.toLowerCase();
    for (const kw of titleNonCar) {
      if (lTitle.match(new RegExp(`\\b${kw}\\b`))) {
        return { valid: false, reason: `non-car-title:${kw}` };
      }
    }
  }

  if (modelIsSuspicious) {
    const extracted = tryExtractModel(title, listing.year, "Porsche");
    if (extracted) {
      return { valid: true, fixedModel: extracted };
    }
    return { valid: false, reason: `unresolvable-model:${model}` };
  }

  // Rule 4: Model looks OK
  return { valid: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/listingValidator.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/listingValidator.ts tests/lib/listingValidator.test.ts
git commit -m "feat: add listingValidator shared module with tests"
```

---

## Chunk 2: Write-time Validation Gates

### Task 2: Add validation gate to `porsche_collector/supabase_writer.ts`

**Files:**
- Modify: `src/features/porsche_collector/supabase_writer.ts:38-43`

- [ ] **Step 1: Add import at top of file**

Add after existing imports:
```typescript
import { validateListing } from "@/lib/listingValidator";
```

- [ ] **Step 2: Add validation in `upsertAll` before `upsertListing`**

Replace the `upsertAll` method body (lines 38-43):
```typescript
upsertAll: async (listing, meta, dryRun) => {
  if (dryRun) return { listingId: "dry_run", wrote: false };

  const validation = validateListing({
    make: listing.make,
    model: listing.model,
    title: listing.title,
    year: listing.year,
  });

  if (!validation.valid) {
    console.log(`[porsche_collector] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
    return { listingId: "skipped_invalid", wrote: false };
  }

  if (validation.fixedModel) {
    listing.model = validation.fixedModel;
  }

  const listingId = await upsertListing(client, listing, meta);
  await insertPriceHistorySnapshot(client, listingId, listing, meta);
  return { listingId, wrote: true };
},
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

---

### Task 3: Add validation gate to `beforward_porsche_collector/supabase_writer.ts`

**Files:**
- Modify: `src/features/beforward_porsche_collector/supabase_writer.ts:32-37`

- [ ] **Step 1: Add import at top of file**

Add after existing imports:
```typescript
import { validateListing } from "@/lib/listingValidator";
```

- [ ] **Step 2: Replace `upsertAll` method body (lines 32-37)**

```typescript
upsertAll: async (listing, meta, dryRun) => {
  if (dryRun) return { listingId: "dry_run", wrote: false };

  const validation = validateListing({
    make: listing.make,
    model: listing.model,
    title: listing.title,
    year: listing.year,
  });

  if (!validation.valid) {
    console.log(`[beforward] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
    return { listingId: "skipped_invalid", wrote: false };
  }

  if (validation.fixedModel) {
    listing.model = validation.fixedModel;
  }

  const listingId = await upsertListing(client, listing, meta);
  await insertPriceHistorySnapshot(client, listingId, listing, meta);
  return { listingId, wrote: true };
},
```

---

### Task 4: Add validation gate to `classic_collector/supabase_writer.ts`

**Files:**
- Modify: `src/features/classic_collector/supabase_writer.ts:28-33`

- [ ] **Step 1: Add import at top**

```typescript
import { validateListing } from "@/lib/listingValidator";
```

- [ ] **Step 2: Replace `upsertAll` method body (lines 28-33)**

Same pattern as Task 2 Step 2, but log prefix `[classic]`.

---

### Task 5: Add validation gate to `autoscout24_collector/supabase_writer.ts`

**Files:**
- Modify: `src/features/autoscout24_collector/supabase_writer.ts:28-33`

- [ ] **Step 1: Add import at top**

```typescript
import { validateListing } from "@/lib/listingValidator";
```

- [ ] **Step 2: Replace `upsertAll` method body (lines 28-33)**

Same pattern as Task 2 Step 2, but log prefix `[autoscout24]`.

---

### Task 6: Add validation gate to `autotrader_collector/supabase_writer.ts`

**Files:**
- Modify: `src/features/autotrader_collector/supabase_writer.ts:43-48`

- [ ] **Step 1: Add import at top**

```typescript
import { validateListing } from "@/lib/listingValidator";
```

- [ ] **Step 2: Replace `upsertAll` method body (lines 43-48)**

Same pattern as Task 2 Step 2, but log prefix `[autotrader]`.

---

### Task 7: Add validation gate to `porsche_ingest/repository/supabase_writer.ts`

**Files:**
- Modify: `src/features/porsche_ingest/repository/supabase_writer.ts:236-251`

This writer uses a different interface (`upsertCanonicalListing` instead of `upsertAll`).

- [ ] **Step 1: Add import at top**

```typescript
import { validateListing } from "@/lib/listingValidator";
```

- [ ] **Step 2: Replace `upsertCanonicalListing` with this version (adds validation gate after dryRun check)**

```typescript
export async function upsertCanonicalListing(listing: CanonicalListing, dryRun: boolean, options: WriteOptions = {}): Promise<WriteResult> {
  if (dryRun) return { inserted: 0, updated: 0, warnings: [] };

  const validation = validateListing({
    make: listing.make,
    model: listing.model,
    title: listing.title,
    year: listing.year,
  });

  if (!validation.valid) {
    console.log(`[porsche_ingest] Skipped invalid listing: ${validation.reason} — ${listing.title}`);
    return { inserted: 0, updated: 0, warnings: [`skipped: ${validation.reason}`] };
  }

  if (validation.fixedModel) {
    listing.model = validation.fixedModel;
  }

  const client = createSupabase();
  const warnings: string[] = [];

  const upserted = await listingIdAfterUpsert(client, listing, options);
  if (!options.listingsOnly) {
    await upsertChildTables(client, upserted.id, listing, warnings);
  }

  return {
    inserted: upserted.inserted ? 1 : 0,
    updated: upserted.inserted ? 0 : 1,
    warnings,
  };
}
```

- [ ] **Step 3: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty 2>&1 | head -20`

- [ ] **Step 4: Commit all writer changes**

```bash
git add src/features/porsche_collector/supabase_writer.ts \
  src/features/beforward_porsche_collector/supabase_writer.ts \
  src/features/classic_collector/supabase_writer.ts \
  src/features/autoscout24_collector/supabase_writer.ts \
  src/features/autotrader_collector/supabase_writer.ts \
  src/features/porsche_ingest/repository/supabase_writer.ts
git commit -m "feat: add validation gate to all 6 scraper writers"
```

---

## Chunk 3: Post-Scrape Validation Cron + Enhanced Cleanup

### Task 8: Create `/api/cron/validate` route

**Files:**
- Create: `src/app/api/cron/validate/route.ts`

- [ ] **Step 1: Write the cron route**

```typescript
// src/app/api/cron/validate/route.ts
import { NextResponse } from "next/server";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateListing } from "@/lib/listingValidator";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ListingRow = {
  id: string;
  make: string | null;
  model: string | null;
  year: number | null;
  title: string | null;
};

function getSupabaseClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) throw new Error("Missing SUPABASE_URL or SERVICE_ROLE_KEY");
  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchRecentListings(client: SupabaseClient<any>) {
  const rows: ListingRow[] = [];
  const pageSize = 1000;
  let from = 0;

  // Fetch listings updated in last 25 hours
  const cutoff = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();

  while (true) {
    const { data, error } = await client
      .from("listings")
      .select("id, make, model, year, title")
      .gte("updated_at", cutoff)
      .range(from, from + pageSize - 1);

    if (error) throw new Error(`Fetch error: ${error.message}`);
    rows.push(...(data as ListingRow[]));
    if (data.length < pageSize) break;
    from += pageSize;
  }

  return rows;
}

export async function GET(request: Request) {
  const startTime = Date.now();

  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    const supabase = getSupabaseClient();
    const recentListings = await fetchRecentListings(supabase);

    let fixed = 0;
    let deleted = 0;
    const deleteIds: string[] = [];
    const fixedItems: { id: string; oldModel: string; newModel: string }[] = [];
    const deletedReasons: Record<string, number> = {};

    for (const row of recentListings) {
      const result = validateListing({
        make: row.make ?? "",
        model: row.model ?? "",
        title: row.title ?? "",
        year: row.year ?? undefined,
      });

      if (result.valid && result.fixedModel) {
        // Fix the model
        await supabase
          .from("listings")
          .update({ model: result.fixedModel, updated_at: new Date().toISOString() })
          .eq("id", row.id);
        fixedItems.push({ id: row.id, oldModel: row.model ?? "", newModel: result.fixedModel });
        fixed++;
      } else if (!result.valid) {
        deleteIds.push(row.id);
        const reason = result.reason ?? "unknown";
        deletedReasons[reason] = (deletedReasons[reason] ?? 0) + 1;
      }
    }

    // Delete price_history first (foreign key)
    for (let i = 0; i < deleteIds.length; i += 50) {
      const batch = deleteIds.slice(i, i + 50);
      await supabase.from("price_history").delete().in("listing_id", batch);
    }

    // Delete invalid listings
    for (let i = 0; i < deleteIds.length; i += 50) {
      const batch = deleteIds.slice(i, i + 50);
      const { data } = await supabase
        .from("listings")
        .delete()
        .in("id", batch)
        .select("id");
      deleted += (data ?? []).length;
    }

    console.log(
      `[cron/validate] Scanned ${recentListings.length}, fixed ${fixed}, deleted ${deleted}:`,
      JSON.stringify(deletedReasons),
    );

    return NextResponse.json({
      success: true,
      scanned: recentListings.length,
      fixed,
      fixedItems: fixedItems.slice(0, 50),
      deleted,
      deletedReasons,
      duration: `${Date.now() - startTime}ms`,
    });
  } catch (error) {
    console.error("[cron/validate] Error:", error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Validation failed",
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/validate/route.ts
git commit -m "feat: add post-scrape validation cron at /api/cron/validate"
```

---

### Task 9: Enhance cleanup cron with boat/bike rules

**Files:**
- Modify: `src/app/api/cron/cleanup/route.ts:18-59`

- [ ] **Step 1: Add boat/bike/scooter rules to `detectJunk`**

After the existing Rule 7 (kenworth), add:

```typescript
  // Rule 8: Boats
  if (model.includes("craft") || model.includes("boat") || title.includes("boat")) {
    return "boat";
  }

  // Rule 9: Bikes, minibikes, scooters
  if (model.includes("bike") || model.includes("minibike") || model.includes("scooter")
      || title.includes("minibike") || title.includes("porsche bike")) {
    return "bike";
  }

  // Rule 10: Other non-car items
  if (model.includes("autonacional") || model.includes("projects unlimited")) {
    return "non-car-misc";
  }
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/cron/cleanup/route.ts
git commit -m "feat: add boat/bike/misc rules to cleanup cron"
```

---

### Task 10: Update `vercel.json` with validate cron schedule

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add validate cron entry before cleanup**

The validate cron runs at 5:30 UTC (after all scrapers, before cleanup at 6:00):

```json
{
  "crons": [
    { "path": "/api/cron/ferrari",      "schedule": "0 0 * * *" },
    { "path": "/api/cron/porsche",      "schedule": "0 1 * * *" },
    { "path": "/api/cron/autotrader",   "schedule": "0 2 * * *" },
    { "path": "/api/cron/beforward",    "schedule": "0 3 * * *" },
    { "path": "/api/cron/classic",      "schedule": "0 4 * * *" },
    { "path": "/api/cron/autoscout24",  "schedule": "0 5 * * *" },
    { "path": "/api/cron/validate",    "schedule": "30 5 * * *" },
    { "path": "/api/cron/cleanup",     "schedule": "0 6 * * *" }
  ]
}
```

- [ ] **Step 2: Commit**

```bash
git add vercel.json
git commit -m "feat: add validate cron at 5:30 UTC to vercel.json"
```

---

## Chunk 4: Immediate DB Cleanup + Final Verification

### Task 11: Delete existing non-car listings from DB

This is a one-time manual cleanup using a Node script.

**Files:**
- Create (temporary): `scripts/cleanup-non-cars.mjs`

- [ ] **Step 1: Write the cleanup script**

```javascript
// scripts/cleanup-non-cars.mjs
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error("Missing env vars"); process.exit(1); }

const supabase = createClient(url, key, { auth: { persistSession: false } });

// Known non-car patterns to delete
const patterns = [
  { field: "model", op: "ilike", value: "%craft%" },
  { field: "model", op: "ilike", value: "%boat%" },
  { field: "model", op: "ilike", value: "%bike%" },
  { field: "model", op: "ilike", value: "%minibike%" },
  { field: "model", op: "ilike", value: "%scooter%" },
  { field: "model", op: "ilike", value: "%autonacional%" },
  { field: "model", op: "ilike", value: "%projects unlimited%" },
  { field: "title", op: "ilike", value: "%craig craft%" },
  { field: "title", op: "ilike", value: "%porsche bike%" },
  { field: "title", op: "ilike", value: "%di blasi%" },
];

let totalDeleted = 0;

for (const p of patterns) {
  const { data: found } = await supabase
    .from("listings")
    .select("id, title, model")
    .ilike(p.field, p.value);

  if (found && found.length > 0) {
    console.log(`\nFound ${found.length} matches for ${p.field} ${p.op} "${p.value}":`);
    found.forEach(r => console.log(`  - [${r.model}] ${r.title}`));

    const ids = found.map(r => r.id);
    // Delete price_history first
    await supabase.from("price_history").delete().in("listing_id", ids);
    // Delete listings
    const { data: deleted } = await supabase
      .from("listings").delete().in("id", ids).select("id");
    const count = (deleted ?? []).length;
    console.log(`  Deleted: ${count}`);
    totalDeleted += count;
  }
}

console.log(`\nTotal deleted: ${totalDeleted}`);
```

- [ ] **Step 2: Run the script with dotenv**

Run: `node --env-file=.env.local scripts/cleanup-non-cars.mjs`
Expected: Deletes Craig Craft boats, Autonacional, Di Blasi, Projects Unlimited, Porsche Bike

- [ ] **Step 3: Delete the script (one-time use)**

```bash
rm scripts/cleanup-non-cars.mjs
```

---

### Task 12: Run full test suite and verify

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit --pretty`
Expected: No errors

- [ ] **Step 3: Final commit with all remaining changes**

```bash
git add -A
git commit -m "feat: data quality system — validator, cron, writer gates, cleanup"
```
