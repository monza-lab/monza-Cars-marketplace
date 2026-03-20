import { notFound } from "next/navigation"
import { isSupportedLiveMake } from "@/lib/makeProfiles"
import {
  fetchLiveListingAggregateCounts,
  fetchSoldListingsForMake,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForMake, getComparablesForMake, getSoldAuctionsForMake, getAnalysesForMake } from "@/lib/db/queries"
import { MakePageClient } from "./MakePageClient"

export const dynamic = 'force-dynamic'

interface MakePageProps {
  params: Promise<{ make: string }>
  searchParams: Promise<{ family?: string; gen?: string; variant?: string }>
}

export async function generateMetadata({ params }: MakePageProps) {
  const { make } = await params
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")
  // Capitalize each word for display
  const makeName = decodedMake
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

  return {
    title: `${makeName} Collection | Monza Lab`,
    description: `Explore investment-grade ${makeName} vehicles with live and historical collector-market insights.`,
  }
}

export default async function MakePage({ params, searchParams }: MakePageProps) {
  const { make } = await params
  const { family: initialFamily, gen: initialGen, variant: initialVariant } = await searchParams
  const decodedMake = decodeURIComponent(make).replace(/-/g, " ")

  if (!isSupportedLiveMake(decodedMake)) {
    notFound()
  }

  // Capitalize for display / downstream queries
  const makeName = decodedMake
    .split(" ")
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")

  // Fetch aggregate counts + DB metadata in parallel
  const [liveCounts, dbMarketData, dbComparables, dbAnalyses, supabaseSoldHistory] = await Promise.all([
    fetchLiveListingAggregateCounts({ make: makeName }),
    getMarketDataForMake(makeName),
    getComparablesForMake(makeName),
    getAnalysesForMake(makeName),
    fetchSoldListingsForMake(makeName),
  ])

  const dbSoldHistory = supabaseSoldHistory.length > 0
    ? supabaseSoldHistory
    : await getSoldAuctionsForMake(makeName)

  return (
    <MakePageClient
      make={makeName}
      liveRegionTotals={liveCounts.regionTotalsByLocation}
      liveNowCount={liveCounts.liveNow}
      dbMarketData={dbMarketData}
      dbComparables={dbComparables}
      dbSoldHistory={dbSoldHistory}
      dbAnalyses={dbAnalyses}
      initialFamily={initialFamily}
      initialGen={initialGen}
      initialVariant={initialVariant}
    />
  )
}
