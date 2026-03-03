import { dbQuery } from './sql'

type Platform = 'BRING_A_TRAILER' | 'CARS_AND_BIDS' | 'COLLECTING_CARS'
type AuctionStatus = 'ACTIVE' | 'ENDING_SOON' | 'ENDED' | 'SOLD' | 'NO_SALE'

const DB_QUERY_TIMEOUT_MS = 2_500
const DB_UNREACHABLE_COOLDOWN_MS = 30_000
const DB_CIRCUIT_OPEN_CODE = 'DB_CIRCUIT_OPEN'

let dbUnavailableUntil = 0

class DbCircuitOpenError extends Error {
  code = DB_CIRCUIT_OPEN_CODE
}

function getErrorCode(error: unknown): string {
  if (!error || typeof error !== 'object') return ''
  const maybeCode = (error as { code?: unknown }).code
  return typeof maybeCode === 'string' ? maybeCode.toUpperCase() : ''
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function isDbReachabilityError(error: unknown): boolean {
  const code = getErrorCode(error)
  const message = getErrorMessage(error).toUpperCase()

  if (code === DB_CIRCUIT_OPEN_CODE) return false

  return (
    code === 'EHOSTUNREACH' ||
    code === 'ECONNREFUSED' ||
    code === 'ENOTFOUND' ||
    code === 'ETIMEDOUT' ||
    message.includes('EHOSTUNREACH') ||
    message.includes('ECONNREFUSED') ||
    message.includes('ENOTFOUND') ||
    message.includes('ETIMEDOUT') ||
    message.includes("CAN'T REACH DATABASE SERVER") ||
    message.includes('DB TIMEOUT')
  )
}

function shouldSkipDbQueries(): boolean {
  return Date.now() < dbUnavailableUntil
}

function markDbUnavailable(error: unknown, label: string) {
  const now = Date.now()
  const wasOpen = now < dbUnavailableUntil
  dbUnavailableUntil = now + DB_UNREACHABLE_COOLDOWN_MS

  if (!wasOpen) {
    console.warn(`[queries] DB circuit opened for ${DB_UNREACHABLE_COOLDOWN_MS}ms after ${label}:`, getErrorMessage(error))
  }
}

function shouldLogDbError(error: unknown): boolean {
  return getErrorCode(error) !== DB_CIRCUIT_OPEN_CODE
}

function withDbTimeout<T>(operation: () => Promise<T>, label: string): Promise<T> {
  if (shouldSkipDbQueries()) {
    return Promise.reject(new DbCircuitOpenError(`DB circuit open, skipped ${label}`))
  }

  let timeoutHandle: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new Error(`DB timeout in ${label} after ${DB_QUERY_TIMEOUT_MS}ms`)), DB_QUERY_TIMEOUT_MS)
  })

  return Promise.race([operation(), timeoutPromise])
    .catch((error) => {
      if (isDbReachabilityError(error)) markDbUnavailable(error, label)
      throw error
    })
    .finally(() => {
      if (timeoutHandle) clearTimeout(timeoutHandle)
    })
}

function logDbQueryError(label: string, error: unknown) {
  if (shouldLogDbError(error)) {
    console.error(`[queries] ${label}:`, error)
  }
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => {
    const normalized: Record<string, unknown> = { ...row }
    if (normalized.endTime instanceof Date) normalized.endTime = normalized.endTime.toISOString()
    if (normalized.startTime instanceof Date) normalized.startTime = normalized.startTime.toISOString()
    if (normalized.scrapedAt instanceof Date) normalized.scrapedAt = normalized.scrapedAt.toISOString()
    if (normalized.createdAt instanceof Date) normalized.createdAt = normalized.createdAt.toISOString()
    if (normalized.updatedAt instanceof Date) normalized.updatedAt = normalized.updatedAt.toISOString()
    return normalized
  })
}

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
  const clauses: string[] = []
  const values: unknown[] = []

  if (platform) {
    values.push(platform)
    clauses.push(`"platform" = $${values.length}`)
  }
  if (make) {
    values.push(make)
    clauses.push(`"make" ILIKE $${values.length}`)
  }
  if (model) {
    values.push(model)
    clauses.push(`"model" ILIKE $${values.length}`)
  }
  if (status) {
    values.push(status)
    clauses.push(`"status" = $${values.length}`)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const offset = (page - 1) * pageSize
  values.push(pageSize, offset)
  const limitIndex = values.length - 1
  const offsetIndex = values.length

  const [rowsResult, countResult] = await Promise.all([
    dbQuery<Record<string, unknown>>(
      `SELECT * FROM "Auction" ${where} ORDER BY "endTime" DESC NULLS LAST LIMIT $${limitIndex} OFFSET $${offsetIndex}`,
      values,
    ),
    dbQuery<{ total: string }>(`SELECT COUNT(*)::bigint AS total FROM "Auction" ${where}`, values.slice(0, values.length - 2)),
  ])

  const total = Number(countResult.rows[0]?.total ?? 0)

  return {
    auctions: normalizeRows(rowsResult.rows),
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  }
}

export async function getAuctionById(id: string) {
  const result = await dbQuery<Record<string, unknown>>('SELECT * FROM "Auction" WHERE id = $1 LIMIT 1', [id])
  return normalizeRows(result.rows)[0] ?? null
}

export async function getAuctionByExternalId(externalId: string) {
  const result = await dbQuery<Record<string, unknown>>('SELECT * FROM "Auction" WHERE "externalId" = $1 LIMIT 1', [externalId])
  return normalizeRows(result.rows)[0] ?? null
}

export async function upsertAuction(data: Record<string, unknown> & { externalId: string }) {
  const now = new Date()
  const result = await dbQuery<Record<string, unknown>>(
    `
      INSERT INTO "Auction" (
        "externalId", platform, url, title, make, model, year, trim, vin, mileage,
        "mileageUnit", transmission, engine, "exteriorColor", "interiorColor", location,
        "currentBid", "reserveStatus", "bidCount", "viewCount", "watchCount", "startTime",
        "endTime", status, "finalPrice", description, "sellerNotes", images, "scrapedAt", "updatedAt"
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,
        $11,$12,$13,$14,$15,$16,
        $17,$18,$19,$20,$21,$22,
        $23,$24,$25,$26,$27,$28,$29,$30
      )
      ON CONFLICT ("externalId") DO UPDATE SET
        platform = EXCLUDED.platform,
        url = EXCLUDED.url,
        title = EXCLUDED.title,
        make = EXCLUDED.make,
        model = EXCLUDED.model,
        year = EXCLUDED.year,
        trim = EXCLUDED.trim,
        vin = EXCLUDED.vin,
        mileage = EXCLUDED.mileage,
        "mileageUnit" = EXCLUDED."mileageUnit",
        transmission = EXCLUDED.transmission,
        engine = EXCLUDED.engine,
        "exteriorColor" = EXCLUDED."exteriorColor",
        "interiorColor" = EXCLUDED."interiorColor",
        location = EXCLUDED.location,
        "currentBid" = EXCLUDED."currentBid",
        "reserveStatus" = EXCLUDED."reserveStatus",
        "bidCount" = EXCLUDED."bidCount",
        "viewCount" = EXCLUDED."viewCount",
        "watchCount" = EXCLUDED."watchCount",
        "startTime" = EXCLUDED."startTime",
        "endTime" = EXCLUDED."endTime",
        status = EXCLUDED.status,
        "finalPrice" = EXCLUDED."finalPrice",
        description = EXCLUDED.description,
        "sellerNotes" = EXCLUDED."sellerNotes",
        images = EXCLUDED.images,
        "scrapedAt" = EXCLUDED."scrapedAt",
        "updatedAt" = EXCLUDED."updatedAt"
      RETURNING *
    `,
    [
      data.externalId,
      data.platform ?? null,
      data.url ?? null,
      data.title ?? null,
      data.make ?? null,
      data.model ?? null,
      data.year ?? null,
      data.trim ?? null,
      data.vin ?? null,
      data.mileage ?? null,
      data.mileageUnit ?? 'miles',
      data.transmission ?? null,
      data.engine ?? null,
      data.exteriorColor ?? null,
      data.interiorColor ?? null,
      data.location ?? null,
      data.currentBid ?? null,
      data.reserveStatus ?? null,
      data.bidCount ?? 0,
      data.viewCount ?? null,
      data.watchCount ?? null,
      data.startTime ?? null,
      data.endTime ?? null,
      data.status ?? 'ACTIVE',
      data.finalPrice ?? null,
      data.description ?? null,
      data.sellerNotes ?? null,
      data.images ?? [],
      data.scrapedAt ?? now,
      now,
    ],
  )

  return normalizeRows(result.rows)[0] ?? null
}

export async function saveAnalysis(auctionId: string, data: Record<string, unknown>) {
  const result = await dbQuery<Record<string, unknown>>(
    `
      INSERT INTO "Analysis" (
        "auctionId", "bidTargetLow", "bidTargetHigh", confidence,
        "criticalQuestions", "redFlags", "keyStrengths", "yearlyMaintenance",
        "insuranceEstimate", "majorServiceCost", "investmentGrade", "appreciationPotential", "rawAnalysis"
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      ON CONFLICT ("auctionId") DO UPDATE SET
        "bidTargetLow" = EXCLUDED."bidTargetLow",
        "bidTargetHigh" = EXCLUDED."bidTargetHigh",
        confidence = EXCLUDED.confidence,
        "criticalQuestions" = EXCLUDED."criticalQuestions",
        "redFlags" = EXCLUDED."redFlags",
        "keyStrengths" = EXCLUDED."keyStrengths",
        "yearlyMaintenance" = EXCLUDED."yearlyMaintenance",
        "insuranceEstimate" = EXCLUDED."insuranceEstimate",
        "majorServiceCost" = EXCLUDED."majorServiceCost",
        "investmentGrade" = EXCLUDED."investmentGrade",
        "appreciationPotential" = EXCLUDED."appreciationPotential",
        "rawAnalysis" = EXCLUDED."rawAnalysis"
      RETURNING *
    `,
    [
      auctionId,
      data.bidTargetLow ?? null,
      data.bidTargetHigh ?? null,
      data.confidence ?? null,
      data.criticalQuestions ?? [],
      data.redFlags ?? [],
      data.keyStrengths ?? [],
      data.yearlyMaintenance ?? null,
      data.insuranceEstimate ?? null,
      data.majorServiceCost ?? null,
      data.investmentGrade ?? null,
      data.appreciationPotential ?? null,
      data.rawAnalysis ?? null,
    ],
  )

  return normalizeRows(result.rows)[0] ?? null
}

export async function getComparables(auctionId: string) {
  const result = await dbQuery<Record<string, unknown>>(
    'SELECT * FROM "Comparable" WHERE "auctionId" = $1 ORDER BY "soldDate" DESC NULLS LAST',
    [auctionId],
  )
  return normalizeRows(result.rows)
}

export async function saveComparable(auctionId: string, data: Record<string, unknown>) {
  const result = await dbQuery<Record<string, unknown>>(
    `
      INSERT INTO "Comparable" (
        "auctionId", title, platform, url, "soldDate", "soldPrice", mileage, condition
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
      RETURNING *
    `,
    [
      auctionId,
      data.title ?? null,
      data.platform ?? null,
      data.url ?? null,
      data.soldDate ?? null,
      data.soldPrice ?? null,
      data.mileage ?? null,
      data.condition ?? null,
    ],
  )
  return normalizeRows(result.rows)[0] ?? null
}

export async function savePriceHistory(auctionId: string, bid: number) {
  const result = await dbQuery<Record<string, unknown>>(
    'INSERT INTO "PriceHistory" ("auctionId", bid) VALUES ($1, $2) RETURNING *',
    [auctionId, bid],
  )
  return normalizeRows(result.rows)[0] ?? null
}

export async function getMarketData(make: string, model: string) {
  const result = await dbQuery<Record<string, unknown>>(
    'SELECT * FROM "MarketData" WHERE make ILIKE $1 AND model ILIKE $2 ORDER BY "yearStart" ASC NULLS LAST',
    [make, model],
  )
  return normalizeRows(result.rows)
}

export async function upsertMarketData(data: Record<string, unknown>) {
  const lookup = await dbQuery<{ id: string }>(
    `
      SELECT id FROM "MarketData"
      WHERE make ILIKE $1 AND model ILIKE $2
        AND COALESCE("yearStart", -1) = COALESCE($3::int, -1)
        AND COALESCE("yearEnd", -1) = COALESCE($4::int, -1)
      LIMIT 1
    `,
    [data.make ?? null, data.model ?? null, data.yearStart ?? null, data.yearEnd ?? null],
  )

  if (lookup.rows[0]?.id) {
    const result = await dbQuery<Record<string, unknown>>(
      `
        UPDATE "MarketData"
        SET "avgPrice" = $2,
            "medianPrice" = $3,
            "lowPrice" = $4,
            "highPrice" = $5,
            "totalSales" = $6,
            trend = $7,
            "lastUpdated" = NOW()
        WHERE id = $1
        RETURNING *
      `,
      [
        lookup.rows[0].id,
        data.avgPrice ?? null,
        data.medianPrice ?? null,
        data.lowPrice ?? null,
        data.highPrice ?? null,
        data.totalSales ?? 0,
        data.trend ?? null,
      ],
    )
    return normalizeRows(result.rows)[0] ?? null
  }

  const inserted = await dbQuery<Record<string, unknown>>(
    `
      INSERT INTO "MarketData" (
        make, model, "yearStart", "yearEnd", "avgPrice", "medianPrice", "lowPrice", "highPrice", "totalSales", trend
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `,
    [
      data.make ?? null,
      data.model ?? null,
      data.yearStart ?? null,
      data.yearEnd ?? null,
      data.avgPrice ?? null,
      data.medianPrice ?? null,
      data.lowPrice ?? null,
      data.highPrice ?? null,
      data.totalSales ?? 0,
      data.trend ?? null,
    ],
  )

  return normalizeRows(inserted.rows)[0] ?? null
}

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

export async function getMarketDataForMake(make: string): Promise<DbMarketDataRow[]> {
  try {
    const rows = await withDbTimeout(
      () => dbQuery<DbMarketDataRow>('SELECT make, model, "avgPrice", "medianPrice", "lowPrice", "highPrice", "totalSales", trend FROM "MarketData" WHERE make ILIKE $1 ORDER BY "lastUpdated" DESC', [make]),
      'getMarketDataForMake',
    )
    return rows.rows.map((r) => ({ ...r }))
  } catch (e) {
    logDbQueryError('getMarketDataForMake', e)
    return []
  }
}

export async function getMarketDataForModel(make: string, model: string): Promise<DbMarketDataRow | null> {
  try {
    const rows = await withDbTimeout(
      () => dbQuery<DbMarketDataRow>('SELECT make, model, "avgPrice", "medianPrice", "lowPrice", "highPrice", "totalSales", trend FROM "MarketData" WHERE make ILIKE $1 AND model ILIKE $2 ORDER BY "lastUpdated" DESC LIMIT 1', [make, model]),
      'getMarketDataForModel',
    )
    return rows.rows[0] ?? null
  } catch (e) {
    logDbQueryError('getMarketDataForModel', e)
    return null
  }
}

export async function getComparablesForMake(make: string, limit = 20): Promise<DbComparableRow[]> {
  try {
    const rows = await withDbTimeout(
      () => dbQuery<DbComparableRow>(
        `
          SELECT c.title, c.platform::text AS platform, c."soldDate", c."soldPrice", c.mileage, c.condition
          FROM "Comparable" c
          JOIN "Auction" a ON a.id = c."auctionId"
          WHERE a.make ILIKE $1
          ORDER BY c."soldDate" DESC NULLS LAST
          LIMIT $2
        `,
        [make, limit],
      ),
      'getComparablesForMake',
    )
    return rows.rows.map((c) => ({ ...c, soldDate: c.soldDate ? new Date(c.soldDate).toISOString() : null }))
  } catch (e) {
    logDbQueryError('getComparablesForMake', e)
    return []
  }
}

export async function getComparablesForModel(make: string, model: string, limit = 10): Promise<DbComparableRow[]> {
  try {
    const rows = await withDbTimeout(
      () => dbQuery<DbComparableRow>(
        `
          SELECT c.title, c.platform::text AS platform, c."soldDate", c."soldPrice", c.mileage, c.condition
          FROM "Comparable" c
          JOIN "Auction" a ON a.id = c."auctionId"
          WHERE a.make ILIKE $1 AND a.model ILIKE $2
          ORDER BY c."soldDate" DESC NULLS LAST
          LIMIT $3
        `,
        [make, `%${model}%`, limit],
      ),
      'getComparablesForModel',
    )
    return rows.rows.map((c) => ({ ...c, soldDate: c.soldDate ? new Date(c.soldDate).toISOString() : null }))
  } catch (e) {
    logDbQueryError('getComparablesForModel', e)
    return []
  }
}

export async function getAnalysisForCar(make: string, model: string, year: number): Promise<DbAnalysisRow | null> {
  try {
    const rows = await withDbTimeout(
      () =>
        dbQuery<DbAnalysisRow>(
          `
            SELECT an."bidTargetLow", an."bidTargetHigh", an.confidence::text AS confidence,
                   an."redFlags", an."keyStrengths", an."criticalQuestions", an."yearlyMaintenance",
                   an."insuranceEstimate", an."majorServiceCost", an."investmentGrade"::text AS "investmentGrade",
                   an."appreciationPotential", an."rawAnalysis"
            FROM "Auction" a
            JOIN "Analysis" an ON an."auctionId" = a.id
            WHERE a.make ILIKE $1 AND a.model ILIKE $2 AND a.year = $3
            ORDER BY a."updatedAt" DESC
            LIMIT 1
          `,
          [make, `%${model}%`, year],
        ),
      'getAnalysisForCar',
    )
    return rows.rows[0] ?? null
  } catch (e) {
    logDbQueryError('getAnalysisForCar', e)
    return null
  }
}

export async function getSoldAuctionsForMake(make: string, limit = 200): Promise<DbSoldRecord[]> {
  try {
    const rows = await withDbTimeout(
      () =>
        dbQuery<DbSoldRecord>(
          `
            SELECT "finalPrice" AS price, "endTime" AS date, model, year, title
            FROM "Auction"
            WHERE make ILIKE $1
              AND "finalPrice" IS NOT NULL
              AND "finalPrice" > 0
              AND status IN ('SOLD', 'ENDED')
            ORDER BY "endTime" ASC
            LIMIT $2
          `,
          [make, limit],
        ),
      'getSoldAuctionsForMake',
    )
    return rows.rows
      .filter((r) => r.price != null && r.date != null)
      .map((r) => ({ ...r, date: new Date(r.date).toISOString() }))
  } catch (e) {
    logDbQueryError('getSoldAuctionsForMake', e)
    return []
  }
}

export async function getAnalysesForMake(make: string): Promise<DbAnalysisRow[]> {
  try {
    const rows = await withDbTimeout(
      () =>
        dbQuery<DbAnalysisRow>(
          `
            SELECT an."bidTargetLow", an."bidTargetHigh", an.confidence::text AS confidence,
                   an."redFlags", an."keyStrengths", an."criticalQuestions", an."yearlyMaintenance",
                   an."insuranceEstimate", an."majorServiceCost", an."investmentGrade"::text AS "investmentGrade",
                   an."appreciationPotential", an."rawAnalysis"
            FROM "Analysis" an
            JOIN "Auction" a ON a.id = an."auctionId"
            WHERE a.make ILIKE $1
            ORDER BY an."updatedAt" DESC
            LIMIT 50
          `,
          [make],
        ),
      'getAnalysesForMake',
    )
    return rows.rows
  } catch (e) {
    logDbQueryError('getAnalysesForMake', e)
    return []
  }
}
