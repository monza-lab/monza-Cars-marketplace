import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchLiveListingByIdWithStatus,
  fetchLiveListingsAsCollectorCars,
  fetchSoldListingsForMake,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForModel, getMarketDataForMake, getComparablesForModel, getAnalysisForCar, getSoldAuctionsForMake, getAnalysesForMake } from "@/lib/db/queries"
import { ReportClient } from "./ReportClient"
import { findSimilarCars } from "@/lib/similarCars"

interface ReportPageProps {
  params: Promise<{ make: string; id: string }>
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params

  let car = CURATED_CARS.find(c => c.id === id) ?? null

  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) {
    return { title: "Not Found | Monza Lab" }
  }

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

export default async function ReportPage({ params }: ReportPageProps) {
  const { id } = await params
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

  // Find similar cars using professional multi-criteria scoring
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
    allCandidates.push(...live.filter(c => c.id !== car.id))
  }
  const similarCars = findSimilarCars(car, allCandidates, 6)

  const shouldQueryHistoricalData = !car.id.startsWith("live-")

  // Use Supabase-first for live routes and only hit historical tables when needed.
  const [dbMarketData, dbMarketDataBrand, dbComparables, dbAnalysis, dbAnalyses, supabaseSoldHistory] = await Promise.all([
    shouldQueryHistoricalData ? getMarketDataForModel(car.make, car.model) : Promise.resolve(null),
    shouldQueryHistoricalData ? getMarketDataForMake(car.make) : Promise.resolve([]),
    shouldQueryHistoricalData ? getComparablesForModel(car.make, car.model) : Promise.resolve([]),
    shouldQueryHistoricalData ? getAnalysisForCar(car.make, car.model, car.year) : Promise.resolve(null),
    shouldQueryHistoricalData ? getAnalysesForMake(car.make) : Promise.resolve([]),
    fetchSoldListingsForMake(car.make),
  ])

  const dbSoldHistory = supabaseSoldHistory.length > 0
    ? supabaseSoldHistory
    : await getSoldAuctionsForMake(car.make)

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
      <ReportClient
        car={car}
        similarCars={similarCars}
        dbMarketData={dbMarketData}
        dbMarketDataBrand={dbMarketDataBrand}
        dbComparables={dbComparables}
        dbAnalysis={dbAnalysis}
        dbSoldHistory={dbSoldHistory}
        dbAnalyses={dbAnalyses}
      />
    </Suspense>
  )
}
