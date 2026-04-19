# AutoTrader Photo Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore AutoTrader gallery coverage by proving whether Scrapling can see the missing image set on live detail pages, then wiring a shared AutoTrader image extractor into discovery, enrichment, and legacy backfill so `images` and `photos_count` are written consistently.

**Architecture:** Keep TypeScript as the production source of truth and use Scrapling only as a diagnostic probe for live AutoTrader pages. The production fix stays localized to the AutoTrader scraper slice: one shared gallery extraction helper, one enrichment path that writes image fields, and one legacy backfill path that targets rows with fewer than two photos. That keeps the dependency footprint small while still using browser-backed scraping where the current HTML path is too narrow.

**Tech Stack:** TypeScript, Next.js route handlers, Supabase JS, Vitest, Cheerio, Python 3.10+, Scrapling.

---

## Scope Ledger

- Files to modify: 5 to 7
- Files to create: 2 to 3
- Target LOC/file: 40 to 180
- Dependencies: 1 new utility dependency only if the Scrapling probe is kept (`scrapling`)

---

### Task 1: Prove the AutoTrader gallery gap with a recorded fixture and a Scrapling probe

**Files:**
- Create: `tests/fixtures/autotrader-gallery-detail.html`
- Create: `scripts/autotrader-scrapling-probe.py`
- Modify: `src/features/scrapers/autotrader_collector/detail.test.ts`

**Why this task exists:** We need one deterministic HTML sample that reproduces the current failure and one browser-backed probe that tells us whether Scrapling can recover more gallery URLs than the current Cheerio parser.

- [ ] **Step 1: Write the failing test**

Add this test to `src/features/scrapers/autotrader_collector/detail.test.ts`:

```ts
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, it, expect } from "vitest";
import { parseAutoTraderHtml } from "./detail";

describe("parseAutoTraderHtml", () => {
  it("extracts the gallery images from the recorded AutoTrader fixture", () => {
    const html = readFileSync(
      resolve(process.cwd(), "tests/fixtures/autotrader-gallery-detail.html"),
      "utf8",
    );

    const result = parseAutoTraderHtml(html);

    expect(result.images.length).toBeGreaterThan(1);
    expect(result.images.every((url) => url.includes("atcdn.co.uk"))).toBe(true);
  });
});
```

Use a fixture shaped like this so the current parser misses the gallery set while the page still clearly contains the image URLs:

```html
<html>
  <body>
    <h1>2020 Porsche 911 Carrera S</h1>
    <img src="https://m.atcdn.co.uk/a/media/{resize}/hero.jpg" />
    <script type="application/json" id="gallery-data">
      {
        "gallery": [
          { "url": "https://m.atcdn.co.uk/a/media/{resize}/one.jpg" },
          { "url": "https://m.atcdn.co.uk/a/media/{resize}/two.jpg" },
          { "url": "https://m.atcdn.co.uk/a/media/{resize}/three.jpg" }
        ]
      }
    </script>
  </body>
</html>
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/features/scrapers/autotrader_collector/detail.test.ts`
Expected: FAIL because the current parser only inspects `img[src]` values that already contain `autotrader`, which misses the real `m.atcdn.co.uk` gallery URLs and any JSON-embedded gallery arrays.

- [ ] **Step 3: Add the Scrapling probe**

Create `scripts/autotrader-scrapling-probe.py` so it can fetch one live AutoTrader detail page and print the image URLs it sees:

```py
#!/usr/bin/env python3
import json
import sys

from scrapling.fetchers import StealthyFetcher


def main() -> int:
    if len(sys.argv) != 2:
        print("usage: autotrader-scrapling-probe.py <url>", file=sys.stderr)
        return 2

    url = sys.argv[1]
    StealthyFetcher.adaptive = True
    page = StealthyFetcher.fetch(url, headless=True, network_idle=True)

    urls = []
    for node in page.css("img"):
        src = node.attributes.get("src") or node.attributes.get("data-src")
        if src and "atcdn.co.uk" in src:
            urls.append(src)

    print(json.dumps({"url": url, "images": urls[:20]}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
```

Run it against one of the live AutoTrader URLs already in the database, then compare the output to the fixture-based TS parser result. The probe is diagnostic only; it must not become part of the production request path unless the HTML fix still leaves a gap.

- [ ] **Step 4: Run the probe**

Run:

```bash
./.venv/bin/pip install scrapling
./.venv/bin/python scripts/autotrader-scrapling-probe.py https://www.autotrader.co.uk/car-details/202602099784872
```

Expected: a JSON payload that shows whether Scrapling can see more gallery URLs than the current parser.

- [ ] **Step 5: Commit**

```bash
git add tests/fixtures/autotrader-gallery-detail.html scripts/autotrader-scrapling-probe.py src/features/scrapers/autotrader_collector/detail.test.ts
git commit -m "test(autotrader): capture gallery gap and add scrapling probe"
```

---

### Task 2: Centralize AutoTrader gallery extraction and write photos into the active enrichment path

**Files:**
- Create: `src/features/scrapers/autotrader_collector/imageUrls.ts`
- Modify: `src/features/scrapers/autotrader_collector/detail.ts`
- Modify: `src/features/scrapers/autotrader_collector/collector.ts`
- Modify: `src/app/api/cron/enrich-autotrader/route.ts`
- Modify: `src/features/scrapers/autotrader_collector/detail.test.ts`
- Modify: `src/features/scrapers/autotrader_collector/collector.test.ts`
- Modify: `src/app/api/cron/enrich-autotrader/route.test.ts`

**Why this task exists:** The current AutoTrader code paths duplicate image parsing and only persist spec fields during enrichment. A single shared extractor keeps discovery and enrichment aligned and gives us one place to normalize `m.atcdn.co.uk` URLs.

- [ ] **Step 1: Write the failing test**

Extend `src/features/scrapers/autotrader_collector/detail.test.ts` with this expectation:

```ts
it("normalizes AutoTrader gallery URLs instead of dropping resize-token URLs", () => {
  const html = readFileSync(
    resolve(process.cwd(), "tests/fixtures/autotrader-gallery-detail.html"),
    "utf8",
  );
  const result = parseAutoTraderHtml(html);

  expect(result.images).toEqual([
    "https://m.atcdn.co.uk/a/media/hero.jpg",
    "https://m.atcdn.co.uk/a/media/one.jpg",
    "https://m.atcdn.co.uk/a/media/two.jpg",
    "https://m.atcdn.co.uk/a/media/three.jpg",
  ]);
});
```

Add a collector test that proves the discovery path also uses the shared extractor:

```ts
import { extractAutoTraderImages } from "./imageUrls";

it("returns the same normalized gallery URLs for the collector's HTML input", () => {
  const html = readFileSync(
    resolve(process.cwd(), "tests/fixtures/autotrader-gallery-detail.html"),
    "utf8",
  );

  expect(extractAutoTraderImages(html)).toEqual([
    "https://m.atcdn.co.uk/a/media/hero.jpg",
    "https://m.atcdn.co.uk/a/media/one.jpg",
    "https://m.atcdn.co.uk/a/media/two.jpg",
    "https://m.atcdn.co.uk/a/media/three.jpg",
  ]);
});
```

Add a route test that proves enrichment writes the image fields:

```ts
it("persists images and photos_count when AutoTrader detail pages expose a gallery", async () => {
  const response = await GET(makeRequest());
  expect(response.status).toBe(200);
  expect(mockUpdate).toHaveBeenCalledWith(
    expect.objectContaining({
      images: expect.any(Array),
      photos_count: expect.any(Number),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run \
  src/features/scrapers/autotrader_collector/detail.test.ts \
  src/features/scrapers/autotrader_collector/collector.test.ts \
  src/app/api/cron/enrich-autotrader/route.test.ts
```

Expected: FAIL because the current code still filters images too aggressively and the enrichment route does not write `images` or `photos_count`.

- [ ] **Step 3: Write the minimal implementation**

Create `src/features/scrapers/autotrader_collector/imageUrls.ts` with one extractor that both the collector and detail enricher import:

```ts
import * as cheerio from "cheerio";

function normalizeAtCdnUrl(input: string): string | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const candidate = trimmed.startsWith("http")
    ? trimmed
    : trimmed.startsWith("//")
      ? `https:${trimmed}`
      : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (!url.hostname.endsWith("atcdn.co.uk")) return null;
    url.pathname = url.pathname.replace(/\/\{resize\}/g, "");
    return url.toString();
  } catch {
    return null;
  }
}

export function extractAutoTraderImages(html: string): string[] {
  const $ = cheerio.load(html);
  const urls = new Set<string>();

  $("img, source").each((_, el) => {
    const candidates = [
      $(el).attr("src"),
      $(el).attr("data-src"),
      $(el).attr("srcset"),
      $(el).attr("data-srcset"),
    ].filter((value): value is string => typeof value === "string" && value.length > 0);

    for (const candidate of candidates) {
      for (const part of candidate.split(",")) {
        const maybeUrl = normalizeAtCdnUrl(part.trim().split(" ")[0] ?? "");
        if (maybeUrl) urls.add(maybeUrl);
      }
    }
  });

  $("script").each((_, el) => {
    const text = $(el).text();
    for (const match of text.matchAll(/https:\/\/[^"'`\s]+atcdn\.co\.uk[^"'`\s]*/g)) {
      const maybeUrl = normalizeAtCdnUrl(match[0]);
      if (maybeUrl) urls.add(maybeUrl);
    }
  });

  return [...urls].slice(0, 20);
}
```

Then update `detail.ts` and `collector.ts` to call `extractAutoTraderImages(html)` instead of the current one-off `$("img").each(...)` loop, and update `src/app/api/cron/enrich-autotrader/route.ts` so it writes:

```ts
if (detail.images && detail.images.length > 0) {
  update.images = detail.images;
  update.photos_count = detail.images.length;
}
```

Also change the enrichment query so it targets active AutoTrader rows missing either specs or photos, not only rows with `engine IS NULL`. Use a query shape like:

```ts
const { data: rows } = await client
  .from("listings")
  .select("id,source_url")
  .eq("source", "AutoTrader")
  .eq("status", "active")
  .or("engine.is.null,images.is.null,images.eq.{},photos_count.lt.2")
  .order("updated_at", { ascending: true })
  .limit(100);
```

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run \
  src/features/scrapers/autotrader_collector/detail.test.ts \
  src/features/scrapers/autotrader_collector/collector.test.ts \
  src/app/api/cron/enrich-autotrader/route.test.ts
```

Expected: PASS, with the AutoTrader parser returning the full gallery set and the enrichment route persisting it.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/autotrader_collector/imageUrls.ts src/features/scrapers/autotrader_collector/detail.ts src/features/scrapers/autotrader_collector/collector.ts src/app/api/cron/enrich-autotrader/route.ts src/features/scrapers/autotrader_collector/detail.test.ts src/features/scrapers/autotrader_collector/collector.test.ts src/app/api/cron/enrich-autotrader/route.test.ts
git commit -m "fix(autotrader): persist full galleries through discovery and enrichment"
```

---

### Task 3: Add AutoTrader to the legacy photo backfill so old rows get repaired

**Files:**
- Modify: `src/features/scrapers/common/backfillImages.ts`
- Modify: `src/app/api/cron/backfill-images/route.ts`
- Modify: `src/features/scrapers/common/backfillImages.test.ts`

**Why this task exists:** Existing AutoTrader rows already in Supabase need a repair path. Discovery and enrichment only help future runs; the live database also needs a backfill that can revisit active AutoTrader rows with `photos_count < 2`.

- [ ] **Step 1: Write the failing test**

Add this test to `src/features/scrapers/common/backfillImages.test.ts`:

```ts
it("includes AutoTrader in the photo backfill queue and targets listings with fewer than two photos", async () => {
  orCalls.length = 0;
  mockLimit.mockResolvedValueOnce({
    data: [],
    error: null,
  });

  const { backfillImagesForSource } = await import("./backfillImages");

  await backfillImagesForSource({
    source: "AutoTrader",
    maxListings: 1,
    delayMs: 0,
    timeBudgetMs: 5000,
  });

  expect(orCalls).toContain("images.is.null,images.eq.{},photos_count.lt.2");
});
```

Add a route-level test that confirms the cron schedules AutoTrader with a real per-source cap:

```ts
it("passes AutoTrader through to the shared backfill helper", async () => {
  const response = await GET(makeRequest());
  expect(response.status).toBe(200);
  expect(backfillImagesForSource).toHaveBeenCalledWith(
    expect.objectContaining({
      source: "AutoTrader",
      maxListings: expect.any(Number),
    }),
  );
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
npx vitest run \
  src/features/scrapers/common/backfillImages.test.ts \
  src/app/api/cron/backfill-images/route.test.ts
```

Expected: FAIL because `BackfillOptions.source` does not currently include `AutoTrader`, the helper does not have an AutoTrader fetcher, and the cron route does not schedule it.

- [ ] **Step 3: Write the minimal implementation**

Update the shared backfill helper to support AutoTrader:

```ts
export interface BackfillOptions {
  source: "BaT" | "BeForward" | "AutoScout24" | "AutoTrader" | "all";
  maxListings?: number;
  delayMs?: number;
  timeBudgetMs?: number;
  dryRun?: boolean;
}
```

Add an AutoTrader fetcher that reuses `extractAutoTraderImages(html)`:

```ts
const fetchAutoTraderImages: ImageFetcher = async (url) => {
  const html = await fetchHtml(url);
  const { extractAutoTraderImages } = await import(
    "@/features/scrapers/autotrader_collector/imageUrls"
  );
  return extractAutoTraderImages(html);
};
```

Return it from `buildImageFetcherMap()` and keep the query broad enough to target sparse galleries:

```ts
.or("images.is.null,images.eq.{},photos_count.lt.2");
```

Then update `src/app/api/cron/backfill-images/route.ts` so AutoTrader gets a real backfill budget:

```ts
const MAX_LISTINGS_BY_SOURCE: Record<"BaT" | "BeForward" | "AutoScout24" | "AutoTrader", number> = {
  BaT: 20,
  BeForward: 60,
  AutoScout24: 20,
  AutoTrader: 40,
};
```

This keeps the cron bounded while still repairing the known AutoTrader backlog.

- [ ] **Step 4: Run test to verify it passes**

Run:

```bash
npx vitest run \
  src/features/scrapers/common/backfillImages.test.ts \
  src/app/api/cron/backfill-images/route.test.ts
```

Expected: PASS, and the helper should now backfill AutoTrader rows that have fewer than two photos instead of skipping them forever.

- [ ] **Step 5: Commit**

```bash
git add src/features/scrapers/common/backfillImages.ts src/app/api/cron/backfill-images/route.ts src/features/scrapers/common/backfillImages.test.ts
git commit -m "fix(autotrader): add legacy photo backfill support"
```

---

## Self-Review Checklist

- The plan covers the live failure mode, not just the parser. Task 1 proves the gap, Task 2 fixes discovery and enrichment, Task 3 repairs historical rows.
- The Scrapling dependency is constrained to a probe and optional validation, so the production path stays TypeScript-first.
- No task depends on a helper that is not introduced in the plan. The shared extractor is created before the collector, enrichment, and backfill route import it.
- The query changes explicitly target `photos_count < 2`, which matches the live DB evidence that some AutoTrader rows have only one image.
