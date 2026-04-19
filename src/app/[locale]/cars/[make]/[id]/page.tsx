import { notFound } from "next/navigation"
import { Suspense } from "react"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchLiveListingByIdWithStatus,
  fetchLiveListingsAsCollectorCars,
  fetchSoldListingsForMake,
  enrichFairValues,
} from "@/lib/supabaseLiveListings"
import { getMarketDataForModel, getComparablesForModel, getAnalysisForCar, getSoldAuctionsForMake } from "@/lib/db/queries"
import { CarDetailClient } from "./CarDetailClient"
import { stripHtml } from "@/lib/stripHtml"
import { findSimilarCars } from "@/lib/similarCars"
import { VehicleJsonLd, BreadcrumbJsonLd } from "@/components/seo/JsonLd"
import { buildCarDetailMetadata } from "@/lib/seo/carDetailMetadata"
import type { HausReport } from "@/lib/fairValue/types"

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://monzalab.com"

interface CarDetailPageProps {
  params: Promise<{ make: string; id: string; locale: string }>
}

export async function generateMetadata({ params }: CarDetailPageProps) {
  const { id, make, locale } = await params

  let car = CURATED_CARS.find(c => c.id === id && c.make !== "Ferrari") ?? null

  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  return buildCarDetailMetadata({
    locale: locale as "en" | "es" | "de" | "ja",
    make,
    id,
    car,
  })
}

export async function generateStaticParams() {
  return CURATED_CARS.filter(c => c.make !== "Ferrari").map(car => ({
    make: car.make.toLowerCase().replace(/\s+/g, "-"),
    id: car.id,
  }))
}

export default async function CarDetailPage({ params }: CarDetailPageProps) {
  const { id, make, locale } = await params
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

  // Load same-make listings for similar cars + real regional fair values
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    const live = await fetchLiveListingsAsCollectorCars({
      limit: 200,
      make: car.make,
      includePriceHistory: false,
      status: "all",
    })
    allCandidates.push(...live.filter(c => c.id !== car.id))

    // Compute real regional fair values from same-model listings
    const sameModelCars = live.filter(c => c.model === car.model)
    if (sameModelCars.length > 0) {
      const enriched = await enrichFairValues([car, ...sameModelCars])
      car.fairValueByRegion = enriched[0].fairValueByRegion
    }
  }
  const similarCars = findSimilarCars(car, allCandidates, 4)

  const shouldQueryHistoricalData = !car.id.startsWith("live-")

  // Fetch Supabase sold history first; fallback to historical tables only when empty.
  const [dbMarketData, dbComparables, dbAnalysis, supabaseSoldHistory] = await Promise.all([
    shouldQueryHistoricalData ? getMarketDataForModel(car.make, car.model) : Promise.resolve(null),
    shouldQueryHistoricalData ? getComparablesForModel(car.make, car.model) : Promise.resolve([]),
    shouldQueryHistoricalData ? getAnalysisForCar(car.make, car.model, car.year) : Promise.resolve(null),
    fetchSoldListingsForMake(car.make),
  ])

  const soldHistory = supabaseSoldHistory.length > 0
    ? supabaseSoldHistory
    : await getSoldAuctionsForMake(car.make)

  // Haus Report: load existing report (if any) + user-paid status.
  let existingReport: HausReport | null = null
  let userAlreadyPaid = false

  try {
    const { getReportForListing } = await import("@/lib/reports/queries")
    if (typeof getReportForListing === "function") {
      existingReport = (await getReportForListing(id)) as unknown as HausReport | null
    }
  } catch {
    // helper not present yet — leave null
  }

  // TODO: once a user-level paid check is wired in Task 31, replace this stub
  // with a real check against user_reports. For now, default to false.

  const carUrl = `${BASE_URL}/${locale}/cars/${make}/${id}`
  const mileageUnitCode = car.mileageUnit === "km" ? "KMT" : "SMI"

  return (
    <>
      <VehicleJsonLd
        name={car.title}
        description={stripHtml(car.thesis).slice(0, 300)}
        url={carUrl}
        brand={car.make}
        model={car.model ?? ""}
        year={car.year}
        mileage={car.mileage ? `${car.mileage} ${mileageUnitCode}` : undefined}
        price={typeof car.price === "number" ? car.price : undefined}
        currency={car.originalCurrency ?? "USD"}
        image={car.image}
      />
      <BreadcrumbJsonLd
        items={[
          { name: "Home", url: `${BASE_URL}/${locale}` },
          { name: car.make, url: `${BASE_URL}/${locale}/cars/${make}` },
          { name: car.title, url: carUrl },
        ]}
      />
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
          existingReport={existingReport}
          userAlreadyPaid={userAlreadyPaid}
        />
      </Suspense>
    </>
  )
}
