import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import { fetchLiveListingById, fetchLiveListingsAsCollectorCars } from "@/lib/supabaseLiveListings"
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
    const live = await fetchLiveListingsAsCollectorCars()
    const liveSimilar = live.filter(
      c => c.id !== car.id && c.make === car.make
    ).slice(0, 4 - similarCars.length)
    similarCars = [...similarCars, ...liveSimilar]
  }

  // Fetch real data from Prisma in parallel
  const [dbMarketData, dbComparables, dbAnalysis, dbSoldHistory] = await Promise.all([
    getMarketDataForModel(car.make, car.model),
    getComparablesForModel(car.make, car.model),
    getAnalysisForCar(car.make, car.model, car.year),
    getSoldAuctionsForMake(car.make),
  ])

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
        dbSoldHistory={dbSoldHistory}
      />
    </Suspense>
  )
}
