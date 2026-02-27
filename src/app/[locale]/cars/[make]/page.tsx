import { notFound } from "next/navigation"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingAggregateCounts,
  fetchLiveListingsAsCollectorCars,
  fetchSoldListingsForMake,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForMake, getComparablesForMake, getSoldAuctionsForMake, getAnalysesForMake } from "@/lib/db/queries"
import { MakePageClient } from "./MakePageClient"

const MAKE_PAGE_GLOBAL_LIVE_LIMIT = 120
const MAKE_PAGE_SOURCE_COUNT = 6

function derivePerSourceLimit(globalLimit: number, sourceCount = MAKE_PAGE_SOURCE_COUNT): number {
  const safeGlobalLimit = Number.isFinite(globalLimit) ? Math.max(1, Math.floor(globalLimit)) : 24
  const safeSourceCount = Number.isFinite(sourceCount) ? Math.max(1, Math.floor(sourceCount)) : MAKE_PAGE_SOURCE_COUNT
  return Math.max(1, Math.ceil(safeGlobalLimit / safeSourceCount))
}

interface MakePageProps {
  params: Promise<{ make: string }>
  searchParams: Promise<{ family?: string; gen?: string }>
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

export default async function MakePage({ params, searchParams }: MakePageProps) {
  const { make } = await params
  const { family: initialFamily, gen: initialGen } = await searchParams
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")

  const curated = CURATED_CARS.filter(
    car => car.make !== "Ferrari" && car.make.toLowerCase() === decodedMake.toLowerCase()
  )
  const live = await fetchLiveListingsAsCollectorCars({
    // supabaseLiveListings treats `limit` as per-source budget when includeAllSources=true.
    // Keep a global cap here to avoid oversized RSC payloads in production.
    limit: derivePerSourceLimit(MAKE_PAGE_GLOBAL_LIVE_LIMIT),
    includePriceHistory: false,
    make: decodedMake,
    status: "active",
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
      initialFamily={initialFamily}
      initialGen={initialGen}
    />
  )
}
