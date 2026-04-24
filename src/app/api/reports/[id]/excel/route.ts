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
import { renderReportToExcelBuffer } from "@/lib/exports/excel/renderReport"
import {
  exportExists,
  getSignedExportUrl,
  uploadExport,
} from "@/lib/exports/storage"

export const runtime = "nodejs"

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params

  let car = CURATED_CARS.find((c) => c.id === id) ?? null
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }
  if (!car) {
    return NextResponse.json({ error: "listing_not_found" }, { status: 404 })
  }

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
    // silent — adapter returns a stub report
  }
  if (!v1Report) {
    return NextResponse.json(
      { error: "report_not_generated", message: "Generate the Haus Report online first." },
      { status: 404 },
    )
  }

  const [allPriced, dbComparables] = await Promise.all([
    fetchPricedListingsForModel(car.make),
    getComparablesForModel(car.make, car.model),
  ])
  const rates = await getExchangeRates()
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)

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

  const reportHash =
    v2.report_hash ||
    computeReportHash(v2, { ignoreKeys: ["generated_at", "report_hash", "report_id"] })
  v2.report_hash = reportHash

  // Try storage cache
  try {
    if (await exportExists(reportHash, "xlsx")) {
      const url = await getSignedExportUrl(reportHash, "xlsx")
      if (url) return NextResponse.redirect(url)
    }
  } catch {
    // fallback path below
  }

  const verdict = deriveVerdict(askingUsd, v2.specific_car_fair_value_mid)
  const buf = await renderReportToExcelBuffer({
    report: v2,
    car,
    regions: marketStats?.regions ?? [],
    comparables: dbComparables,
    askingUsd,
    verdict,
  })

  // Best-effort upload
  try {
    await uploadExport(reportHash, "xlsx", buf)
  } catch {
    // expected when bucket is not yet provisioned
  }

  return new Response(new Uint8Array(buf), {
    status: 200,
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="haus-report-${car.id}.xlsx"`,
      "Cache-Control": "private, max-age=0, no-store",
      "X-Report-Hash": reportHash,
    },
  })
}

function deriveAskingUsd(car: {
  soldPriceUsd?: number | null
  askingPriceUsd?: number | null
  currentBid: number
  price: number
}): number {
  const candidates = [car.soldPriceUsd, car.askingPriceUsd, car.currentBid, car.price]
  for (const v of candidates) {
    if (typeof v === "number" && v > 0) return v
  }
  return 0
}

function deriveVerdict(askingUsd: number, fairMid: number): "BUY" | "WATCH" | "WALK" {
  if (fairMid === 0) return "WATCH"
  const delta = ((askingUsd - fairMid) / fairMid) * 100
  if (delta <= -5) return "BUY"
  if (delta >= 10) return "WALK"
  return "WATCH"
}
