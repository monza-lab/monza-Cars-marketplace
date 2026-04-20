import { expect, test, type Page } from "@playwright/test";

import { getSeriesForBrand } from "../../src/lib/brandConfig";

const locales = ["en", "es", "de", "ja"] as const;
const series = getSeriesForBrand("Porsche");

async function waitForClassicResults(page: import("@playwright/test").Page) {
  const cards = page.locator('a[href*="/cars/"]');
  await expect(cards.first()).toBeVisible({ timeout: 20_000 });
}

test("classic view loads Porsche families in every locale", async ({ page }) => {
  test.setTimeout(180_000);

  for (const locale of locales) {
    await page.goto(`/${locale}/browse`, { waitUntil: "domcontentloaded", timeout: 20_000 });

    // Smoke-check the unfiltered classic view first.
    await waitForClassicResults(page);

    for (const entry of series) {
      await page.goto(`/${locale}/browse?series=${encodeURIComponent(entry.id)}`, {
        waitUntil: "domcontentloaded",
        timeout: 20_000,
      });

      await waitForClassicResults(page);

      const activeFilter = page.locator("button").filter({ hasText: entry.label }).first();
      await expect(activeFilter).toBeVisible({ timeout: 10_000 });
    }
  }
}, { timeout: 120_000 });
