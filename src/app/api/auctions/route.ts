import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
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

    // Porsche-first default, expandable via explicit make filter.
    const where: Record<string, unknown> = {
      make: { equals: requestedMake ?? resolveRequestedMake(null), mode: 'insensitive' },
    }

    if (platform) {
      where.platform = platform
    }

    if (model) {
      where.model = { equals: model, mode: 'insensitive' }
    }

    if (status) {
      where.status = status
    }

    if (yearMin || yearMax) {
      where.year = {}
      if (yearMin) {
        (where.year as Record<string, number>).gte = parseInt(yearMin, 10)
      }
      if (yearMax) {
        (where.year as Record<string, number>).lte = parseInt(yearMax, 10)
      }
    }

    if (priceMin || priceMax) {
      where.currentBid = {}
      if (priceMin) {
        (where.currentBid as Record<string, number>).gte = parseFloat(priceMin)
      }
      if (priceMax) {
        (where.currentBid as Record<string, number>).lte = parseFloat(priceMax)
      }
    }

    // Search across title, make, and model fields
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
      ]
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

    // Execute count and data queries in parallel
    const [total, auctions] = await withRouteTimeout(
      Promise.all([
        prisma.auction.count({ where }),
        prisma.auction.findMany({
          where,
          orderBy: { [safeSortBy]: sortOrder },
          skip: (page - 1) * limit,
          take: limit,
        }),
      ]),
      '/api/auctions'
    )

    const totalPages = Math.ceil(total / limit)

    return NextResponse.json({
      success: true,
      data: auctions,
      meta: {
        page,
        limit,
        total,
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
