import { prisma } from './prisma'
import type {
  Platform,
  AuctionStatus,
  Prisma,
} from '@prisma/client'

// ---------------------------------------------------------------------------
// Auction queries
// ---------------------------------------------------------------------------

interface GetAuctionsParams {
  platform?: Platform
  make?: string
  model?: string
  status?: AuctionStatus
  page?: number
  pageSize?: number
}

export async function getAuctions({
  platform,
  make,
  model,
  status,
  page = 1,
  pageSize = 20,
}: GetAuctionsParams = {}) {
  const where: Prisma.AuctionWhereInput = {}

  if (platform) where.platform = platform
  if (make) where.make = { equals: make, mode: 'insensitive' }
  if (model) where.model = { equals: model, mode: 'insensitive' }
  if (status) where.status = status

  const [auctions, total] = await Promise.all([
    prisma.auction.findMany({
      where,
      include: { analysis: true },
      orderBy: { endTime: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auction.count({ where }),
  ])

  return {
    auctions,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getAuctionById(id: string) {
  return prisma.auction.findUnique({
    where: { id },
    include: {
      analysis: true,
      comparables: true,
      priceHistory: { orderBy: { timestamp: 'asc' } },
    },
  })
}

export async function getAuctionByExternalId(externalId: string) {
  return prisma.auction.findUnique({
    where: { externalId },
    include: {
      analysis: true,
      comparables: true,
      priceHistory: { orderBy: { timestamp: 'asc' } },
    },
  })
}

export async function upsertAuction(
  data: Prisma.AuctionCreateInput & { externalId: string },
) {
  const { externalId, ...rest } = data

  return prisma.auction.upsert({
    where: { externalId },
    create: { externalId, ...rest },
    update: rest,
  })
}

// ---------------------------------------------------------------------------
// Analysis queries
// ---------------------------------------------------------------------------

export async function saveAnalysis(
  auctionId: string,
  data: Omit<Prisma.AnalysisCreateInput, 'auction'>,
) {
  return prisma.analysis.upsert({
    where: { auctionId },
    create: {
      ...data,
      auction: { connect: { id: auctionId } },
    },
    update: data,
  })
}

// ---------------------------------------------------------------------------
// Comparable queries
// ---------------------------------------------------------------------------

export async function getComparables(auctionId: string) {
  return prisma.comparable.findMany({
    where: { auctionId },
    orderBy: { soldDate: 'desc' },
  })
}

export async function saveComparable(
  auctionId: string,
  data: Omit<Prisma.ComparableCreateInput, 'auction'>,
) {
  return prisma.comparable.create({
    data: {
      ...data,
      auction: { connect: { id: auctionId } },
    },
  })
}

// ---------------------------------------------------------------------------
// Price history queries
// ---------------------------------------------------------------------------

export async function savePriceHistory(auctionId: string, bid: number) {
  return prisma.priceHistory.create({
    data: {
      bid,
      auction: { connect: { id: auctionId } },
    },
  })
}

// ---------------------------------------------------------------------------
// Market data queries
// ---------------------------------------------------------------------------

export async function getMarketData(make: string, model: string) {
  return prisma.marketData.findMany({
    where: {
      make: { equals: make, mode: 'insensitive' },
      model: { equals: model, mode: 'insensitive' },
    },
    orderBy: { yearStart: 'asc' },
  })
}

export async function upsertMarketData(
  data: Prisma.MarketDataCreateInput,
) {
  const { make, model, yearStart, yearEnd, ...rest } = data

  return prisma.marketData.upsert({
    where: {
      make_model_yearStart_yearEnd: {
        make: make,
        model: model,
        yearStart: yearStart ?? 0,
        yearEnd: yearEnd ?? 0,
      },
    },
    create: { make, model, yearStart, yearEnd, ...rest },
    update: rest,
  })
}

// ═══════════════════════════════════════════════════════════════════════════
// FRONTEND DATA QUERIES — used by page.tsx server components
// ═══════════════════════════════════════════════════════════════════════════

// ─── Serializable types for client components ───

export interface DbMarketDataRow {
  make: string
  model: string
  avgPrice: number | null
  medianPrice: number | null
  lowPrice: number | null
  highPrice: number | null
  totalSales: number
  trend: string | null
}

export interface DbComparableRow {
  title: string
  platform: string
  soldDate: string | null
  soldPrice: number
  mileage: number | null
  condition: string | null
}

export interface DbAnalysisRow {
  bidTargetLow: number | null
  bidTargetHigh: number | null
  confidence: string | null
  redFlags: string[]
  keyStrengths: string[]
  criticalQuestions: string[]
  yearlyMaintenance: number | null
  insuranceEstimate: number | null
  majorServiceCost: number | null
  investmentGrade: string | null
  appreciationPotential: string | null
  rawAnalysis: Record<string, unknown> | null
}

export interface DbSoldRecord {
  price: number
  date: string
  model: string
  year: number
  title: string
}

// ─── Query: all MarketData rows for a make ───

export async function getMarketDataForMake(make: string): Promise<DbMarketDataRow[]> {
  try {
    const rows = await prisma.marketData.findMany({
      where: { make: { equals: make, mode: "insensitive" } },
      orderBy: { lastUpdated: "desc" },
    })
    return rows.map(r => ({
      make: r.make,
      model: r.model,
      avgPrice: r.avgPrice,
      medianPrice: r.medianPrice,
      lowPrice: r.lowPrice,
      highPrice: r.highPrice,
      totalSales: r.totalSales,
      trend: r.trend,
    }))
  } catch (e) {
    console.error("[queries] getMarketDataForMake:", e)
    return []
  }
}

// ─── Query: MarketData for a specific make+model ───

export async function getMarketDataForModel(make: string, model: string): Promise<DbMarketDataRow | null> {
  try {
    const r = await prisma.marketData.findFirst({
      where: {
        make: { equals: make, mode: "insensitive" },
        model: { equals: model, mode: "insensitive" },
      },
      orderBy: { lastUpdated: "desc" },
    })
    if (!r) return null
    return {
      make: r.make, model: r.model,
      avgPrice: r.avgPrice, medianPrice: r.medianPrice,
      lowPrice: r.lowPrice, highPrice: r.highPrice,
      totalSales: r.totalSales, trend: r.trend,
    }
  } catch (e) {
    console.error("[queries] getMarketDataForModel:", e)
    return null
  }
}

// ─── Query: Comparable sales for a make (across all models) ───

export async function getComparablesForMake(make: string, limit = 20): Promise<DbComparableRow[]> {
  try {
    const rows = await prisma.comparable.findMany({
      where: { auction: { make: { equals: make, mode: "insensitive" } } },
      orderBy: { soldDate: "desc" },
      take: limit,
    })
    return rows.map(c => ({
      title: c.title,
      platform: c.platform,
      soldDate: c.soldDate?.toISOString() ?? null,
      soldPrice: c.soldPrice,
      mileage: c.mileage,
      condition: c.condition,
    }))
  } catch (e) {
    console.error("[queries] getComparablesForMake:", e)
    return []
  }
}

// ─── Query: Comparable sales for a specific make+model ───

export async function getComparablesForModel(make: string, model: string, limit = 10): Promise<DbComparableRow[]> {
  try {
    const rows = await prisma.comparable.findMany({
      where: {
        auction: {
          make: { equals: make, mode: "insensitive" },
          model: { contains: model, mode: "insensitive" },
        },
      },
      orderBy: { soldDate: "desc" },
      take: limit,
    })
    return rows.map(c => ({
      title: c.title,
      platform: c.platform,
      soldDate: c.soldDate?.toISOString() ?? null,
      soldPrice: c.soldPrice,
      mileage: c.mileage,
      condition: c.condition,
    }))
  } catch (e) {
    console.error("[queries] getComparablesForModel:", e)
    return []
  }
}

// ─── Query: Analysis for a car (match by make/model/year) ───

export async function getAnalysisForCar(make: string, model: string, year: number): Promise<DbAnalysisRow | null> {
  try {
    const auction = await prisma.auction.findFirst({
      where: {
        make: { equals: make, mode: "insensitive" },
        model: { contains: model, mode: "insensitive" },
        year,
      },
      include: { analysis: true },
      orderBy: { updatedAt: "desc" },
    })
    if (!auction?.analysis) return null
    const a = auction.analysis
    return {
      bidTargetLow: a.bidTargetLow,
      bidTargetHigh: a.bidTargetHigh,
      confidence: a.confidence,
      redFlags: a.redFlags,
      keyStrengths: a.keyStrengths,
      criticalQuestions: a.criticalQuestions,
      yearlyMaintenance: a.yearlyMaintenance,
      insuranceEstimate: a.insuranceEstimate,
      majorServiceCost: a.majorServiceCost,
      investmentGrade: a.investmentGrade,
      appreciationPotential: a.appreciationPotential,
      rawAnalysis: a.rawAnalysis as Record<string, unknown> | null,
    }
  } catch (e) {
    console.error("[queries] getAnalysisForCar:", e)
    return null
  }
}

// ─── Query: sold auctions for a make (real price history) ───

export async function getSoldAuctionsForMake(make: string, limit = 200): Promise<DbSoldRecord[]> {
  try {
    const auctions = await prisma.auction.findMany({
      where: {
        make: { equals: make, mode: "insensitive" },
        finalPrice: { not: null, gt: 0 },
        status: { in: ["SOLD", "ENDED"] },
      },
      select: { title: true, finalPrice: true, endTime: true, model: true, year: true },
      orderBy: { endTime: "asc" },
      take: limit,
    })
    return auctions
      .filter(a => a.finalPrice != null && a.endTime != null)
      .map(a => ({
        price: a.finalPrice!,
        date: a.endTime!.toISOString(),
        model: a.model,
        year: a.year,
        title: a.title,
      }))
  } catch (e) {
    console.error("[queries] getSoldAuctionsForMake:", e)
    return []
  }
}

// ─── Query: all analyses for a make (aggregate red flags, strengths, costs) ───

export async function getAnalysesForMake(make: string): Promise<DbAnalysisRow[]> {
  try {
    const analyses = await prisma.analysis.findMany({
      where: { auction: { make: { equals: make, mode: "insensitive" } } },
      orderBy: { updatedAt: "desc" },
      take: 50,
    })
    return analyses.map(a => ({
      bidTargetLow: a.bidTargetLow,
      bidTargetHigh: a.bidTargetHigh,
      confidence: a.confidence,
      redFlags: a.redFlags,
      keyStrengths: a.keyStrengths,
      criticalQuestions: a.criticalQuestions,
      yearlyMaintenance: a.yearlyMaintenance,
      insuranceEstimate: a.insuranceEstimate,
      majorServiceCost: a.majorServiceCost,
      investmentGrade: a.investmentGrade,
      appreciationPotential: a.appreciationPotential,
      rawAnalysis: a.rawAnalysis as Record<string, unknown> | null,
    }))
  } catch (e) {
    console.error("[queries] getAnalysesForMake:", e)
    return []
  }
}
