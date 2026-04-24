/**
 * Dev script: render a Haus Report PDF + Excel from a fixture and save
 * locally. Useful for QA / branding review without a generated DB report.
 *
 * Usage:
 *   npx tsx scripts/render-mock-report.ts
 *
 * Outputs:
 *   /tmp/haus-report-mock.pdf
 *   /tmp/haus-report-mock.xlsx
 */
import * as fs from "fs"
import * as path from "path"
import type { CollectorCar } from "@/lib/curatedCars"
import type { HausReport, HausReportV2, MarketIntelD2 } from "@/lib/fairValue/types"
import { adaptV1ReportToV2 } from "@/lib/fairValue/adaptV1ToV2"
import { renderReportToPdfBuffer } from "@/lib/exports/pdf/renderReport"
import { renderReportToExcelBuffer } from "@/lib/exports/excel/renderReport"

async function main() {
  const fixturePath = path.join(
    process.cwd(),
    "src/lib/fairValue/__fixtures__/992-gt3-pts-mock.json",
  )
  const v1Report = JSON.parse(fs.readFileSync(fixturePath, "utf-8")) as HausReport

  const car: CollectorCar = {
    id: "mock-992-gt3",
    make: "Porsche",
    model: "992 GT3 Touring",
    trim: "Touring",
    year: 2023,
    currentBid: 290_000,
    askingPriceUsd: 290_000,
    soldPriceUsd: null,
    price: 290_000,
    mileage: 4200,
    mileageUnit: "miles",
    images: [],
    title: "2023 Porsche 992 GT3 Touring — Paint-to-Sample Gulf Blue",
    auctionEnd: null,
    location: "Los Angeles, CA",
    region: "US",
    series: "992",
    priceHistory: [],
  } as unknown as CollectorCar

  const askingUsd = 290_000

  // Sample D2 — illustrates populated Cross-Border Opportunity block
  const d2Precomputed: MarketIntelD2 = {
    target_region: "US",
    narrative_insight:
      "EU-sourced example costs ~$11K less than local listing after import. Worth exploring if timeline allows.",
    by_region: [
      {
        region: "US",
        cheapest_comparable_usd: 290_000,
        cheapest_comparable_listing_id: "us-mock",
        cheapest_comparable_url: null,
        landed_cost_to_target_usd: 0,
        total_landed_to_target_usd: 290_000,
      },
      {
        region: "EU",
        cheapest_comparable_usd: 255_000,
        cheapest_comparable_listing_id: "eu-mock",
        cheapest_comparable_url: "https://as24.example/eu-1",
        landed_cost_to_target_usd: 24_000,
        total_landed_to_target_usd: 279_000,
      },
      {
        region: "UK",
        cheapest_comparable_usd: 268_000,
        cheapest_comparable_listing_id: "uk-mock",
        cheapest_comparable_url: null,
        landed_cost_to_target_usd: 20_000,
        total_landed_to_target_usd: 288_000,
      },
      {
        region: "JP",
        cheapest_comparable_usd: 245_000,
        cheapest_comparable_listing_id: "jp-mock",
        cheapest_comparable_url: null,
        landed_cost_to_target_usd: 28_000,
        total_landed_to_target_usd: 273_000,
      },
    ],
  }

  const v2: HausReportV2 = adaptV1ReportToV2({
    v1Report,
    marketStats: null,
    dbComparables: [
      { title: "2023 Porsche 992 GT3 Touring", platform: "BaT", soldDate: "2026-03-15", soldPrice: 288_000, mileage: 4500, condition: null },
      { title: "2023 Porsche 992 GT3 Touring", platform: "BaT", soldDate: "2026-02-28", soldPrice: 295_000, mileage: 3200, condition: null },
      { title: "2023 Porsche 992 GT3 Touring PTS", platform: "Collecting Cars", soldDate: "2026-02-10", soldPrice: 312_000, mileage: 2800, condition: null },
      { title: "2022 Porsche 992 GT3 Touring", platform: "BaT", soldDate: "2026-01-28", soldPrice: 275_000, mileage: 8500, condition: null },
      { title: "2023 Porsche 992 GT3 Touring", platform: "BaT", soldDate: "2026-01-15", soldPrice: 298_000, mileage: 4100, condition: null },
    ],
    thisVinPriceUsd: askingUsd,
    tier: "tier_2",
    reportHash: "a7f3c29b12e4f5d6c7b8a9f0e1d2c3b4a5",
    reportId: "mock-report",
    reportVersion: 1,
    generatedAt: "2026-04-24T22:00:00Z",
    d2Precomputed,
  })

  console.log("Rendering PDF…")
  const pdfBuf = await renderReportToPdfBuffer({
    report: v2,
    car,
    regions: [],
    comparables: [],
    askingUsd,
  })
  const pdfPath = "/tmp/haus-report-mock.pdf"
  fs.writeFileSync(pdfPath, pdfBuf)
  console.log(`  → ${pdfPath} (${pdfBuf.length} bytes)`)

  console.log("Rendering Excel…")
  const xlsxBuf = await renderReportToExcelBuffer({
    report: v2,
    car,
    regions: [],
    comparables: [],
    askingUsd,
  })
  const xlsxPath = "/tmp/haus-report-mock.xlsx"
  fs.writeFileSync(xlsxPath, xlsxBuf)
  console.log(`  → ${xlsxPath} (${xlsxBuf.length} bytes)`)

  console.log("\nDone. Open with:")
  console.log(`  open ${pdfPath}`)
  console.log(`  open ${xlsxPath}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
