import fs from "node:fs"
import path from "node:path"
import { describe, expect, it } from "vitest"

const root = process.cwd()
const read = (relative: string) => fs.readFileSync(path.join(root, relative), "utf8")

describe("conversion funnel contract", () => {
  it("does not advertise monthly free-report resets in public English copy", () => {
    const messages = read("messages/en.json")
    const terms = read("src/app/[locale]/legal/terms/page.tsx")
    const billing = read("src/components/payments/BillingDashboard.tsx")

    expect(messages).not.toMatch(/3 free reports\s*\/\s*month/i)
    expect(messages).not.toMatch(/free Pistons each month/i)
    expect(messages).not.toMatch(/reset on the 1st/i)
    expect(terms).not.toMatch(/Free-tier Pistons reset monthly/i)
    expect(terms).toContain("one-time introductory allowance")
    expect(billing).not.toMatch(/Free monthly/i)
    expect(billing).toContain("Introductory allowance")
  })

  it("keeps legal identity and authority visible in the funnel", () => {
    const footer = read("src/components/layout/AppFooter.tsx")
    const jsonLd = read("src/components/seo/JsonLd.tsx")

    expect(footer).not.toMatch(/<footer className="hidden/)
    expect(footer).toContain('href="/methodology"')
    expect(footer).toContain("instagram.com/monzahaus")
    expect(jsonLd).toContain('"https://www.instagram.com/monzahaus"')
  })

  it("mounts real progress and methodology but never the fabricated sample modal", () => {
    const reportSheet = read("src/components/report/ReportEmailSheet.tsx")
    const detail = read("src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx")

    expect(reportSheet).toContain("<GenerationStepper")
    expect(detail).toContain("<MethodologyLink")
    expect(`${reportSheet}\n${detail}`).not.toContain("<SeeSampleModal")
  })

  it("never sells a family band as one car's fair value", () => {
    const card = read("src/components/browse/BrowseCard.tsx")
    const cache = read("src/lib/dashboardCache.ts")
    const ranking = read("src/lib/homepageRanking.ts")

    // No delta pill on a card: the only band a card holds is the family's.
    expect(card).not.toContain("<MarketDeltaPill")
    expect(card).toContain("resolveFamilyBandLabel")
    expect(card).not.toMatch(/Fair value \{/)
    expect(cache).toContain("isFamilyBandRepresentative")
    expect(cache).toContain("bandBracketsPrice")
    // The band must not decide what leads the fold.
    expect(ranking).not.toMatch(/if \(a\.hasFairValueBand !== b\.hasFairValueBand\)/)
    expect(ranking).toContain("isPostProductionClassic")
  })

  it("keeps the source platform's own page out of listing copy", () => {
    const reader = read("src/lib/supabaseLiveListings.ts")
    const detail = read("src/app/[locale]/cars/[make]/[id]/CarDetailClient.tsx")
    const classicScraper = read("src/features/scrapers/classic_collector/detail.ts")

    expect(reader).toContain("sanitizeListingDescription(row.description_text)")
    expect(reader).toContain("sanitizeListingDescription(row.seller_notes)")
    expect(detail).toContain("sellerDescriptionText(car)")
    expect(detail).toContain("{sellerDescription && (")
    expect(classicScraper).toContain("extractSellerDescription(bodyText)")
    expect(classicScraper).not.toContain("description: bodyText.trim()")
  })

  it("dates the report instead of naming the engine that wrote it", () => {
    const story = read("src/components/report/InvestmentStoryBlock.tsx")

    expect(story).not.toContain("narrative.generatedBy")
    expect(story).toContain("Prepared")
  })

  it("pays the landed-cost promise and writes MonzaHaus as one word", () => {
    const reportClient = read("src/app/[locale]/cars/[make]/[id]/report/ReportClient.tsx")
    const reportPage = read("src/app/[locale]/cars/[make]/[id]/report/page.tsx")

    expect(reportClient).not.toMatch(/Monza Haus/)
    expect(reportClient).toContain("report?.landed_cost ?? landedCostEstimate")
    expect(reportClient).not.toContain("Landed cost not estimated")
    expect(reportPage).toContain("calculateLandedCost")
  })

  it("keeps the consent banner off the dialog layer during the email ask", () => {
    const banner = read("src/components/legal/CookieBanner.tsx")
    const browse = read("src/components/browse/BrowseClient.tsx")

    expect(banner).toContain("useOpenDialog")
    expect(banner).toContain("!dialogOpen")
    expect(browse).toContain("dialogOpen")
  })

  it("publishes one allowlisted real report as the durable sample", () => {
    const reportPage = read("src/app/[locale]/cars/[make]/[id]/report/page.tsx")
    const detailPage = read("src/app/[locale]/cars/[make]/[id]/page.tsx")

    expect(fs.existsSync(path.join(root, "src/app/[locale]/sample-report/page.tsx"))).toBe(true)
    expect(reportPage).toContain("isPublicSampleReport")
    expect(detailPage).toContain("assembleHausReportFromDB")
  })
})
