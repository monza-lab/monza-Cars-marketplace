import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import { fetchLiveListingById, fetchLiveListingsAsCollectorCars, fetchSoldListingsForMake } from "@/lib/supabaseLiveListings"
import { getMarketDataForModel, getComparablesForModel, getAnalysisForCar, getSoldAuctionsForMake } from "@/lib/db/queries"
import { CarDetailClient } from "./CarDetailClient"

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
    description: `${car.thesis.slice(0, 160)}...`,
    openGraph: {
      title: `${car.title} | Monza Lab`,
      description: car.thesis,
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

  let car = CURATED_CARS.find(c => c.id === id && c.make !== "Ferrari") ?? null

  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) {
    notFound()
  }

  // Find similar cars
  const curatedSimilar = CURATED_CARS.filter(
    c => c.make !== "Ferrari" && c.id !== car.id && (c.category === car.category || c.make === car.make)
  ).slice(0, 4)

  let similarCars = curatedSimilar
  if (similarCars.length < 4 && car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({ limit: 40, includePriceHistory: false })
    const liveSimilar = live.filter(
      c => c.id !== car.id && c.make === car.make
    ).slice(0, 4 - similarCars.length)
    similarCars = [...similarCars, ...liveSimilar]
  }

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
