import { test, expect } from "@playwright/test"

const TEST_LISTING_ID = process.env.TEST_LISTING_ID ?? ""

test.skip(!TEST_LISTING_ID, "set TEST_LISTING_ID=<uuid> to run")

test.describe("Haus Report — free view + paid view", () => {
  test("free car detail page shows teaser and no AAA language", async ({ page }) => {
    await page.goto(`/en/cars/porsche/${TEST_LISTING_ID}`)

    // Teaser CTA is visible
    await expect(page.getByText("Haus Report available")).toBeVisible()

    // No grade letters anywhere
    await expect(page.getByText(/\bAAA\b/)).toHaveCount(0)
    await expect(page.getByText(/Investment Grade/i)).toHaveCount(0)
  })

  test("paid report (?mock=992gt3) renders specific fair value, signals, and missing data", async ({ page }) => {
    await page.goto(`/en/cars/porsche/${TEST_LISTING_ID}/report?mock=992gt3`)

    // Specific-Car Fair Value headline
    await expect(page.getByText(/Specific-Car Fair Value/i)).toBeVisible()

    // Signals Detected section
    await expect(page.getByText("Signals Detected")).toBeVisible()

    // "Data we couldn't verify" missing signals section
    await expect(page.getByText(/Data we couldn't verify/i)).toBeVisible()

    // Paint-to-Sample modifier (+10% from fixture) shown somewhere
    await expect(page.getByText(/\+10%/)).toBeVisible()

    // Citation link visible (at least one `source` link from the modifier list)
    await expect(page.getByText(/source/i).first()).toBeVisible()
  })

  test("sparse fixture (?mock=sparse) renders empty-modifiers state gracefully", async ({ page }) => {
    await page.goto(`/en/cars/porsche/${TEST_LISTING_ID}/report?mock=sparse`)
    // Missing-signals section should be prominent for the sparse case
    await expect(page.getByText(/Data we couldn't verify/i)).toBeVisible()
    // "No adjustments applied" copy appears for empty modifier list
    await expect(page.getByText(/no adjustments applied/i)).toBeVisible()
  })
})
