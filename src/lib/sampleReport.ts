import { normalizeUserReportListingId } from "@/lib/reports/queries"

// Verified against the production dataset on 2026-08-31. This is the real
// 1992 Porsche 964 Carrera RS report cited in the conversion audit.
export const PUBLIC_SAMPLE_REPORT_LISTING_UUID = "826fb6c6-60a7-4bb5-ae1d-e3a081ab3a2b"
export const PUBLIC_SAMPLE_REPORT_LISTING_ID = `live-${PUBLIC_SAMPLE_REPORT_LISTING_UUID}`

export function isPublicSampleReport(listingId: string, sample: string | undefined): boolean {
  return sample === "1"
    && normalizeUserReportListingId(listingId) === PUBLIC_SAMPLE_REPORT_LISTING_UUID
}
