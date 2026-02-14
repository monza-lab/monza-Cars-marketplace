import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { scrapeAllWithBackfill, type ScrapedAuction } from '@/lib/scrapers'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapStatus(raw: string | undefined): 'ACTIVE' | 'ENDED' {
  if (!raw) return 'ACTIVE'
  const upper = raw.toUpperCase()
  if (upper === 'ENDED' || upper === 'SOLD') return 'ENDED'
  return 'ACTIVE'
}

function mapSourceKey(platform: string): string {
  switch (platform) {
    case 'BRING_A_TRAILER': return 'BaT'
    case 'CARS_AND_BIDS': return 'CarsAndBids'
    case 'COLLECTING_CARS': return 'CollectingCars'
    default: return platform
  }
}

function mapSupabaseStatus(raw: string | undefined): string {
  if (!raw) return 'active'
  const upper = raw.toUpperCase()
  if (upper === 'SOLD') return 'sold'
  if (upper === 'ENDED' || upper === 'NO_SALE') return 'unsold'
  return 'active'
}

function mapAuctionHouse(platform: string): string {
  switch (platform) {
    case 'BRING_A_TRAILER': return 'Bring a Trailer'
    case 'CARS_AND_BIDS': return 'Cars & Bids'
    case 'COLLECTING_CARS': return 'Collecting Cars'
    default: return platform
  }
}

async function upsertToSupabase(auction: ScrapedAuction): Promise<void> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return

  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const status = mapSupabaseStatus(auction.status)
  const hammerPrice = status === 'sold' ? auction.currentBid : null
  const saleDate = auction.endTime
    ? new Date(auction.endTime).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const row = {
    source: mapSourceKey(auction.platform),
    source_id: auction.externalId,
    source_url: auction.url,
    year: auction.year,
    make: auction.make,
    model: auction.model,
    trim: null,
    body_style: null,
    color_exterior: auction.exteriorColor ?? null,
    color_interior: auction.interiorColor ?? null,
    mileage: auction.mileage ?? null,
    mileage_unit: auction.mileageUnit ?? 'miles',
    vin: auction.vin ?? null,
    hammer_price: hammerPrice,
    original_currency: 'USD',
    country: 'USA',
    region: null,
    city: auction.location ?? null,
    auction_house: mapAuctionHouse(auction.platform),
    auction_date: saleDate,
    sale_date: saleDate,
    status,
    photos_count: auction.images?.length ?? 0,
    description_text: auction.description ?? null,
    scrape_timestamp: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('listings')
    .upsert(row, { onConflict: 'source,source_id' })
    .select('id')
    .limit(1)

  if (error) {
    console.error(`[cron] Supabase upsert failed for ${auction.externalId}:`, error.message)
    return
  }

  const listingId = (data as Array<{ id: string }> | null)?.[0]?.id
  if (!listingId) return

  // Upsert photos
  const photos = auction.images?.length
    ? auction.images
    : auction.imageUrl
      ? [auction.imageUrl]
      : []

  if (photos.length > 0) {
    const existing = await supabase
      .from('photos_media')
      .select('photo_url')
      .eq('listing_id', listingId)
    const existingSet = new Set((existing.data ?? []).map((r: { photo_url: string }) => r.photo_url))

    const toInsert = photos
      .filter((p) => p && !existingSet.has(p))
      .map((p, idx) => ({
        listing_id: listingId,
        photo_url: p,
        photo_order: idx,
      }))

    if (toInsert.length > 0) {
      await supabase.from('photos_media').insert(toInsert)
    }
  }

  // Insert price history snapshot
  if (auction.currentBid != null && auction.currentBid > 0) {
    const time = new Date().toISOString().replace(/:\d{2}\.\d{3}Z$/, ':00:00.000Z')
    const exists = await supabase
      .from('price_history')
      .select('time')
      .eq('listing_id', listingId)
      .eq('time', time)
      .limit(1)

    if (!exists.data?.length) {
      await supabase.from('price_history').insert({
        time,
        listing_id: listingId,
        status,
        price_usd: auction.currentBid,
      })
    }
  }
}

export async function GET(request: Request) {
  const startTime = Date.now()

  try {
    const authHeader = request.headers.get('authorization')
    const cronSecret = process.env.CRON_SECRET

    if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const errors: string[] = []

    // Step 1: Run all scrapers
    let auctionsFound = 0
    let auctionsUpdated = 0

    let historicalBackfillResult = { modelsProcessed: 0, totalAuctionsAdded: 0 };

    try {
      const scrapeResult = await scrapeAllWithBackfill()
      const scrapedAuctions = scrapeResult.auctions
      errors.push(...scrapeResult.errors)
      auctionsFound = scrapedAuctions.length

      // Capture historical backfill results if available
      if (scrapeResult.historicalBackfill) {
        historicalBackfillResult = scrapeResult.historicalBackfill
        errors.push(...scrapeResult.historicalBackfill.errors)
      }

      for (const auction of scrapedAuctions) {
        try {
          const images = auction.images?.length
            ? auction.images
            : auction.imageUrl
              ? [auction.imageUrl]
              : []

          await prisma.auction.upsert({
            where: { externalId: auction.externalId },
            update: {
              title: auction.title,
              make: auction.make,
              model: auction.model,
              year: auction.year,
              mileage: auction.mileage,
              currentBid: auction.currentBid,
              bidCount: auction.bidCount ?? 0,
              endTime: auction.endTime ? new Date(auction.endTime) : null,
              url: auction.url,
              images,
              description: auction.description,
              transmission: auction.transmission,
              engine: auction.engine,
              exteriorColor: auction.exteriorColor,
              interiorColor: auction.interiorColor,
              location: auction.location,
              status: mapStatus(auction.status),
              scrapedAt: new Date(),
            },
            create: {
              externalId: auction.externalId,
              platform: auction.platform,
              title: auction.title,
              make: auction.make,
              model: auction.model,
              year: auction.year,
              mileage: auction.mileage,
              mileageUnit: auction.mileageUnit ?? 'miles',
              currentBid: auction.currentBid,
              bidCount: auction.bidCount ?? 0,
              endTime: auction.endTime ? new Date(auction.endTime) : null,
              url: auction.url,
              images,
              description: auction.description,
              sellerNotes: auction.sellerNotes,
              transmission: auction.transmission,
              engine: auction.engine,
              exteriorColor: auction.exteriorColor,
              interiorColor: auction.interiorColor,
              location: auction.location,
              vin: auction.vin,
              status: mapStatus(auction.status),
            },
          })
          auctionsUpdated++

          // Parallel write to Supabase (non-blocking — Prisma is still the primary for this route)
          try {
            await upsertToSupabase(auction)
          } catch (supaErr) {
            // Non-critical: Supabase write failure should not block the cron
            const msg = supaErr instanceof Error ? supaErr.message : 'Unknown Supabase error'
            errors.push(`Supabase write failed for ${auction.externalId}: ${msg}`)
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Unknown DB error'
          errors.push(`Upsert failed for ${auction.externalId}: ${message}`)
        }
      }

      // Record price history
      for (const auction of scrapedAuctions) {
        if (auction.currentBid != null) {
          try {
            const dbAuction = await prisma.auction.findUnique({
              where: { externalId: auction.externalId },
              select: { id: true },
            })

            if (dbAuction) {
              await prisma.priceHistory.create({
                data: {
                  auctionId: dbAuction.id,
                  bid: auction.currentBid,
                },
              })
            }
          } catch {
            // Price history is non-critical
          }
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown scraping error'
      errors.push(`Scraping failed: ${message}`)
    }

    // Step 2: Update market data aggregations
    let aggregationsUpdated = 0

    try {
      // Mark expired auctions as ENDED
      await prisma.auction.updateMany({
        where: {
          status: 'ACTIVE',
          endTime: { lt: new Date() },
        },
        data: { status: 'ENDED' },
      })

      // Compute average prices by make/model
      const makeModelGroups = await prisma.auction.groupBy({
        by: ['make', 'model'],
        _avg: { currentBid: true },
        _count: { id: true },
        _min: { currentBid: true },
        _max: { currentBid: true },
      })

      for (const group of makeModelGroups) {
        try {
          await prisma.marketData.upsert({
            where: {
              make_model_yearStart_yearEnd: {
                make: group.make,
                model: group.model,
                yearStart: 0,
                yearEnd: 0,
              },
            },
            update: {
              avgPrice: group._avg.currentBid,
              lowPrice: group._min.currentBid,
              highPrice: group._max.currentBid,
              totalSales: group._count.id,
              lastUpdated: new Date(),
            },
            create: {
              make: group.make,
              model: group.model,
              yearStart: 0,
              yearEnd: 0,
              avgPrice: group._avg.currentBid,
              lowPrice: group._min.currentBid,
              highPrice: group._max.currentBid,
              totalSales: group._count.id,
            },
          })
          aggregationsUpdated++
        } catch {
          // Non-critical
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown aggregation error'
      errors.push(`Market data update failed: ${message}`)
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        scrapingResults: { auctionsFound, auctionsUpdated, errors },
        historicalBackfill: historicalBackfillResult,
        marketDataUpdate: { aggregationsUpdated },
        duration: `${duration}ms`,
      },
    })
  } catch (error) {
    console.error('Cron job error:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Cron job failed',
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    )
  }
}
