import { expect, test } from "@playwright/test"

const baseUrl = process.env.E2E_BASE_URL ?? "http://localhost:52310"

test.use({ viewport: { width: 390, height: 844 } })

test("Instagram ad visitor can browse a car before entering email", async ({ page }) => {
  await page.goto(`${baseUrl}/browse?utm_source=instagram&utm_medium=paid_social&utm_campaign=embudo-v3`)

  await expect(page.getByText(/Porsche market intelligence/i)).toBeVisible()

  const cookieChoice = page.getByRole("button", { name: /reject/i })
  if (await cookieChoice.isVisible()) await cookieChoice.click()

  const firstCar = page.locator('a[href*="/cars/porsche/"]').first()
  await expect(firstCar).toBeVisible()
  await firstCar.click()

  const reportCta = page.getByRole("button", { name: /Generate Haus Report - free/i }).first()
  await expect(reportCta).toBeVisible({ timeout: 20_000 })
  await reportCta.click()

  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page.getByText(/open here and arrive in your inbox/i)).toBeVisible()
})

test("mobile sticky report CTA opens the email-first flow", async ({ page }) => {
  await page.goto(`${baseUrl}/cars/porsche/live-8bd6e983-2840-4428-b8c0-3970a3660bba`)

  const cookieChoice = page.getByRole("button", { name: /reject/i })
  if (await cookieChoice.isVisible()) await cookieChoice.click()

  await expect(page.getByRole("button", { name: /Full Haus Report/i })).toBeVisible({ timeout: 20_000 })
  await page.getByRole("heading", { name: "About This Vehicle" }).scrollIntoViewIfNeeded()

  const stickyReportCta = page
    .getByRole("link", { name: /^report$/i })
    .or(page.getByRole("button", { name: /^report$/i }))
  await expect(stickyReportCta).toBeVisible({ timeout: 20_000 })
  await stickyReportCta.click()

  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page).not.toHaveURL(/\/report(?:\?|$)/)
})

test("mobile bottom View Report CTA opens the email-first flow", async ({ page }) => {
  await page.goto(`${baseUrl}/cars/porsche/live-f4eab495-1066-4865-b297-abb28e011e6b`)

  const cookieChoice = page.getByRole("button", { name: /reject/i })
  if (await cookieChoice.isVisible()) await cookieChoice.click()

  const bottomReportCta = page
    .getByRole("link", { name: "View Report", exact: true })
    .or(page.getByRole("button", { name: "View Report", exact: true }))
  await expect(bottomReportCta).toBeVisible({ timeout: 20_000 })
  await bottomReportCta.click()

  await expect(page.getByRole("dialog")).toBeVisible()
  await expect(page.getByLabel("Email")).toBeVisible()
  await expect(page).not.toHaveURL(/\/report(?:\?|$)/)
})

test("sparse Carrera GT report opens in the same tab without invented valuation", async ({ page }) => {
  await page.goto(`${baseUrl}/cars/porsche/live-f4eab495-1066-4865-b297-abb28e011e6b`)

  const cookieChoice = page.getByRole("button", { name: /reject/i })
  if (await cookieChoice.isVisible()) await cookieChoice.click()

  const bottomReportCta = page
    .getByRole("link", { name: "View Report", exact: true })
    .or(page.getByRole("button", { name: "View Report", exact: true }))
  await expect(bottomReportCta).toBeVisible({ timeout: 20_000 })
  await bottomReportCta.click()

  await page.getByLabel("Email").fill(`qa.report.${Date.now()}@gmail.com`)
  await page.getByRole("button", { name: "Generate Haus Report - free" }).click()

  await expect(page).toHaveURL(/\/report\?access=.+/, { timeout: 60_000 })
  await expect(page.getByText("Insufficient market evidence").first()).toBeVisible({ timeout: 30_000 })
  await expect(page.getByText(/Analysis Requires Sign In/i)).toHaveCount(0)
  await expect(page.getByText(/\$0\s*-\s*\$0/)).toHaveCount(0)
})
