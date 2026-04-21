import { describe, it, expect } from "vitest"
import { renderReportToExcelBuffer } from "./renderReport"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"

const sampleReport: HausReportV2 = {
  listing_id: "abc",
  fair_value_low: 210000,
  fair_value_high: 240000,
  median_price: 225000,
  specific_car_fair_value_low: 220000,
  specific_car_fair_value_mid: 235000,
  specific_car_fair_value_high: 250000,
  comparable_layer_used: "strict",
  comparables_count: 14,
  signals_detected: [],
  signals_missing: [],
  modifiers_applied: [
    {
      key: "paint_to_sample",
      signal_key: "paint_to_sample",
      delta_percent: 10,
      baseline_contribution_usd: 22500,
      citation_url: "https://hagerty.example",
      version: "v1.0",
    },
  ],
  modifiers_total_percent: 10,
  signals_extracted_at: "2026-04-20T00:00:00Z",
  extraction_version: "v1.0",
  report_id: "r1",
  report_hash: "a7f3c29b".repeat(8),
  report_version: 1,
  tier: "tier_1",
  specialist_coverage_available: false,
  generated_at: "2026-04-21T00:00:00Z",
  market_intel: {
    d1: { sold_trajectory: [], sold_12m_count: 14, sold_6m_count: 8, trend_12m_direction: "stable", trend_12m_percent: 0 },
    d2: { by_region: [], target_region: "US", narrative_insight: null },
    d3: { vin_percentile_within_variant: 62, variant_distribution_bins: [], adjacent_variants: [] },
    d4: {
      confidence_tier: "high",
      sample_size: 14,
      capture_date_start: "2026-03-01",
      capture_date_end: "2026-04-01",
      outlier_flags: [],
    },
  },
  remarkable_claims: [],
}

const sampleCar = {
  id: "abc",
  title: "2023 Porsche 992 GT3 Touring",
  year: 2023,
  make: "Porsche",
  model: "992 GT3 Touring",
  trim: null,
  price: 225000,
  trend: "stable",
  trendValue: 0,
  thesis: "",
  image: "",
  images: [],
  engine: "",
  transmission: "",
  mileage: 5000,
  mileageUnit: "mi",
  location: "",
  region: "US",
  fairValueByRegion: { US: { low: 220000, high: 250000 } },
  history: "",
  platform: "BaT",
  status: "ACTIVE",
  currentBid: 225000,
  bidCount: 0,
  endTime: new Date(),
  category: "",
} as unknown as CollectorCar

describe("renderReportToExcelBuffer", () => {
  it("produces a non-empty xlsx buffer", async () => {
    const buf = await renderReportToExcelBuffer({
      report: sampleReport,
      car: sampleCar,
      regions: [],
      comparables: [],
      askingUsd: 225000,
      verdict: "WATCH",
    })
    expect(buf.byteLength).toBeGreaterThan(1000)
    // xlsx is a zip archive → starts with PK header bytes 0x50, 0x4B
    expect(buf[0]).toBe(0x50)
    expect(buf[1]).toBe(0x4b)
  }, 30000)
})
