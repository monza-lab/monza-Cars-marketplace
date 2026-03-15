import { test, expect, type Page } from "@playwright/test";

/**
 * Audit "Valuation by Market" for every Porsche family on the dashboard.
 *
 * For each family that appears in the sidebar we:
 *  1. Click the family button
 *  2. Wait for the context panel to load
 *  3. Read each region row inside "Valuation by Market"
 *  4. Assert the USD values are sane (> $1K, no NaN, no $0)
 *  5. Collect everything into a summary table printed at the end
 */

type RegionRow = {
  region: string;
  displayValue: string;
  usdEquiv: string;
  barWidth: string;
};

type FamilyResult = {
  family: string;
  regions: RegionRow[];
  error?: string;
};

// Parse a price string like "$218K" or "$1.2M" or "€155K" into a raw number (in thousands)
function parsePriceK(text: string): number {
  const cleaned = text.replace(/[^0-9.KMkm]/g, "");
  const upper = cleaned.toUpperCase();
  if (upper.endsWith("M")) return parseFloat(upper) * 1000;
  if (upper.endsWith("K")) return parseFloat(upper);
  return parseFloat(upper) / 1000;
}

async function getValuationData(page: Page): Promise<RegionRow[]> {
  // Find the "Valuation by Market" section — look for the heading text
  const section = page.locator("text=Valuation by Market").first();
  await section.waitFor({ timeout: 5000 }).catch(() => {});

  // The section container is 2 levels up from the heading span
  // Find all region rows — they have flag emojis and market names
  const regionBlocks = page.locator(
    "div.space-y-1 > div.rounded-xl"
  );

  const count = await regionBlocks.count();
  const rows: RegionRow[] = [];

  for (let i = 0; i < count; i++) {
    const block = regionBlocks.nth(i);
    // Region name: "US Market", "UK Market", "EU Market", "Japan"
    const regionLabel = await block
      .locator("span.font-semibold")
      .first()
      .textContent()
      .catch(() => null);
    if (!regionLabel) continue;

    // Main price display: "$218K" etc.
    const displayValue = await block
      .locator("span.font-mono.font-bold")
      .first()
      .textContent()
      .catch(() => "N/A");

    // USD equivalent: "$218K USD"
    const usdEquiv = await block
      .locator("span.font-mono.text-muted-foreground")
      .last()
      .textContent()
      .catch(() => "N/A");

    // Bar width
    const bar = block.locator("div.rounded-full.transition-all.bg-gradient-to-r");
    const style = await bar.getAttribute("style").catch(() => "");
    const widthMatch = style?.match(/width:\s*([\d.]+)%/);
    const barWidth = widthMatch ? `${Math.round(parseFloat(widthMatch[1]))}%` : "0%";

    rows.push({
      region: regionLabel?.trim() ?? "?",
      displayValue: displayValue?.trim() ?? "N/A",
      usdEquiv: usdEquiv?.trim() ?? "N/A",
      barWidth,
    });
  }

  return rows;
}

test("audit valuations for all families", async ({ page }) => {
  test.setTimeout(120_000);
  // 1. Navigate to dashboard
  await page.goto("/en", { waitUntil: "networkidle" });
  await page.waitForTimeout(3000); // let auctions load

  // 2. Find all family buttons in the sidebar
  const familyButtons = page.locator(
    "button:has(span.text-\\[11px\\].font-medium)"
  );
  await familyButtons.first().waitFor({ timeout: 10000 });
  const familyCount = await familyButtons.count();

  console.log(`\n${"=".repeat(80)}`);
  console.log(`VALUATION AUDIT — Found ${familyCount} families`);
  console.log(`${"=".repeat(80)}\n`);

  const results: FamilyResult[] = [];

  for (let i = 0; i < familyCount; i++) {
    // Re-query buttons each iteration (DOM may change after click)
    const buttons = page.locator(
      "button:has(span.text-\\[11px\\].font-medium)"
    );
    const btn = buttons.nth(i);
    const familyName =
      (await btn.locator("span.text-\\[11px\\]").first().textContent())?.trim() ?? `Family ${i}`;

    console.log(`\n--- ${familyName} ---`);

    // Click the family
    await btn.click();
    await page.waitForTimeout(1500); // let context panel re-render

    try {
      const regions = await getValuationData(page);

      if (regions.length === 0) {
        console.log("  ⚠ No valuation data found (section may not exist for this family)");
        results.push({ family: familyName, regions: [], error: "No valuation section" });
        continue;
      }

      for (const r of regions) {
        const usdK = parsePriceK(r.usdEquiv);
        const isSuspicious = usdK < 2 || isNaN(usdK);
        const marker = isSuspicious ? " ⚠ SUSPICIOUS" : " ✓";
        console.log(
          `  ${r.region.padEnd(15)} ${r.displayValue.padEnd(10)} (${r.usdEquiv.padEnd(12)}) bar=${r.barWidth}${marker}`
        );
      }

      results.push({ family: familyName, regions });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ ERROR: ${msg}`);
      results.push({ family: familyName, regions: [], error: msg });
    }
  }

  // 3. Print summary table
  console.log(`\n\n${"=".repeat(80)}`);
  console.log("SUMMARY");
  console.log(`${"=".repeat(80)}`);

  let issues = 0;
  for (const r of results) {
    if (r.error) {
      // "No valuation section" is expected for rare families with 0 listings
      if (r.error.includes("No valuation")) {
        console.log(`\n${r.family}: ⚠ No valuation section (expected if 0 listings)`);
      } else {
        console.log(`\n${r.family}: ERROR — ${r.error}`);
        issues++;
      }
      continue;
    }
    if (r.regions.length === 0) {
      console.log(`\n${r.family}: No regions displayed`);
      continue;
    }
    console.log(`\n${r.family}:`);
    for (const reg of r.regions) {
      const usdK = parsePriceK(reg.usdEquiv);
      if (usdK < 2 || isNaN(usdK)) {
        console.log(`  ⚠ ${reg.region}: ${reg.usdEquiv} — VALUE TOO LOW OR INVALID`);
        issues++;
      } else {
        console.log(`  ✓ ${reg.region}: ${reg.usdEquiv}`);
      }
    }
  }

  console.log(`\n${"=".repeat(80)}`);
  console.log(`Total families: ${results.length}, Issues: ${issues}`);
  console.log(`${"=".repeat(80)}\n`);

  // Fail the test if any suspicious values found
  expect(issues, `Found ${issues} suspicious valuation(s)`).toBe(0);
});
