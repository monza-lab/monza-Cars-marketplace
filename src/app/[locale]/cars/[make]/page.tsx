import { notFound } from "next/navigation"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingAggregateCounts,
  fetchLiveListingsAsCollectorCars,
  fetchSoldListingsForMake,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForMake, getComparablesForMake, getSoldAuctionsForMake, getAnalysesForMake } from "@/lib/db/queries"
import { MakePageClient } from "./MakePageClient"

const MAKE_PAGE_LIVE_LIMIT = 600

interface MakePageProps {
  params: Promise<{ make: string }>
}

export async function generateMetadata({ params }: MakePageProps) {
  const { make } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")
  const curated = CURATED_CARS.find(
    car => car.make !== "Ferrari" && car.make.toLowerCase() === decodedMake.toLowerCase()
  )
  const makeName = curated?.make ?? decodedMake

  return {
    title: `${makeName} Collection | Monza Lab`,
    description: `Explore investment-grade ${makeName} vehicles with live and historical collector-market insights.`,
  }
}

export async function generateStaticParams() {
  const makes = Array.from(new Set(CURATED_CARS.filter(c => c.make !== "Ferrari").map(car => car.make)))
  return makes.map(make => ({
    make: make.toLowerCase().replace(/\s+/g, "-"),
  }))
}

export default async function MakePage({ params }: MakePageProps) {
  const { make } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")

  const curated = CURATED_CARS.filter(
    car => car.make !== "Ferrari" && car.make.toLowerCase() === decodedMake.toLowerCase()
  )
  const live = await fetchLiveListingsAsCollectorCars({
    limit: MAKE_PAGE_LIVE_LIMIT,
    includePriceHistory: false,
    make: decodedMake,
    status: "all",
    includeAllSources: true,
  })
  const liveMake = live.filter(car => car.make.toLowerCase() === decodedMake.toLowerCase())
  const cars = [...curated, ...liveMake]

  if (cars.length === 0) {
    notFound()
  }

  const makeName = cars[0].make

  const shouldQueryPrisma = curated.length > 0

  // Fetch Supabase sold history first; only touch Prisma fallback if needed.
  const [dbMarketData, dbComparables, dbAnalyses, supabaseSoldHistory] = await Promise.all([
    shouldQueryPrisma ? getMarketDataForMake(makeName) : Promise.resolve([]),
    shouldQueryPrisma ? getComparablesForMake(makeName) : Promise.resolve([]),
    shouldQueryPrisma ? getAnalysesForMake(makeName) : Promise.resolve([]),
    fetchSoldListingsForMake(makeName),
  ])

  const dbSoldHistory = supabaseSoldHistory.length > 0
    ? supabaseSoldHistory
    : await getSoldAuctionsForMake(makeName)

  const liveCounts = await fetchLiveListingAggregateCounts({ make: makeName })

  return (
    <MakePageClient
      make={makeName}
      cars={cars}
      liveRegionTotals={liveCounts.regionTotalsByLocation}
      liveNowCount={liveCounts.liveNow}
      dbMarketData={dbMarketData}
      dbComparables={dbComparables}
      dbSoldHistory={dbSoldHistory}
      dbAnalyses={dbAnalyses}
    />
  )
}
