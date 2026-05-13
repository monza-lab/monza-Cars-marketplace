import { notFound } from "next/navigation"
import { Suspense } from "react"
import { setRequestLocale } from "next-intl/server"
import { CURATED_CARS } from "@/lib/curatedCars"
import {
  fetchLiveListingById,
  fetchLiveListingByIdWithStatus,
  fetchLiveListingsAsCollectorCars,
  fetchPricedListingsForModel,
} from "@/lib/supabaseLiveListings"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { getExchangeRates } from "@/lib/exchangeRates"
import {
  getReportForListing,
  fetchSignalsForListing,
  assembleHausReportFromDB,
  getReportMetadataV2,
  hasAlreadyGenerated,
  getUserCredits,
} from "@/lib/reports/queries"
import { createClient } from "@/lib/supabase/server"
import { isAdmin } from "@/lib/admin"
import { ReportClient } from "./ReportClient"
import { ReportClientV2 } from "./ReportClientV2"
import { findSimilarCars } from "@/lib/similarCars"
import type { HausReport, MarketIntelD2, ReportTier } from "@/lib/fairValue/types"
import type { HausReportV3 } from "@/lib/reports/types-v3"
import { getComparablesForModel } from "@/lib/db/queries"
import {
  computeArbitrageForCar,
  inferTargetRegion,
} from "@/lib/marketIntel/computeArbitrageForCar"

export const dynamic = "force-dynamic"

interface ReportPageProps {
  params: Promise<{ locale: string; make: string; id: string }>
  searchParams?: Promise<{ mock?: string }>
}

export async function generateMetadata({ params }: ReportPageProps) {
  const { id } = await params

  let car = CURATED_CARS.find(c => c.id === id) ?? null
  if (!car && id.startsWith("live-")) {
    car = await fetchLiveListingById(id)
  }

  if (!car) return { title: "Not Found | MonzaHaus" }

  return {
    title: `Haus Report: ${car.title} | MonzaHaus`,
    description: `Comprehensive investment analysis for ${car.title}. Valuation, risk assessment, ownership economics, and market context.`,
  }
}

export async function generateStaticParams() {
  return CURATED_CARS.map(car => ({
    make: car.make.toLowerCase().replace(/\s+/g, "-"),
    id: car.id,
  }))
}

export default async function ReportPage({ params, searchParams }: ReportPageProps) {
  const { locale, id } = await params
  const resolvedSearch = (await searchParams) ?? {}
  const mockName = resolvedSearch.mock
  setRequestLocale(locale)

  const isLiveId = id.startsWith("live-")

  let car = CURATED_CARS.find(c => c.id === id) ?? null
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
            <h1 className="text-2xl font-semibold text-foreground">Live report temporarily unavailable</h1>
            <p className="text-muted-foreground">
              We could not reach the live listing data source right now. Please retry in a moment.
            </p>
          </div>
        </div>
      )
    }
    notFound()
  }

  // Fetch similar cars
  const allCandidates = CURATED_CARS.filter(c => c.id !== car.id)
  if (car.id.startsWith("live-")) {
    try {
      const live = await fetchLiveListingsAsCollectorCars({ limit: 60, includePriceHistory: false })
      allCandidates.push(...live.filter(c => c.id !== car.id))
    } catch (err) {
      console.warn(
        "[report] fetchLiveListingsAsCollectorCars failed, continuing without live candidates:",
        err instanceof Error ? err.message : err,
      )
    }
  }
  const similarCars = findSimilarCars(car, allCandidates, 6)

  // Fetch priced listings + compute market stats in parallel
  const [allPriced, dbComparables] = await Promise.all([
    fetchPricedListingsForModel(car.make),
    getComparablesForModel(car.make, car.model).catch((err) => {
      console.warn(
        "[report] getComparablesForModel failed, continuing without DB comparables:",
        err instanceof Error ? err.message : err,
      )
      return []
    }),
  ])

  // Filter by series, expand to family if needed, compute regional stats (shared helper)
  const rates = await getExchangeRates().catch((err) => {
    console.warn(
      "[report] getExchangeRates failed, falling back to identity rates:",
      err instanceof Error ? err.message : err,
    )
    return {} as Record<string, number>
  })
  const { marketStats } = computeMarketStatsForCar(car, allPriced, rates)

  // D2 — Cross-border arbitrage (spec §5.7). Resolve landed cost to the
  // target region of the listing so the Arbitrage block ships populated.
  const askingForArbitrage =
    car.soldPriceUsd ??
    car.askingPriceUsd ??
    car.currentBid ??
    car.price ??
    0
  const targetRegion = inferTargetRegion(car.region)
  const d2Precomputed: MarketIntelD2 =
    askingForArbitrage > 0
      ? await computeArbitrageForCar({
          pricedListings: allPriced,
          thisVinPriceUsd: askingForArbitrage,
          targetRegion,
          carYear: car.year,
        }).catch((err) => {
          console.warn(
            "[report] computeArbitrageForCar failed, returning empty D2:",
            err instanceof Error ? err.message : err,
          )
          return { by_region: [], target_region: targetRegion, narrative_insight: null }
        })
      : { by_region: [], target_region: targetRegion, narrative_insight: null }

  // Resolve HausReport — via mock fixture (?mock=992gt3|sparse) or DB.
  let existingReport: HausReport | null = null
  let reportTier: ReportTier | null = null
  let reportHash: string | null = null
  let reportVersion: number | null = null
  if (mockName === "992gt3") {
    const fixture = (await import("@/lib/fairValue/__fixtures__/992-gt3-pts-mock.json")).default
    existingReport = fixture as HausReport
  } else if (mockName === "sparse") {
    const fixture = (await import("@/lib/fairValue/__fixtures__/991-carrera-sparse-mock.json")).default
    existingReport = fixture as HausReport
  } else {
    try {
      // Task 31: assemble HausReport from the `listing_reports` row + `listing_signals` rows.
      // Task 29's saveHausReport/saveSignals now populate these columns during /api/analyze.
      const reportRow = await getReportForListing(car.id)
      if (reportRow) {
        const signalRows = await fetchSignalsForListing(car.id)
        existingReport = assembleHausReportFromDB(
          reportRow as unknown as Record<string, unknown>,
          signalRows,
        )
        // Pull the tier / hash / version the orchestrator persisted so the v2
        // adapter reflects the true tier instead of defaulting to tier_1.
        const meta = await getReportMetadataV2(car.id)
        reportTier = meta.tier
        reportHash = meta.report_hash
        reportVersion = meta.version
      } else {
        existingReport = null
      }
    } catch {
      existingReport = null
    }
  }

  // ─── V3 section fetch ────────────────────────────────────────────────
  let v3Report: HausReportV3 | null = null
  if (mockName === "v3") {
    const fixture = (await import("@/lib/reports/__fixtures__/v3-911-gt3r-rennsport-mock.json")).default
    v3Report = fixture as unknown as HausReportV3
  } else {
    try {
      const { fetchReportSections } = await import("@/lib/reports/reportSections")
      const { assembleV3ReportFromSections } = await import("@/lib/reports/assembleV3Report")
      const sections = await fetchReportSections(car.id, 1)
      if (sections.length > 0) {
        v3Report = assembleV3ReportFromSections(sections, car.id)
      }
    } catch { /* V3 not available */ }
  }

  // ─── User access check ─────────────────────────────────────────────
  // A user has access if: (a) they already paid for this report,
  // (b) they have unlimited_reports, or (c) they are admin.
  // Unauthenticated users never have access.
  // Mock previews (?mock=*) unlock automatically for design QA.
  let userHasAccess = Boolean(mockName)
  if (!userHasAccess) {
    try {
      const supabase = await createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        // getUserCredits looks up by supabase_user_id (Auth UUID) — correct.
        // hasAlreadyGenerated must use the internal DB user ID (user_credits.id),
        // NOT the Auth UUID, because deductCredit writes user_reports.user_id
        // with the internal DB ID.
        const credits = await getUserCredits(user.id)
        const internalUserId = credits?.id
        const alreadyPaid = internalUserId
          ? await hasAlreadyGenerated(internalUserId, car.id)
          : false
        userHasAccess =
          alreadyPaid ||
          Boolean(credits?.unlimited_reports) ||
          isAdmin(user.email)
      }
    } catch {
      // Auth unavailable — leave as false
    }
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-border" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground">Loading report...</p>
          </div>
        </div>
      }
    >
      {/* Layout rule: V2 (full unlocked report with all sections) is only
          shown to users with access. Everyone else — including users who
          have no report yet AND users who have a V3 sitting in DB but
          haven't paid — sees the V1 layout (sidebar TOC + hero + teaser
          sections). This guarantees the same paywall UX across the whole
          funnel. V1 itself never calls the AI; it only renders what we
          already have from the listing scrape. */}
      {userHasAccess && (existingReport || v3Report) ? (
        <ReportClientV2
          car={car}
          similarCars={similarCars}
          existingReport={existingReport}
          marketStats={marketStats}
          dbComparables={dbComparables}
          d2Precomputed={d2Precomputed}
          reportTier={reportTier}
          reportHash={reportHash}
          reportVersion={reportVersion}
          v3Report={v3Report}
          userHasAccess={userHasAccess}
        />
      ) : (
        <ReportClient
          car={car}
          similarCars={similarCars}
          existingReport={existingReport}
          marketStats={marketStats}
          dbComparables={dbComparables}
        />
      )}
    </Suspense>
  )
}
