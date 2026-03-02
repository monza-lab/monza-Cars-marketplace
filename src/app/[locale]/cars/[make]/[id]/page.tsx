import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchLiveListingByIdWithStatus,
  fetchLiveListingsAsCollectorCars,
  fetchSoldListingsForMake,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForModel, getComparablesForModel, getAnalysisForCar, getSoldAuctionsForMake } from "@/lib/db/queries"
import { CarDetailClient } from "./CarDetailClient"
import { stripHtml } from "@/lib/stripHtml"
import { findSimilarCars } from "@/lib/similarCars"

interface CarDetailPageProps {
  params: Promise<{ make: string; id: string }>
}

export async function generateMetadata({ params }: CarDetailPageProps) {
  const { id } = await params

  let car = CURATED_CARS.find(c => c.id === id && c.make !== "Ferrari") ?? null

  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) {
    return { title: "Not Found | Monza Lab" }
  }

  return {
    title: `${car.title} | Monza Lab`,
    description: `${stripHtml(car.thesis).slice(0, 160)}...`,
    openGraph: {
      title: `${car.title} | Monza Lab`,
      description: stripHtml(car.thesis),
      images: [{ url: car.image }],
    },
  }
}

export async function generateStaticParams() {
  return CURATED_CARS.filter(c => c.make !== "Ferrari").map(car => ({
    make: car.make.toLowerCase().replace(/\s+/g, "-"),
    id: car.id,
  }))
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
  const { id } = await params
  const isLiveId = id.startsWith("live-")

  let car = CURATED_CARS.find(c => c.id === id && c.make !== "Ferrari") ?? null
  let liveLookupTransientError = false

  if (!car && isLiveId) {
    const liveLookup = await fetchLiveListingByIdWithStatus(id)
    car = liveLookup.car
    liveLookupTransientError = liveLookup.transientError
  }

  if (!car) {
    if (isLiveId && liveLookupTransientError) {
      return (
        <div className="min-h-screen bg-black flex items-center justify-center px-6 text-center">
          <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-semibold text-white">Live listing temporarily unavailable</h1>
            <p className="text-zinc-400">
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
    const live = await fetchLiveListingsAsCollectorCars({ limit: 40, includePriceHistory: false })
    allCandidates.push(...live.filter(c => c.id !== car.id))
  }
  const similarCars = findSimilarCars(car, allCandidates, 4)

  const shouldQueryPrisma = !car.id.startsWith("live-")

  // Fetch Supabase sold history first; fallback to Prisma only when empty.
  const [dbMarketData, dbComparables, dbAnalysis, supabaseSoldHistory] = await Promise.all([
    shouldQueryPrisma ? getMarketDataForModel(car.make, car.model) : Promise.resolve(null),
    shouldQueryPrisma ? getComparablesForModel(car.make, car.model) : Promise.resolve([]),
    shouldQueryPrisma ? getAnalysisForCar(car.make, car.model, car.year) : Promise.resolve(null),
    fetchSoldListingsForMake(car.make),
  ])

  const soldHistory = supabaseSoldHistory.length > 0
    ? supabaseSoldHistory
    : await getSoldAuctionsForMake(car.make)

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-black flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-zinc-800" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-zinc-500">Loading...</p>
          </div>
        </div>
      }
    >
      <CarDetailClient
        car={car}
        similarCars={similarCars}
        dbMarketData={dbMarketData}
        dbComparables={dbComparables}
        dbAnalysis={dbAnalysis}
        dbSoldHistory={soldHistory}
      />
    </Suspense>
  )
}
