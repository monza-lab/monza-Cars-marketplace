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

  it("publishes one allowlisted real report as the durable sample", () => {
    const reportPage = read("src/app/[locale]/cars/[make]/[id]/report/page.tsx")
    const detailPage = read("src/app/[locale]/cars/[make]/[id]/page.tsx")

    expect(fs.existsSync(path.join(root, "src/app/[locale]/sample-report/page.tsx"))).toBe(true)
    expect(reportPage).toContain("isPublicSampleReport")
    expect(detailPage).toContain("assembleHausReportFromDB")
  })
})
