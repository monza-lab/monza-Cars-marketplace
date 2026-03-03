import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db/sql'
import { isDbConnectivityError } from '@/lib/db/isDbConnectivityError'
import { normalizeSupportedMake, resolveRequestedMake } from '@/lib/makeProfiles'

const AUCTIONS_QUERY_TIMEOUT_MS = 3_000

function withRouteTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`ETIMEDOUT ${label} after ${AUCTIONS_QUERY_TIMEOUT_MS}ms`))
    }, AUCTIONS_QUERY_TIMEOUT_MS)
  })

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  })
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)

    // Extract query parameters
    const platform = searchParams.get('platform')
    const make = searchParams.get('make')
    const model = searchParams.get('model')
    const status = searchParams.get('status')
    const yearMin = searchParams.get('yearMin')
    const yearMax = searchParams.get('yearMax')
    const priceMin = searchParams.get('priceMin')
    const priceMax = searchParams.get('priceMax')
    const search = searchParams.get('search')
    const sortBy = searchParams.get('sortBy') || 'createdAt'
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc'
    const page = Math.max(1, parseInt(searchParams.get('page') || '1', 10))
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get('limit') || '20', 10)))

    const requestedMake = normalizeSupportedMake(make)
    if (make && !requestedMake) {
      return NextResponse.json({
        success: true,
        data: [],
        meta: { page, limit, total: 0, totalPages: 0 },
      })
    }

    const clauses: string[] = []
    const values: unknown[] = []

    const defaultMake = requestedMake ?? resolveRequestedMake(null)
    values.push(defaultMake)
    clauses.push(`make ILIKE $${values.length}`)

    if (platform) {
      values.push(platform)
      clauses.push(`platform = $${values.length}`)
    }

    if (model) {
      values.push(model)
      clauses.push(`model ILIKE $${values.length}`)
    }

    if (status) {
      values.push(status)
      clauses.push(`status = $${values.length}`)
    }

    if (yearMin || yearMax) {
      if (yearMin) {
        values.push(parseInt(yearMin, 10))
        clauses.push(`year >= $${values.length}`)
      }
      if (yearMax) {
        values.push(parseInt(yearMax, 10))
        clauses.push(`year <= $${values.length}`)
      }
    }

    if (priceMin || priceMax) {
      if (priceMin) {
        values.push(parseFloat(priceMin))
        clauses.push(`"currentBid" >= $${values.length}`)
      }
      if (priceMax) {
        values.push(parseFloat(priceMax))
        clauses.push(`"currentBid" <= $${values.length}`)
      }
    }

    if (search) {
      values.push(`%${search}%`)
      clauses.push(`(title ILIKE $${values.length} OR make ILIKE $${values.length} OR model ILIKE $${values.length})`)
    }

    // Validate sortBy against allowed fields
    const allowedSortFields = [
      'createdAt',
      'updatedAt',
      'currentBid',
      'year',
      'endTime',
      'title',
      'make',
      'model',
      'platform',
    ]
    const safeSortBy = allowedSortFields.includes(sortBy) ? sortBy : 'createdAt'

    const whereSql = clauses.length > 0 ? `WHERE ${clauses.join(' AND ')}` : ''
    values.push(limit)
    const limitParam = values.length
    values.push((page - 1) * limit)
    const offsetParam = values.length

    const [total, auctions] = await withRouteTimeout(
      Promise.all([
        dbQuery<{ total: string }>(`SELECT COUNT(*)::bigint AS total FROM "Auction" ${whereSql}`, values.slice(0, values.length - 2)),
        dbQuery<Record<string, unknown>>(
          `SELECT * FROM "Auction" ${whereSql} ORDER BY "${safeSortBy}" ${sortOrder.toUpperCase()} LIMIT $${limitParam} OFFSET $${offsetParam}`,
          values,
        ),
      ]),
      '/api/auctions'
    )

    const totalCount = Number(total.rows[0]?.total ?? 0)
    const totalPages = Math.ceil(totalCount / limit)

    return NextResponse.json({
      success: true,
      data: auctions.rows,
      meta: {
        page,
        limit,
        total: totalCount,
        totalPages,
      },
    })
  } catch (error) {
    console.error('Error fetching auctions:', error)

    if (isDbConnectivityError(error)) {
      return NextResponse.json({
        success: true,
        degraded: true,
        data: [],
        meta: {
          page: 1,
          limit: 0,
          total: 0,
          totalPages: 0,
        },
      })
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auctions',
      },
      { status: 500 }
    )
  }
}
