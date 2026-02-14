import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { scrapeAllWithBackfill } from '@/lib/scrapers'

export const dynamic = 'force-dynamic'
export const revalidate = 0

function mapStatus(raw: string | undefined): 'ACTIVE' | 'ENDED' {
  if (!raw) return 'ACTIVE'
  const upper = raw.toUpperCase()
  if (upper === 'ENDED' || upper === 'SOLD') return 'ENDED'
  return 'ACTIVE'
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
