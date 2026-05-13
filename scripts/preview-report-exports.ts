/**
 * Standalone script to generate PDF + Excel previews of the V3 Haus Report
 * using local fixtures. Does NOT touch any API routes or DB.
 *
 * Usage:
 *   npx tsx scripts/preview-report-exports.ts
 *
 * Output:
 *   ~/Desktop/MonzaHaus-V3-Report-Dark.pdf
 *   ~/Desktop/MonzaHaus-V3-Report-Light.pdf
 *   ~/Desktop/MonzaHaus-V3-Report-Preview.xlsx
 */

import fs from "node:fs/promises"
import path from "node:path"
import os from "node:os"

import type { CollectorCar } from "@/lib/curatedCars"
import type { HausReport } from "@/lib/fairValue/types"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { adaptV1ReportToV2 } from "@/lib/fairValue/adaptV1ToV2"
import { renderReportToPdfBuffer } from "@/lib/exports/pdf/renderReport"
import { renderReportToExcelBuffer } from "@/lib/exports/excel/renderReport"

import v1Fixture from "@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json"
import v3Fixture from "@/lib/reports/__fixtures__/v3-911-gt3r-rennsport-mock.json"

const DESKTOP = path.join(os.homedir(), "Desktop")

const carStub = {
  id: "mock-911-gt3r-rennsport",
  title: "2024 Porsche 911 GT3 R Rennsport",
  make: "Porsche",
  model: "911 GT3 R Rennsport",
  year: 2024,
  price: 918_000,
  currentBid: 918_000,
  soldPriceUsd: null,
  askingPriceUsd: 918_000,
  region: "USA",
  image: "",
  imageUrl: "",
  images: [],
  url: "https://bringatrailer.com/listing/2024-porsche-911-gt3-r-rennsport",
  condition: "factory",
  mileage: 25,
  mileageUnit: "mi" as const,
  transmission: "Sequential",
  drivetrain: "RWD",
  color: "Grand Prix White",
  vin: "WP0ZZZ99ZRS200007",
} as unknown as CollectorCar

function deriveVerdict(askingUsd: number, fairMid: number | null): "BUY" | "WATCH" | "WALK" | "PENDING" {
  if (fairMid === 0 || fairMid == null) return "PENDING"
  const delta = ((askingUsd - fairMid) / fairMid) * 100
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}

async function main() {
  console.info("[preview] Loading fixtures...")
  const v1 = v1Fixture as unknown as HausReport
  const v3 = v3Fixture as unknown as HausReportV3
  const askingUsd = carStub.currentBid

  console.info("[preview] Adapting V1 → V2 (no marketStats, no comparables)...")
  const v2 = adaptV1ReportToV2({
    v1Report: v1,
    marketStats: null,
    dbComparables: [],
    thisVinPriceUsd: askingUsd,
    d2Precomputed: undefined,
  })

  // ─── Dark PDF ────────────────────────────────────────────────
  console.info("[preview] Rendering PDF — dark...")
  const darkStart = Date.now()
  const darkBuf = await renderReportToPdfBuffer({
    report: v2,
    car: carStub,
    regions: [],
    comparables: [],
    askingUsd,
    v3Report: v3,
    theme: "dark",
  })
  console.info(
    `[preview] Dark PDF rendered in ${((Date.now() - darkStart) / 1000).toFixed(2)}s — ${darkBuf.length} bytes`,
  )
  const darkPath = path.join(DESKTOP, "MonzaHaus-V3-Report-Dark.pdf")
  await fs.writeFile(darkPath, darkBuf)
  console.info(`[preview] Dark PDF saved → ${darkPath}`)

  // ─── Light PDF ───────────────────────────────────────────────
  console.info("[preview] Rendering PDF — light...")
  const lightStart = Date.now()
  const lightBuf = await renderReportToPdfBuffer({
    report: v2,
    car: carStub,
    regions: [],
    comparables: [],
    askingUsd,
    v3Report: v3,
    theme: "light",
  })
  console.info(
    `[preview] Light PDF rendered in ${((Date.now() - lightStart) / 1000).toFixed(2)}s — ${lightBuf.length} bytes`,
  )
  const lightPath = path.join(DESKTOP, "MonzaHaus-V3-Report-Light.pdf")
  await fs.writeFile(lightPath, lightBuf)
  console.info(`[preview] Light PDF saved → ${lightPath}`)

  // ─── Excel ───────────────────────────────────────────────────
  console.info("[preview] Rendering Excel...")
  const xlsxStart = Date.now()
  const verdict = deriveVerdict(askingUsd, v2.specific_car_fair_value_mid)
  const xlsxBuf = await renderReportToExcelBuffer({
    report: v2,
    car: carStub,
    regions: [],
    comparables: [],
    askingUsd,
    verdict,
    v3Report: v3,
  })
  console.info(
    `[preview] Excel rendered in ${((Date.now() - xlsxStart) / 1000).toFixed(2)}s — ${xlsxBuf.length} bytes`,
  )
  const xlsxPath = path.join(DESKTOP, "MonzaHaus-V3-Report-Preview.xlsx")
  await fs.writeFile(xlsxPath, xlsxBuf)
  console.info(`[preview] Excel saved → ${xlsxPath}`)

  console.info("\n[preview] Done. Files saved to Desktop:")
  console.info(`  · ${path.basename(darkPath)}`)
  console.info(`  · ${path.basename(lightPath)}`)
  console.info(`  · ${path.basename(xlsxPath)}`)
}

main().catch((err) => {
  console.error("[preview] Failed:", err)
  process.exit(1)
})
