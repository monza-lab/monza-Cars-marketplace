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
import { getComparablesForModel } from "@/lib/db/queries"
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

// Run on Node (react-pdf requires Node APIs, not edge).
export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  // 1. Resolve car (curated or live)
  let car = CURATED_CARS.find((c) => c.id === id) ?? null
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }
  if (!car) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 })
  }

  // 2. Resolve v1 HausReport from DB
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
    // swallow — empty report flows into the adapter which renders an empty dossier
  }
  if (!v1Report) {
    return NextResponse.json(
      { error: "report_not_generated", message: "Generate the Haus Report online first." },
      { status: 404 },
    )
  }

  // 3. Fetch surrounding context (comparables + market stats)
  const [allPriced, dbComparables] = await Promise.all([
    fetchPricedListingsForModel(car.make),
    getComparablesForModel(car.make, car.model),
  ])
  const rates = await getExchangeRates()
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)

  // 4. Adapt to v2 — including pre-computed D2 cross-border arbitrage
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

  // 5. Stable hash for this snapshot (ignoring volatile timestamps).
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

  // 7. Generate fresh PDF
  const buf = await renderReportToPdfBuffer({
    report: v2,
    car,
    regions: marketStats?.regions ?? [],
    comparables: dbComparables,
    askingUsd,
  })

  // 8. Best-effort cache: try to upload to Storage. Silent fallback on failure
  //    (no bucket / BE not migrated yet).
  try {
    await uploadExport(reportHash, "pdf", buf)
  } catch {
    // expected when BACKEND-HANDOFF storage bucket hasn't been created yet
  }

  // 9. Return PDF inline — works with or without Storage caching.
  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="haus-report-${car.id}.pdf"`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Report-Hash": reportHash,
    },
  })
}

function deriveAskingUsd(car: { soldPriceUsd?: number | null; askingPriceUsd?: number | null; currentBid: number; price: number }): number {
  const candidates = [car.soldPriceUsd, car.askingPriceUsd, car.currentBid, car.price]
  for (const v of candidates) {
    if (typeof v === "number" && v > 0) return v
  }
  return 0
}
