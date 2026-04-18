import { notFound } from "next/navigation"
import { isSupportedLiveMake } from "@/lib/makeProfiles"
import {
  fetchLiveListingAggregateCounts,
  fetchSoldListingsForMake,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForMake, getComparablesForMake, getSoldAuctionsForMake, getAnalysesForMake } from "@/lib/db/queries"
import { MakePageClient } from "./MakePageClient"
import { BreadcrumbJsonLd, CollectionPageJsonLd } from "@/components/seo/JsonLd"
import { buildMakePageMetadata } from "@/lib/seo/makePageMetadata"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"

export const dynamic = 'force-dynamic'

interface MakePageProps {
  params: Promise<{ make: string; locale: string }>
  searchParams: Promise<{ family?: string; gen?: string; variant?: string; series?: string }>
}

export async function generateMetadata({ params, searchParams }: MakePageProps) {
  const { make, locale } = await params
  const { series } = await searchParams
  return buildMakePageMetadata({
    locale: locale as "en" | "es" | "de" | "ja",
    make,
    series,
  })
}

export default async function MakePage({ params, searchParams }: MakePageProps) {
  const { make, locale } = await params
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

  const totalItems =
    (liveCounts.liveNow ?? 0) +
    (Array.isArray(dbSoldHistory) ? dbSoldHistory.length : 0)

  const pageUrl = `${BASE_URL}/${locale}/cars/${make}`

  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${locale}` },
          { name: makeName, url: pageUrl },
        ]}
      />
      <CollectionPageJsonLd
        name={`${makeName} Collection`}
        description={`Investment-grade ${makeName} vehicles with live and historical collector-market insights.`}
        url={pageUrl}
        numberOfItems={totalItems}
        inLanguage={locale}
      />
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
    </>
  )
}
