import { notFound } from "next/navigation"
import { Suspense } from "react"
import { setRequestLocale } from "next-intl/server"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchLiveListingByIdWithStatus,
  fetchLiveListingsAsCollectorCars,
  fetchPricedListingsForModel,
} from "@/lib/supabaseLiveListings"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { getExchangeRates } from "@/lib/exchangeRates"
import {
  getReportForListing,
  fetchSignalsForListing,
  assembleHausReportFromDB,
} from "@/lib/reports/queries"
import { ReportClient } from "./ReportClient"
import { ReportClientV2 } from "./ReportClientV2"
import { findSimilarCars } from "@/lib/similarCars"
import type { HausReport } from "@/lib/fairValue/types"
import { getComparablesForModel } from "@/lib/db/queries"

interface ReportPageProps {
  params: Promise<{ locale: string; make: string; id: string }>
  searchParams?: Promise<{ mock?: string; v2?: string }>
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params

  let car = CURATED_CARS.find(c => c.id === id) ?? null
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) return { title: "Not Found | Monza Lab" }

  return {
    title: `Investment Dossier: ${car.title} | Monza Lab`,
    description: `Comprehensive investment analysis for ${car.title}. Valuation, risk assessment, ownership economics, and market context.`,
  }
}

export async function generateStaticParams() {
  return CURATED_CARS.map(car => ({
    make: car.make.toLowerCase().replace(/\s+/g, "-"),
    id: car.id,
  }))
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const { locale, id } = await params
  const resolvedSearch = (await searchParams) ?? {}
  const mockName = resolvedSearch.mock
  setRequestLocale(locale)

  const isLiveId = id.startsWith("live-")

  let car = CURATED_CARS.find(c => c.id === id) ?? null
  let liveLookupTransientError = false

  if (!car && isLiveId) {
    const liveLookup = await fetchLiveListingByIdWithStatus(id)
    car = liveLookup.car
    liveLookupTransientError = liveLookup.transientError
  }

  if (!car) {
    if (isLiveId && liveLookupTransientError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
          <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-semibold text-foreground">Live report temporarily unavailable</h1>
            <p className="text-muted-foreground">
              We could not reach the live listing data source right now. Please retry in a moment.
            </p>
          </div>
        </div>
      )
    }
    notFound()
  }

  // Fetch similar cars
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
    allCandidates.push(...live.filter(c => c.id !== car.id))
  }
  const similarCars = findSimilarCars(car, allCandidates, 6)

  // Fetch priced listings + compute market stats in parallel
  const [allPriced, dbComparables] = await Promise.all([
    fetchPricedListingsForModel(car.make),
    getComparablesForModel(car.make, car.model),
  ])

  // Filter by series, expand to family if needed, compute regional stats (shared helper)
  const rates = await getExchangeRates()
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)

  // Resolve HausReport — via mock fixture (?mock=992gt3|sparse) or DB.
  let existingReport: HausReport | null = null
  if (mockName === "992gt3") {
    const fixture = (await import("@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json")).default
    existingReport = fixture as HausReport
  } else if (mockName === "sparse") {
    const fixture = (await import("@/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json")).default
    existingReport = fixture as HausReport
  } else {
    try {
      // Task 31: assemble HausReport from the `listing_reports` row + `listing_signals` rows.
      // Task 29's saveHausReport/saveSignals now populate these columns during /api/analyze.
      const reportRow = await getReportForListing(car.id)
      if (reportRow) {
        const signalRows = await fetchSignalsForListing(car.id)
        existingReport = assembleHausReportFromDB(
          reportRow as unknown as Record<string, unknown>,
          signalRows,
        )
      } else {
        existingReport = null
      }
    } catch {
      existingReport = null
    }
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-border" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading report...</p>
          </div>
        </div>
      }
    >
      {resolvedSearch.v2 === "1" ? (
        <ReportClientV2
          car={car}
          similarCars={similarCars}
          existingReport={existingReport}
          marketStats={marketStats}
          dbComparables={dbComparables}
        />
      ) : (
        <ReportClient
          car={car}
          similarCars={similarCars}
          existingReport={existingReport}
          marketStats={marketStats}
          dbComparables={dbComparables}
        />
      )}
    </Suspense>
  )
}
