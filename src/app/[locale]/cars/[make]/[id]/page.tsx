import { Suspense } from "react"
import { getTranslations } from "next-intl/server"
import { Link } from "@/i18n/navigation"
import { ArrowLeft } from "lucide-react"
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
import { getSiteUrl } from "@/lib/seo/siteUrl"
import {
  calculateLandedCost,
  computeTeaserAmount,
  localeToDestination,
  sourceToOriginCountry,
} from "@/lib/landedCost"
import type { Country, Currency } from "@/lib/landedCost"
import { createClient } from "@/lib/supabase/server"
import { hasAlreadyGenerated } from "@/lib/reports/queries"

const BASE_URL = getSiteUrl()

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
        <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
          <div className="max-w-xl space-y-4">
            <h1 className="text-2xl font-semibold text-white">Live listing temporarily unavailable</h1>
            <p className="text-muted-foreground">
              We could not reach the live listing data source right now. Please retry in a moment.
            </p>
          </div>
        </div>
      )
    }
    const t = await getTranslations({ locale, namespace: "carDetail" })
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-6 text-center">
        <div className="max-w-xl space-y-5">
          <h1 className="text-2xl font-semibold text-foreground">{t("unavailableTitle")}</h1>
          <p className="text-muted-foreground">{t("unavailableDescription")}</p>
          <Link
            href={`/cars/${make}`}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground/[0.04] border border-border text-foreground/90 text-[13px] font-medium hover:bg-foreground/[0.08] transition-colors"
          >
            <ArrowLeft className="size-4" />
            {t("unavailableCta")}
          </Link>
        </div>
      </div>
    )
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

  // Always query historical tables regardless of listing id shape. If the tables
  // are empty the UI will render honest empty states instead of hardcoded fakes.
  const [dbMarketData, dbComparables, dbAnalysis, supabaseSoldHistory] = await Promise.all([
    getMarketDataForModel(car.make, car.model),
    getComparablesForModel(car.make, car.model),
    getAnalysisForCar(car.make, car.model, car.year),
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

  // Check if the current user has already paid for this report
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (user && existingReport) {
      userAlreadyPaid = await hasAlreadyGenerated(user.id, id)
    }
  } catch {
    // Auth unavailable — leave as false
  }

  // Landed-cost teaser — destination from locale, origin from listing platform.
  // Null when domestic, unsupported origin, or missing year/price.
  let landedCostTeaser:
    | { amount: number; currency: Currency; destination: Country }
    | null = null
  try {
    const destination = localeToDestination(locale)
    const origin = sourceToOriginCountry(car.platform)
    if (origin && car.price && car.price > 0 && car.year) {
      const breakdown = await calculateLandedCost({
        car: { priceUsd: car.price, year: car.year },
        origin,
        destination,
      })
      if (breakdown) {
        landedCostTeaser = {
          amount: computeTeaserAmount(breakdown),
          currency: breakdown.currency,
          destination,
        }
      }
    }
  } catch (err) {
    console.error("[detail] landedCostTeaser failed", err)
    landedCostTeaser = null
  }

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
          <div className="min-h-screen bg-background flex items-center justify-center">
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <div className="h-10 w-10 rounded-full border-2 border-border" />
                <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary/40 border-t-transparent animate-spin" />
              </div>
              <p className="text-sm text-muted-foreground/80">Loading...</p>
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
          landedCostTeaser={landedCostTeaser}
        />
      </Suspense>
    </>
  )
}
