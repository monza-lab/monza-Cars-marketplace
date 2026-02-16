import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import { fetchLiveListingById, fetchLiveListingsAsCollectorCars, fetchSoldListingsForMake } from "@/lib/supabaseLiveListings"
import { getMarketDataForModel, getMarketDataForMake, getComparablesForModel, getAnalysisForCar, getSoldAuctionsForMake, getAnalysesForMake } from "@/lib/db/queries"
import { ReportClient } from "./ReportClient"

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

  let car = CURATED_CARS.find(c => c.id === id) ?? null

  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) {
    notFound()
  }

  // Find similar cars
  const curatedSimilar = CURATED_CARS.filter(
    c => c.id !== car.id && (c.category === car.category || c.make === car.make)
  ).slice(0, 6)

  let similarCars = curatedSimilar
  if (similarCars.length < 6 && car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
    const liveSimilar = live.filter(
      c => c.id !== car.id && c.make === car.make
    ).slice(0, 6 - similarCars.length)
    similarCars = [...similarCars, ...liveSimilar]
  }

  const shouldQueryPrisma = !car.id.startsWith("live-")

  // Use Supabase-first for live routes and only hit Prisma when needed.
  const [dbMarketData, dbMarketDataBrand, dbComparables, dbAnalysis, dbAnalyses, supabaseSoldHistory] = await Promise.all([
    shouldQueryPrisma ? getMarketDataForModel(car.make, car.model) : Promise.resolve(null),
    shouldQueryPrisma ? getMarketDataForMake(car.make) : Promise.resolve([]),
    shouldQueryPrisma ? getComparablesForModel(car.make, car.model) : Promise.resolve([]),
    shouldQueryPrisma ? getAnalysisForCar(car.make, car.model, car.year) : Promise.resolve(null),
    shouldQueryPrisma ? getAnalysesForMake(car.make) : Promise.resolve([]),
    fetchSoldListingsForMake(car.make),
  ])

  const dbSoldHistory = supabaseSoldHistory.length > 0
    ? supabaseSoldHistory
    : await getSoldAuctionsForMake(car.make)

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0b0b10] flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-zinc-800" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-[#F8B4D9] border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-zinc-500">Loading report...</p>
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
