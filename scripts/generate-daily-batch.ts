#!/usr/bin/env tsx
/**
 * MonzaHaus Social Engine — v0.5 Local Batch Mode
 *
 * Generates a batch of carousel images + captions for manual upload to Meta Business.
 *
 * Usage:
 *   npx tsx scripts/generate-daily-batch.ts [count=10] [--skip-vision]
 *
 * Output:
 *   posts/YYYY-MM-DD/
 *     01-<slug>-<shortid>/
 *       slide-1.png ... slide-5.png (1080x1350 each)
 *       caption.txt
 *       listing-info.md
 *     02-<slug>-<shortid>/ ...
 *     INDEX.md
 */

import { createClient } from "@supabase/supabase-js";
import { promises as fs, existsSync, readFileSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Load .env.local before any module that reads process.env.
// Matches the convention used by other scripts (env-check.ts, db-porsche.ts).
function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFromFile(path.resolve(process.cwd(), ".env"));
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import chromium from "@sparticuz/chromium";
import { chromium as pw, type Browser } from "playwright-core";

import {
  ALLOWED_PLATFORMS,
  GATE_1,
  CAROUSEL,
} from "../src/features/social-engine/config";
import {
  matchesCollectorThesis,
  computeQualityScore,
} from "../src/features/social-engine/services/listingSelector";
import { filterRealPhotoUrls } from "../src/features/social-engine/services/photoValidator";
import { fetchComparablesSummary } from "../src/features/social-engine/services/comparablesService";
import { generateCaption } from "../src/features/social-engine/services/captionGenerator";
import { extractSeries, getSeriesThesis } from "../src/lib/brandConfig";

import { Slide1Cover } from "../src/features/social-engine/templates/CarouselV1/Slide1Cover";
import { Slide2Specs } from "../src/features/social-engine/templates/CarouselV1/Slide2Specs";
import { Slide3Market } from "../src/features/social-engine/templates/CarouselV1/Slide3Market";
import { Slide4Story } from "../src/features/social-engine/templates/CarouselV1/Slide4Story";
import { Slide5CTA } from "../src/features/social-engine/templates/CarouselV1/Slide5CTA";

import type { ListingRow } from "../src/features/social-engine/types";
import type { SlideData } from "../src/features/social-engine/templates/CarouselV1/templateData";

// ES module dirname shim
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const args = process.argv.slice(2);
const COUNT = parseInt(args.find((a) => /^\d+$/.test(a)) ?? "10", 10);
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const SKIP_VISION = args.includes("--skip-vision"); // reserved for future; v0.5 skips vision by default

function makeClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Missing Supabase env vars");
  return createClient(url, key, { auth: { persistSession: false } });
}

async function fetchCandidateListings(): Promise<ListingRow[]> {
  const supa = makeClient();
  // Broad fetch — no 7-day lookback for v0.5 because we want volume across full inventory.
  const { data, error } = await supa
    .from("listings")
    .select(
      "id, title, year, make, model, trim, platform, status, photos_count, data_quality_score, images, final_price, current_bid, engine, transmission, mileage, color_exterior, color_interior, location, reserve_status, seller_notes, created_at",
    )
    .eq("status", "active")
    .in("platform", ALLOWED_PLATFORMS as unknown as string[])
    .gte("photos_count", GATE_1.minPhotosCount)
    .gte("data_quality_score", GATE_1.minDataQualityScore)
    .eq("make", "Porsche")
    .order("data_quality_score", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(COUNT * 15);
  if (error) throw error;

  const thesisMatches = (data ?? []).filter((r) => matchesCollectorThesis(r as ListingRow));

  return thesisMatches
    .map((r) => ({ row: r as ListingRow, score: computeQualityScore(r as ListingRow) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, COUNT)
    .map((x) => x.row);
}

async function loadBrandTokensCss(): Promise<string> {
  const p = path.resolve(__dirname, "../src/features/social-engine/styles/brand-tokens.css");
  try {
    return await fs.readFile(p, "utf-8");
  } catch {
    // Fallback minimal tokens if the file is missing
    return `:root { --obsidian: #0E0A0C; --bone: #E8E2DE; --cream: #FDFBF9; --burgundy: #7A2E4A; --rose: #D4738A; }`;
  }
}

let CACHED_TOKENS_CSS: string | null = null;

async function buildSlideHtml(slideIdx: number, data: SlideData): Promise<string> {
  if (!CACHED_TOKENS_CSS) CACHED_TOKENS_CSS = await loadBrandTokensCss();
  const componentByIdx = {
    1: Slide1Cover, 2: Slide2Specs, 3: Slide3Market, 4: Slide4Story, 5: Slide5CTA,
  } as const;
  const Component = componentByIdx[slideIdx as 1 | 2 | 3 | 4 | 5];
  const body = renderToStaticMarkup(createElement(Component, { data }));
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500;600&family=Karla:wght@300;400;500;600;700&family=Geist+Mono&display=block" rel="stylesheet">
<style>
${CACHED_TOKENS_CSS}
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: 1080px; height: 1350px; overflow: hidden; background: #000; }
</style>
</head>
<body>${body}</body>
</html>`;
}

const MAC_CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

async function launchBrowser(): Promise<Browser> {
  // On macOS, @sparticuz/chromium ships a Linux binary that won't run. Prefer
  // the system Chrome; fall back to the sparticuz binary on Linux/Lambda.
  let executablePath = process.env.CHROMIUM_PATH;
  if (!executablePath) {
    if (process.platform === "darwin" && existsSync(MAC_CHROME)) {
      executablePath = MAC_CHROME;
    } else {
      executablePath = await chromium.executablePath();
    }
  }
  // On local, skip the aggressive sparticuz args (they're Lambda-specific).
  const args = process.platform === "darwin" ? ["--no-sandbox"] : chromium.args;
  return pw.launch({ executablePath, args, headless: true });
}

async function renderSlideToPng(browser: Browser, slideIdx: number, data: SlideData, outPath: string): Promise<void> {
  const html = await buildSlideHtml(slideIdx, data);
  const context = await browser.newContext({
    viewport: { width: CAROUSEL.width, height: CAROUSEL.height },
    deviceScaleFactor: CAROUSEL.deviceScaleFactor,
  });
  const page = await context.newPage();
  try {
    await page.setContent(html, { waitUntil: "networkidle", timeout: 30_000 });
    await page.evaluate(() => (document as unknown as { fonts: { ready: Promise<void> } }).fonts.ready);
    await new Promise((r) => setTimeout(r, 500));
    await page.screenshot({
      path: outPath,
      type: "png",
      fullPage: false,
      clip: { x: 0, y: 0, width: CAROUSEL.width, height: CAROUSEL.height },
    });
  } finally {
    await context.close();
  }
}

function sanitizeForPath(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);
}

function buildListingInfo(listing: ListingRow): string {
  const price = listing.final_price ?? listing.current_bid;
  return `# ${listing.title ?? `${listing.year} ${listing.make} ${listing.model}`}

- **ID**: \`${listing.id}\`
- **Year**: ${listing.year ?? "?"}
- **Make / Model / Trim**: ${listing.make} / ${listing.model} / ${listing.trim ?? "—"}
- **Engine**: ${listing.engine ?? "—"}
- **Transmission**: ${listing.transmission ?? "—"}
- **Mileage**: ${listing.mileage != null ? listing.mileage.toLocaleString() + " mi" : "—"}
- **Exterior color**: ${listing.color_exterior ?? "—"}
- **Price (asking/bid)**: ${price != null ? "$" + price.toLocaleString() : "—"}
- **Platform**: ${listing.platform}
- **Location**: ${listing.location ?? "—"}
- **Listing URL on MonzaHaus**: https://monzahaus.com/cars/${(listing.make ?? "unknown").toLowerCase()}/${listing.id}/report
`;
}

async function main() {
  console.log(`[v0.5] Generating daily batch — count=${COUNT}`);

  const today = new Date().toISOString().slice(0, 10);
  // Output lives in ~/Downloads/monzahaus-posts/YYYY-MM-DD/ so it's easy for
  // Edgar to reach from Finder and from phone cloud-sync. Override with
  // SOCIAL_OUTPUT_DIR env var if needed.
  const defaultRoot = path.join(process.env.HOME ?? process.cwd(), "Downloads", "monzahaus-posts");
  const rootDir = process.env.SOCIAL_OUTPUT_DIR ?? defaultRoot;
  const outDir = path.join(rootDir, today);
  await fs.mkdir(outDir, { recursive: true });

  const listings = await fetchCandidateListings();
  console.log(`Found ${listings.length} candidate listings`);
  if (listings.length === 0) {
    console.log("No candidates — exiting.");
    return;
  }

  const browser = await launchBrowser();
  const indexEntries: string[] = [];

  try {
    for (let i = 0; i < listings.length; i++) {
      const listing = listings[i];
      const idx = String(i + 1).padStart(2, "0");
      const slug = sanitizeForPath(`${listing.year}-${listing.model}-${listing.trim ?? ""}`);
      const shortId = listing.id.slice(0, 8);
      const postDir = path.join(outDir, `${idx}-${slug}-${shortId}`);

      if (await fs.stat(postDir).then(() => true).catch(() => false)) {
        console.log(`[${idx}/${listings.length}] ${slug} — already exists, skipping`);
        continue;
      }
      await fs.mkdir(postDir, { recursive: true });

      const photoUrls = filterRealPhotoUrls(listing.images ?? []);
      if (photoUrls.length < 4) {
        console.log(`[${idx}] ${slug} — not enough real photos (${photoUrls.length}), skipping`);
        await fs.rmdir(postDir).catch(() => {});
        continue;
      }

      const comps = await fetchComparablesSummary(listing).catch(() => null);

      let thesis = "A collector-grade example worth close examination.";
      if (listing.make === "Porsche" && listing.model && listing.year) {
        const series = extractSeries(listing.model, listing.year, listing.make);
        if (series) {
          const t = getSeriesThesis(series, listing.make);
          if (t) thesis = t;
        }
      }

      const data: SlideData = {
        listing,
        comps,
        thesis,
        photoUrls,
        selectedIndices: [0, 1, 2, 3],
      };

      console.log(`[${idx}/${listings.length}] ${slug} — generating caption + 5 slides...`);

      let caption;
      try {
        caption = await generateCaption(listing, comps, thesis);
      } catch (err) {
        console.log(`  caption error: ${(err as Error).message} — using fallback`);
        caption = {
          caption: `${listing.title}\n\n${thesis.slice(0, 160)}\n\nFull report at monzahaus.com/cars/${(listing.make ?? "").toLowerCase()}/${listing.id}/report`,
          hashtags: [],
        };
      }

      for (let s = 1; s <= 5; s++) {
        const outPath = path.join(postDir, `slide-${s}.png`);
        try {
          await renderSlideToPng(browser, s, data, outPath);
        } catch (err) {
          console.log(`  slide ${s} render error: ${(err as Error).message}`);
        }
      }

      const captionText = caption.caption +
        (caption.hashtags && caption.hashtags.length > 0 ? `\n\n${caption.hashtags.map((h) => `#${h}`).join(" ")}` : "");
      await fs.writeFile(path.join(postDir, "caption.txt"), captionText + "\n", "utf-8");
      await fs.writeFile(path.join(postDir, "listing-info.md"), buildListingInfo(listing), "utf-8");

      indexEntries.push(`- **${idx}. ${listing.title}** · ${listing.platform} · \`${listing.id.slice(0, 8)}\` → [folder](./${idx}-${slug}-${shortId}/)`);
      console.log(`  ✓ ${slug} done`);
    }
  } finally {
    await browser.close();
  }

  const indexMd = `# MonzaHaus — ${today}

${indexEntries.length} posts generated.

${indexEntries.join("\n")}

## Upload instructions

For each folder:
1. Open \`caption.txt\` → copy contents
2. In Meta Business Suite, create a new carousel post
3. Upload slide-1.png through slide-5.png in order
4. Paste the caption
5. Publish to Facebook Page + Instagram (select both)
`;
  await fs.writeFile(path.join(outDir, "INDEX.md"), indexMd, "utf-8");

  console.log(`\n[v0.5] Done. Output: ${outDir}`);
  console.log(`Open the folder and upload each carousel manually to Meta Business.`);
}

main().catch((err) => {
  console.error("Batch failed:", err);
  process.exit(1);
});
