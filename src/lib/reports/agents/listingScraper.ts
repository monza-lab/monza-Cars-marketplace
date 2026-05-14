import type { CollectorCar } from "@/lib/curatedCars"
import { getListingType } from "@/lib/listingMode"
import { resolveCanonicalSource } from "@/lib/supabaseLiveListings"
import { recordScraperRun } from "@/features/scrapers/common/monitoring"
import type { ScraperRunRecord } from "@/features/scrapers/common/monitoring"
import type { PipelineContext } from "../pipeline"
import type { ScrapedListingFull } from "../types-v3"

const ADAPTER_TIMEOUT_MS = 15_000

export type ListingAnalysisSource = "BaT" | "CarsAndBids" | "CollectingCars" | "AutoTrader" | "AutoScout24" | "Elferspot" | "BeForward" | "ClassicCom"

export type ListingAnalysisPatch = Partial<ScrapedListingFull> & {
  scrapeSuccessful: boolean
  scrapePartial: boolean
  analysisStrategy: NonNullable<ScrapedListingFull["analysisStrategy"]>
}

export type ListingAnalysisAdapter = (
  car: CollectorCar,
  fallback: ScrapedListingFull,
) => Promise<ListingAnalysisPatch>

export type ListingAnalysisMonitor = (record: ScraperRunRecord) => Promise<void>

export interface ListingAnalysisEnvironment {
  isVercel: boolean
  env: Record<string, string | undefined>
  hasScrapling?: boolean | (() => boolean)
}

export interface ListingScraperOptions {
  adapters?: Partial<Record<ListingAnalysisSource, ListingAnalysisAdapter>>
  monitor?: ListingAnalysisMonitor
  now?: () => Date
  runId?: () => string
  environment?: ListingAnalysisEnvironment
}

export interface ListingAnalysisPolicy {
  attempt: boolean
  customerSafeReason?: NonNullable<ScrapedListingFull["fallbackReason"]>
}

function getDefaultEnvironment(): ListingAnalysisEnvironment {
  const env = process.env
  return {
    isVercel: env.VERCEL === "1" || env.VERCEL === "true",
    env,
    hasScrapling: () => {
      if (env.VERCEL === "1" || env.VERCEL === "true") return false
      return env.REPORT_ANALYSIS_SCRAPLING_AVAILABLE === "1" || Boolean(env.SCRAPLING_PYTHON)
    },
  }
}

function createRunId(): string {
  const cryptoApi = globalThis.crypto
  return cryptoApi && "randomUUID" in cryptoApi
    ? cryptoApi.randomUUID()
    : `report-listing-${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function isKnownSource(value: string | null): value is ListingAnalysisSource {
  return value === "BaT"
    || value === "CarsAndBids"
    || value === "CollectingCars"
    || value === "AutoTrader"
    || value === "AutoScout24"
    || value === "Elferspot"
    || value === "BeForward"
    || value === "ClassicCom"
}

function getHasScrapling(environment: ListingAnalysisEnvironment): boolean {
  if (typeof environment.hasScrapling === "function") return environment.hasScrapling()
  return environment.hasScrapling === true
}

function hasFlag(environment: ListingAnalysisEnvironment, flag: string): boolean {
  return environment.env[flag] === "1"
}

export function selectListingAnalysisSource(car: CollectorCar): ListingAnalysisSource | null {
  const canonical = resolveCanonicalSource(null, car.platform) ?? resolveCanonicalSource(car.platform, null)
  if (isKnownSource(canonical)) return canonical

  const url = car.sourceUrl ?? ""
  if (/bringatrailer\.com/i.test(url)) return "BaT"
  if (/carsandbids\.com/i.test(url)) return "CarsAndBids"
  if (/collectingcars\.com/i.test(url)) return "CollectingCars"
  if (/autotrader\.co\.uk/i.test(url)) return "AutoTrader"
  if (/autoscout24\./i.test(url)) return "AutoScout24"
  if (/elferspot\.com/i.test(url)) return "Elferspot"
  if (/beforward\.jp/i.test(url)) return "BeForward"
  if (/classic\.com/i.test(url)) return "ClassicCom"
  return null
}

export function shouldAttemptListingAnalysis(
  source: ListingAnalysisSource,
  environment: ListingAnalysisEnvironment = getDefaultEnvironment(),
): ListingAnalysisPolicy {
  if (source === "AutoTrader") {
    return environment.isVercel && !hasFlag(environment, "REPORT_ANALYSIS_AT_DIRECT")
      ? { attempt: false, customerSafeReason: "verified_database_data" }
      : { attempt: true }
  }

  if (source === "AutoScout24") {
    const explicitlyEnabled = hasFlag(environment, "REPORT_ANALYSIS_AS24_DIRECT")
    if (environment.isVercel && !explicitlyEnabled) {
      return { attempt: false, customerSafeReason: "verified_database_data" }
    }
    return explicitlyEnabled || getHasScrapling(environment)
      ? { attempt: true }
      : { attempt: false, customerSafeReason: "verified_database_data" }
  }

  if (source === "ClassicCom") {
    const explicitlyEnabled = hasFlag(environment, "REPORT_ANALYSIS_CLASSIC_DIRECT")
    if (environment.isVercel && !explicitlyEnabled) {
      return { attempt: false, customerSafeReason: "verified_database_data" }
    }
    return explicitlyEnabled || getHasScrapling(environment)
      ? { attempt: true }
      : { attempt: false, customerSafeReason: "verified_database_data" }
  }

  return { attempt: true }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const value of values) {
    const clean = value?.trim()
    if (!clean || seen.has(clean)) continue
    seen.add(clean)
    out.push(clean)
  }
  return out
}

function cleanText(value: string | null | undefined): string | null {
  const clean = value?.trim()
  return clean && clean !== "-" ? clean : null
}

function fieldCounts(data: Pick<ScrapedListingFull, "photoUrls" | "equipmentList" | "modifications" | "descriptionFull">) {
  return {
    photos: data.photoUrls.length, equipment: data.equipmentList.length,
    modifications: data.modifications.length, descriptionCharacters: data.descriptionFull.length,
  }
}

export function buildFallbackFromCar(car: CollectorCar): ScrapedListingFull {
  const listingType = getListingType(car.platform)
  const images = uniqueStrings(car.images ?? [])
  const description = car.description ?? car.history ?? ""

  const fallback: ScrapedListingFull = {
    title: car.title ?? `${car.year ?? ""} ${car.make ?? ""} ${car.model ?? ""}`.trim(),
    year: car.year ?? null,
    make: car.make ?? "Unknown",
    model: car.model ?? "",
    trim: car.trim ?? null,
    vin: car.vin ?? null,
    engine: cleanText(car.engine),
    transmission: cleanText(car.transmission),
    drivetrain: null,
    horsepower: null,
    torque: null,
    weight: null,
    bodyStyle: null,
    seats: null,
    mileage: car.mileage ?? null,
    mileageUnit: (car.mileageUnit as "mi" | "km" | undefined) ?? "mi",
    exteriorColor: car.exteriorColor ?? null,
    interiorColor: car.interiorColor ?? null,
    location: car.location ?? null,
    descriptionFull: description,
    sellerNotes: car.sellerNotes ?? null,
    auctionComments: null,
    lotEssay: null,
    equipmentList: [],
    modifications: [],
    photoUrls: images,
    photoCount: images.length,
    currentBid: listingType === "auction" ? (car.currentBid ?? car.price ?? null) : null,
    bidCount: car.bidCount ?? null,
    reserveStatus: "unknown",
    auctionEndTime: car.endTime ? new Date(car.endTime).toISOString() : null,
    askingPrice: listingType === "classified" ? (car.askingPriceUsd ?? car.price ?? null) : null,
    daysOnMarket: null,
    priceDrops: null,
    sellerName: null,
    sellerType: null,
    sellerLocation: null,
    scrapedAt: new Date().toISOString(),
    scrapeSuccessful: false,
    scrapePartial: true,
    sourceUrl: car.sourceUrl ?? "",
    platform: car.platform ?? "UNKNOWN",
    analysisStrategy: "database_fallback",
    analysisSource: selectListingAnalysisSource(car),
  }

  return {
    ...fallback,
    analysisFieldCounts: fieldCounts(fallback),
  }
}

function nonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0
}

function mergeNullable<T>(fallback: T | null, patch: T | null | undefined): T | null {
  return patch == null ? fallback : patch
}

function mergeStringList(fallback: string[], patch: string[] | undefined): string[] {
  const cleaned = uniqueStrings(patch ?? [])
  return cleaned.length > 0 ? cleaned : fallback
}

function normalizeMileageUnit(value: string | null | undefined): "mi" | "km" | undefined {
  if (value === "km") return "km"
  return value ? "mi" : undefined
}

export function mergeAnalysisOntoFallback(
  fallback: ScrapedListingFull,
  patch: ListingAnalysisPatch,
): ScrapedListingFull {
  const photoUrls = mergeStringList(fallback.photoUrls, patch.photoUrls)
  const equipmentList = mergeStringList(fallback.equipmentList, patch.equipmentList)
  const modifications = mergeStringList(fallback.modifications, patch.modifications)

  const merged: ScrapedListingFull = {
    ...fallback,
    title: nonEmptyString(patch.title) ? patch.title.trim() : fallback.title,
    make: nonEmptyString(patch.make) ? patch.make.trim() : fallback.make,
    model: nonEmptyString(patch.model) ? patch.model.trim() : fallback.model,
    descriptionFull: nonEmptyString(patch.descriptionFull)
      ? patch.descriptionFull.trim()
      : fallback.descriptionFull,
    trim: mergeNullable(fallback.trim, patch.trim),
    vin: mergeNullable(fallback.vin, patch.vin),
    engine: mergeNullable(fallback.engine, patch.engine),
    transmission: mergeNullable(fallback.transmission, patch.transmission),
    drivetrain: mergeNullable(fallback.drivetrain, patch.drivetrain),
    horsepower: mergeNullable(fallback.horsepower, patch.horsepower),
    torque: mergeNullable(fallback.torque, patch.torque),
    weight: mergeNullable(fallback.weight, patch.weight),
    bodyStyle: mergeNullable(fallback.bodyStyle, patch.bodyStyle),
    seats: mergeNullable(fallback.seats, patch.seats),
    mileage: mergeNullable(fallback.mileage, patch.mileage),
    exteriorColor: mergeNullable(fallback.exteriorColor, patch.exteriorColor),
    interiorColor: mergeNullable(fallback.interiorColor, patch.interiorColor),
    location: mergeNullable(fallback.location, patch.location),
    sellerNotes: mergeNullable(fallback.sellerNotes, patch.sellerNotes),
    auctionComments: mergeNullable(fallback.auctionComments, patch.auctionComments),
    lotEssay: mergeNullable(fallback.lotEssay, patch.lotEssay),
    currentBid: mergeNullable(fallback.currentBid, patch.currentBid),
    bidCount: mergeNullable(fallback.bidCount, patch.bidCount),
    askingPrice: mergeNullable(fallback.askingPrice, patch.askingPrice),
    daysOnMarket: mergeNullable(fallback.daysOnMarket, patch.daysOnMarket),
    priceDrops: mergeNullable(fallback.priceDrops, patch.priceDrops),
    sellerName: mergeNullable(fallback.sellerName, patch.sellerName),
    sellerType: mergeNullable(fallback.sellerType, patch.sellerType),
    sellerLocation: mergeNullable(fallback.sellerLocation, patch.sellerLocation),
    mileageUnit: normalizeMileageUnit(patch.mileageUnit) ?? fallback.mileageUnit,
    reserveStatus: patch.reserveStatus === "met"
      || patch.reserveStatus === "not_met"
      || patch.reserveStatus === "no_reserve"
      || patch.reserveStatus === "unknown"
      ? patch.reserveStatus
      : fallback.reserveStatus,
    auctionEndTime: mergeNullable(fallback.auctionEndTime, patch.auctionEndTime),
    scrapedAt: fallback.scrapedAt,
    sourceUrl: fallback.sourceUrl,
    platform: fallback.platform,
    photoUrls,
    equipmentList,
    modifications,
    photoCount: photoUrls.length,
    scrapeSuccessful: patch.scrapeSuccessful,
    scrapePartial: patch.scrapePartial,
    analysisStrategy: patch.analysisStrategy,
    analysisSource: patch.analysisSource ?? fallback.analysisSource,
    fallbackReason: patch.fallbackReason,
  }

  return {
    ...merged,
    analysisFieldCounts: fieldCounts(merged),
  }
}

export function buildListingAnalysisNote(data: ScrapedListingFull): string {
  if (!data.scrapeSuccessful) return "Listing analysis used verified database data"

  const parts = [
    `${data.photoCount} photos`,
    `${data.equipmentList.length} equipment items`,
  ]
  if (data.descriptionFull.trim()) parts.push("full description")
  return `Listing analysis complete: ${parts.join(", ")}`
}

function hasAnalyzedSourceData(patch: ListingAnalysisPatch): boolean {
  return Boolean(
    patch.photoUrls?.length
      || patch.equipmentList?.length
      || patch.modifications?.length
      || patch.descriptionFull?.trim()
      || patch.vin
      || patch.engine
      || patch.transmission
      || patch.drivetrain
      || patch.bodyStyle
      || patch.exteriorColor
      || patch.interiorColor
      || patch.sellerNotes
      || patch.sellerName
      || patch.location || patch.askingPrice
      || patch.currentBid
      || patch.bidCount
      || patch.mileage
  )
}

async function withAdapterTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error("source_unavailable")), timeoutMs)
  })

  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (timeoutId) clearTimeout(timeoutId)
  }
}

function markFallback(
  fallback: ScrapedListingFull,
  reason: NonNullable<ScrapedListingFull["fallbackReason"]>,
  strategy: NonNullable<ScrapedListingFull["analysisStrategy"]> = "database_fallback",
): ScrapedListingFull {
  const data = {
    ...fallback,
    scrapeSuccessful: false,
    scrapePartial: true,
    analysisStrategy: strategy,
    fallbackReason: reason,
  }
  return {
    ...data,
    analysisFieldCounts: fieldCounts(data),
  }
}

function buildMonitorRecord(params: {
  runId: string
  startedAt: Date
  finishedAt: Date
  durationMs: number
  source: ListingAnalysisSource | null
  data: ScrapedListingFull
  failedReason: NonNullable<ScrapedListingFull["fallbackReason"]> | null
}): ScraperRunRecord {
  const discovered = params.source ? 1 : 0
  const written = params.data.scrapeSuccessful ? 1 : 0
  const intentionalFallback = params.data.fallbackReason === "verified_database_data"
  const errorsCount = params.failedReason && !intentionalFallback ? 1 : 0

  return {
    scraper_name: "report-listing-analysis",
    run_id: params.runId,
    started_at: params.startedAt.toISOString(),
    finished_at: params.finishedAt.toISOString(),
    success: errorsCount === 0,
    runtime: "server_request",
    duration_ms: params.durationMs,
    discovered,
    written,
    errors_count: errorsCount,
    details_fetched: written,
    normalized: written,
    source_counts: params.source
      ? { [params.source]: { discovered: 1, written } }
      : undefined,
    error_messages: errorsCount > 0 && params.failedReason ? [params.failedReason] : undefined,
  }
}

async function safeMonitorWrite(monitor: ListingAnalysisMonitor, record: ScraperRunRecord): Promise<void> {
  try {
    await monitor(record)
  } catch (err) {
    console.warn("[listingScraper] Monitoring write failed", err instanceof Error ? err.message : err)
  }
}

function buildAuctionAdapterInput(car: CollectorCar, fallback: ScrapedListingFull) {
  return {
    externalId: car.id,
    platform: car.platform,
    title: fallback.title,
    make: fallback.make,
    model: fallback.model,
    year: fallback.year ?? 0,
    mileage: null,
    mileageUnit: "mi",
    transmission: null,
    engine: null,
    exteriorColor: null,
    interiorColor: null,
    location: null,
    currentBid: null,
    bidCount: 0,
    endTime: null,
    url: fallback.sourceUrl,
    imageUrl: null,
    description: null,
    sellerNotes: null,
    status: car.status,
    vin: null,
    images: [],
    reserveStatus: null,
    bodyStyle: null,
  }
}

function auctionToPatch(auction: {
  title?: string | null
  year?: number | null
  make?: string | null
  model?: string | null
  mileage?: number | null
  mileageUnit?: string | null
  transmission?: string | null
  engine?: string | null
  exteriorColor?: string | null
  interiorColor?: string | null
  location?: string | null
  currentBid?: number | null
  bidCount?: number | null
  endTime?: Date | string | null
  url?: string | null
  description?: string | null
  sellerNotes?: string | null
  vin?: string | null
  images?: string[] | null
  reserveStatus?: string | null
  bodyStyle?: string | null
}): ListingAnalysisPatch {
  return {
    title: auction.title ?? undefined,
    year: auction.year ?? undefined,
    make: auction.make ?? undefined,
    model: auction.model ?? undefined,
    mileage: auction.mileage ?? undefined,
    mileageUnit: normalizeMileageUnit(auction.mileageUnit),
    transmission: auction.transmission ?? undefined,
    engine: auction.engine ?? undefined,
    exteriorColor: auction.exteriorColor ?? undefined,
    interiorColor: auction.interiorColor ?? undefined,
    location: auction.location ?? undefined,
    currentBid: auction.currentBid ?? undefined,
    bidCount: auction.bidCount ?? undefined,
    auctionEndTime: auction.endTime ? new Date(auction.endTime).toISOString() : undefined,
    sourceUrl: auction.url ?? undefined,
    descriptionFull: auction.description ?? undefined,
    sellerNotes: auction.sellerNotes ?? undefined,
    vin: auction.vin ?? undefined,
    photoUrls: auction.images ?? undefined,
    bodyStyle: auction.bodyStyle ?? undefined,
    reserveStatus: auction.reserveStatus === "RESERVE_MET"
      ? "met"
      : auction.reserveStatus === "RESERVE_NOT_MET"
        ? "not_met"
        : auction.reserveStatus === "NO_RESERVE"
          ? "no_reserve"
          : undefined,
    scrapeSuccessful: true,
    scrapePartial: false,
    analysisStrategy: "inline_live_source",
  }
}

function detailToPatch(detail: Partial<ScrapedListingFull>): ListingAnalysisPatch {
  return {
    ...detail,
    scrapeSuccessful: true,
    scrapePartial: false,
    analysisStrategy: "inline_live_source",
  }
}

export function buildDefaultListingAnalysisAdapters(): Partial<Record<ListingAnalysisSource, ListingAnalysisAdapter>> {
  return {
    BaT: async (car, fallback) => {
      const { scrapeDetail } = await import("@/features/scrapers/auctions/bringATrailer")
      return auctionToPatch(await scrapeDetail(buildAuctionAdapterInput(car, fallback) as never))
    },
    CarsAndBids: async (car, fallback) => {
      const { scrapeDetail } = await import("@/features/scrapers/auctions/carsAndBids")
      return auctionToPatch(await scrapeDetail(buildAuctionAdapterInput(car, fallback) as never))
    },
    CollectingCars: async (car, fallback) => {
      const { scrapeDetail } = await import("@/features/scrapers/auctions/collectingCars")
      return auctionToPatch(await scrapeDetail(buildAuctionAdapterInput(car, fallback) as never))
    },
    Elferspot: async (_car, fallback) => {
      const { fetchDetailPage } = await import("@/features/scrapers/elferspot_collector/detail")
      const detail = await fetchDetailPage(fallback.sourceUrl)
      return detailToPatch({
        year: detail.year ?? undefined,
        model: detail.model ?? undefined,
        mileage: detail.mileageKm ?? undefined,
        mileageUnit: "km",
        transmission: detail.transmission ?? undefined,
        drivetrain: detail.driveType ?? undefined,
        bodyStyle: detail.bodyType ?? undefined,
        engine: detail.engine ?? undefined,
        exteriorColor: detail.colorExterior ?? undefined,
        interiorColor: detail.colorInterior ?? undefined,
        vin: detail.vin ?? undefined,
        location: detail.location ?? detail.locationCountry ?? undefined,
        sellerName: detail.sellerName ?? undefined,
        sellerType: detail.sellerType ?? undefined,
        descriptionFull: detail.descriptionText ?? undefined,
        photoUrls: detail.images,
        askingPrice: detail.price ?? undefined,
      })
    },
    BeForward: async (_car, fallback) => {
      const [{ fetchAndParseDetail }, { PerDomainRateLimiter }] = await Promise.all([
        import("@/features/scrapers/beforward_porsche_collector/detail"),
        import("@/features/scrapers/beforward_porsche_collector/net"),
      ])
      const detail = await fetchAndParseDetail({
        url: fallback.sourceUrl,
        timeoutMs: ADAPTER_TIMEOUT_MS,
        limiter: new PerDomainRateLimiter(2_500),
      })
      return detailToPatch({
        title: detail.title,
        year: detail.year ?? undefined,
        make: detail.make ?? undefined,
        model: detail.model ?? undefined,
        trim: detail.trim ?? undefined,
        mileage: detail.mileageKm ?? undefined,
        mileageUnit: "km",
        transmission: detail.transmission ?? undefined,
        drivetrain: detail.drive ?? undefined,
        seats: detail.seats ?? undefined,
        engine: detail.engine ?? undefined,
        exteriorColor: detail.exteriorColor ?? undefined,
        interiorColor: detail.interiorColor ?? undefined,
        vin: detail.vin ?? undefined,
        location: detail.location ?? undefined,
        equipmentList: [...detail.features, ...detail.sellingPoints],
        photoUrls: detail.images,
        askingPrice: detail.schemaPriceUsd ?? undefined,
      })
    },
    AutoTrader: async (_car, fallback) => {
      const { fetchAutoTraderDetail } = await import("@/features/scrapers/autotrader_collector/detail")
      const detail = await fetchAutoTraderDetail(fallback.sourceUrl, ADAPTER_TIMEOUT_MS)
      return detailToPatch({
        title: detail.title ?? undefined,
        mileage: detail.mileage ?? undefined,
        mileageUnit: normalizeMileageUnit(detail.mileageUnit),
        location: detail.location ?? undefined,
        descriptionFull: detail.description ?? undefined,
        photoUrls: detail.images,
        vin: detail.vin ?? undefined,
        exteriorColor: detail.exteriorColor ?? undefined,
        interiorColor: detail.interiorColor ?? undefined,
        transmission: detail.transmission ?? undefined,
        engine: detail.engine ?? undefined,
        bodyStyle: detail.bodyStyle ?? undefined,
        askingPrice: detail.price ?? undefined,
      })
    },
    AutoScout24: async (_car, fallback) => {
      const { fetchAS24DetailWithScrapling } = await import("@/features/scrapers/autoscout24_collector/scrapling")
      const detail = await fetchAS24DetailWithScrapling(fallback.sourceUrl)
      if (!detail) throw new Error("source_unavailable")
      return detailToPatch({
        trim: detail.trim ?? undefined,
        vin: detail.vin ?? undefined,
        transmission: detail.transmission ?? undefined,
        bodyStyle: detail.bodyStyle ?? undefined,
        engine: detail.engine ?? undefined,
        exteriorColor: detail.colorExterior ?? undefined,
        interiorColor: detail.colorInterior ?? undefined,
        descriptionFull: detail.description ?? undefined,
        photoUrls: detail.images,
        equipmentList: detail.features,
      })
    },
    ClassicCom: async (_car, fallback) => {
      const { fetchClassicDetailWithScrapling } = await import("@/features/scrapers/classic_collector/scrapling")
      const detail = await fetchClassicDetailWithScrapling(fallback.sourceUrl)
      if (!detail) throw new Error("source_unavailable")
      return detailToPatch({
        title: detail.title,
        descriptionFull: detail.bodyText,
        photoUrls: detail.images,
      })
    },
  }
}

export async function executeListingScraper(
  ctx: PipelineContext,
  options: ListingScraperOptions = {},
): Promise<{ data: ScrapedListingFull; durationMs: number; agentModel: string | null; completionNote: string }> {
  const startedAt = options.now?.() ?? new Date()
  const t0 = Date.now()
  const monitor = options.monitor ?? recordScraperRun
  const runId = options.runId?.() ?? createRunId()
  const environment = options.environment ?? getDefaultEnvironment()
  const fallback = buildFallbackFromCar(ctx.car)
  fallback.scrapedAt = startedAt.toISOString()

  const source = fallback.analysisSource && isKnownSource(fallback.analysisSource)
    ? fallback.analysisSource
    : selectListingAnalysisSource(ctx.car)
  fallback.analysisSource = source

  const adapters = {
    ...buildDefaultListingAnalysisAdapters(),
    ...options.adapters,
  }

  let data: ScrapedListingFull
  let failedReason: NonNullable<ScrapedListingFull["fallbackReason"]> | null = null

  if (!fallback.sourceUrl) {
    failedReason = "missing_source_url"
    data = markFallback(fallback, failedReason)
  } else if (!source) {
    failedReason = "unknown_source"
    data = markFallback(fallback, failedReason)
  } else {
    const policy = shouldAttemptListingAnalysis(source, environment)
    const adapter = adapters[source]

    if (!policy.attempt) {
      data = markFallback(fallback, policy.customerSafeReason ?? "verified_database_data", "policy_skipped")
    } else if (!adapter) {
      failedReason = "source_unavailable"
      data = markFallback(fallback, failedReason)
    } else {
      try {
        const patch = await withAdapterTimeout(adapter(ctx.car, fallback), ADAPTER_TIMEOUT_MS)
        if (!patch.scrapeSuccessful || !hasAnalyzedSourceData(patch)) {
          failedReason = "empty_source_response"
          data = markFallback(fallback, failedReason)
          data.analysisSource = source
        } else {
          data = mergeAnalysisOntoFallback(fallback, {
            ...patch,
            analysisSource: source,
          })
        }
      } catch {
        failedReason = "source_unavailable"
        data = markFallback(fallback, failedReason)
      }
    }
  }

  data.scrapedAt = startedAt.toISOString()
  const durationMs = Math.max(0, Date.now() - t0)
  const finishedAt = new Date(startedAt.getTime() + durationMs)
  await safeMonitorWrite(monitor, buildMonitorRecord({
    runId,
    startedAt,
    finishedAt,
    durationMs,
    source,
    data,
    failedReason,
  }))

  return {
    data,
    durationMs,
    agentModel: null,
    completionNote: buildListingAnalysisNote(data),
  }
}
