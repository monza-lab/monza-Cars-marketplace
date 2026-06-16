import { NextResponse } from "next/server"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchPricedListingsForModel,
} from "@/lib/supabaseLiveListings"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { getExchangeRates } from "@/lib/exchangeRates"
import {
  getReportForListing,
  fetchSignalsForListing,
  assembleHausReportFromDB,
} from "@/lib/reports/queries"
import { getStrictComparablesForModel } from "@/lib/db/queries"
import type { HausReport } from "@/lib/fairValue/types"
import { adaptV1ReportToV2 } from "@/lib/fairValue/adaptV1ToV2"
import {
  computeArbitrageForCar,
  inferTargetRegion,
} from "@/lib/marketIntel/computeArbitrageForCar"
import { computeReportHash } from "@/lib/reports/hash"
import { renderReportToPdfBuffer } from "@/lib/exports/pdf/renderReport"
import {
  exportExists,
  getSignedExportUrl,
  uploadExport,
} from "@/lib/exports/storage"
import { fetchReportSections } from "@/lib/reports/reportSections"
import { assembleV3ReportFromSections } from "@/lib/reports/assembleV3Report"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { checkReportAccess } from "@/lib/reports/access"

// Run on Node (react-pdf requires Node APIs, not edge).
export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  try {
  const { id } = await params

  // 0. Authorization — paid report content. Only an authenticated user who has
  //    already generated/paid for this listing's report (or holds unlimited
  //    access) may download it. The report is loaded below via the
  //    RLS-bypassing service-role client, so this is the sole access boundary.
  const access = await checkReportAccess(id)
  if (!access.ok) {
    return access.reason === "unauthenticated"
      ? NextResponse.json({ error: "auth_required" }, { status: 401 })
      : NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  // 1. Resolve car (curated or live)
  let car = CURATED_CARS.find((c) => c.id === id) ?? null
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }
  if (!car) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 })
  }

  // 2. Fetch V3 sections upfront (used for both V1 fallback and V3 PDF pages)
  let v3Sections: Awaited<ReturnType<typeof fetchReportSections>> = []
  try {
    v3Sections = await fetchReportSections(car.id, 1)
  } catch {
    // V3 table may not exist yet
  }

  // 3. Resolve HausReport — try V1 (listing_reports) first, fall back to V3 fair_value section
  let v1Report: HausReport | null = null
  try {
    const reportRow = await getReportForListing(car.id)
    if (reportRow) {
      const signalRows = await fetchSignalsForListing(car.id)
      v1Report = assembleHausReportFromDB(
        reportRow as unknown as Record<string, unknown>,
        signalRows,
      )
    }
  } catch {
    // swallow — will try V3 fallback below
  }

  // V3 fallback: extract the fair_value section which contains a HausReport
  if (!v1Report) {
    const fairValueSection = v3Sections.find(s => s.section_key === "fair_value")
    if (fairValueSection?.section_data) {
      v1Report = fairValueSection.section_data as HausReport
    }
  }

  if (!v1Report) {
    return NextResponse.json(
      { error: "report_not_generated", message: "Generate the Haus Report online first." },
      { status: 404 },
    )
  }

  // 4. Fetch surrounding context (comparables + market stats)
  const [allPriced, dbComparables] = await Promise.all([
    fetchPricedListingsForModel(car.make),
    getStrictComparablesForModel(car.make, car.model),
  ])
  const rates = await getExchangeRates()
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)

  // 5. Adapt to v2 — including pre-computed D2 cross-border arbitrage
  const askingUsd = deriveAskingUsd(car)
  const targetRegion = inferTargetRegion(car.region)
  const d2Precomputed =
    askingUsd > 0
      ? await computeArbitrageForCar({
          pricedListings: allPriced,
          thisVinPriceUsd: askingUsd,
          targetRegion,
          carYear: car.year,
        })
      : undefined
  const v2 = adaptV1ReportToV2({
    v1Report,
    marketStats,
    dbComparables,
    thisVinPriceUsd: askingUsd,
    d2Precomputed,
  })

  // 6. Stable hash for this snapshot (ignoring volatile timestamps).
  //    Used as the storage key if the bucket is available.
  const reportHash =
    v2.report_hash ||
    computeReportHash(v2, { ignoreKeys: ["generated_at", "report_hash", "report_id"] })
  v2.report_hash = reportHash

  // 6. Try Storage cache (graceful fallback if bucket missing/BE not migrated).
  let signedUrl: string | null = null
  let storageAvailable = false
  try {
    if (await exportExists(reportHash, "pdf")) {
      signedUrl = await getSignedExportUrl(reportHash, "pdf")
      storageAvailable = signedUrl !== null
    }
  } catch {
    storageAvailable = false
  }

  if (storageAvailable && signedUrl) {
    return NextResponse.redirect(signedUrl)
  }

  // 7. Assemble V3 report from pre-fetched sections (if available)
  const v3Report: HausReportV3 | null =
    v3Sections.length > 0 ? assembleV3ReportFromSections(v3Sections, car.id) : null

  // 8. Generate fresh PDF
  const buf = await renderReportToPdfBuffer({
    report: v2,
    car,
    regions: marketStats?.regions ?? [],
    comparables: dbComparables,
    askingUsd,
    v3Report,
  })

  // 9. Best-effort cache: try to upload to Storage. Silent fallback on failure
  //    (no bucket / BE not migrated yet).
  try {
    await uploadExport(reportHash, "pdf", buf)
  } catch {
    // expected when BACKEND-HANDOFF storage bucket hasn't been created yet
  }

  // 10. Return PDF inline — works with or without Storage caching.
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="haus-report-${car.id}.pdf"`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Report-Hash": reportHash,
    },
  })

  } catch (err) {
    console.error("[pdf/route] PDF generation failed:", err)
    return NextResponse.json(
      { error: "pdf_generation_failed", message: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    )
  }
}

function deriveAskingUsd(car: { soldPriceUsd?: number | null; askingPriceUsd?: number | null; currentBid: number; price: number }): number {
  const candidates = [car.soldPriceUsd, car.askingPriceUsd, car.currentBid, car.price]
  for (const v of candidates) {
    if (typeof v === "number" && v > 0) return v
  }
  return 0
}
