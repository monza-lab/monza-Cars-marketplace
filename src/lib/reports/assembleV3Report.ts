// src/lib/reports/assembleV3Report.ts
import type { ReportSectionRow } from "./reportSections"
import type {
  HausReportV3,
  ScrapedListingFull,
  VehicleIdentity,
  MarketDataBundle,
  TechnicalAnalysis,
  InvestmentAnalysis,
  DueDiligenceReport,
  MarketResearch,
  BuyerServices,
  FinalSynthesis,
  ReportSectionKey,
} from "./types-v3"

export function assembleV3ReportFromSections(
  rows: ReportSectionRow[],
  listingId: string
): HausReportV3 {
  const sectionMap = new Map<ReportSectionKey, unknown>()
  let totalDuration = 0

  for (const row of rows) {
    sectionMap.set(row.section_key, row.section_data)
    totalDuration += row.generation_duration_ms ?? 0
  }

  return {
    listingId,
    reportVersion: 3,
    listingScrape: (sectionMap.get("listing_scrape") as ScrapedListingFull) ?? null,
    vehicleIdentity: (sectionMap.get("vehicle_identity") as VehicleIdentity) ?? null,
    marketData: (sectionMap.get("market_data_bundle") as MarketDataBundle) ?? null,
    technicalAnalysis: (sectionMap.get("technical_analysis") as TechnicalAnalysis) ?? null,
    investmentAnalysis: (sectionMap.get("investment_analysis") as InvestmentAnalysis) ?? null,
    dueDiligence: (sectionMap.get("due_diligence") as DueDiligenceReport) ?? null,
    marketResearch: (sectionMap.get("market_research") as MarketResearch) ?? null,
    buyerServices: (sectionMap.get("buyer_services") as BuyerServices) ?? null,
    finalSynthesis: (sectionMap.get("final_synthesis") as FinalSynthesis) ?? null,
    generatedAt: rows[rows.length - 1]?.created_at ?? new Date().toISOString(),
    totalDurationMs: totalDuration,
    stepsCompleted: rows.length,
    stepsFailed: 10 - rows.length,
  }
}
