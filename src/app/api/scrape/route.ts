// ═══════════════════════════════════════════════════════════════════════════
// MONZA LAB: SCRAPER API
// Zero-cost price fetching using CSS selectors — NO LLM TOKENS
// ═══════════════════════════════════════════════════════════════════════════

import { NextRequest, NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db/sql'
import { scrapeAll, scrapePlatform, type ScrapedAuction } from '@/features/scrapers/auctions'
import {
  fetchAuctionData,
  getCacheStats,
  cleanCache,
  getCachedData,
} from '@/features/scrapers/common/scraper'

function mapStatus(raw: string | undefined): 'ACTIVE' | 'ENDED' {
  if (!raw) return 'ACTIVE'
  const upper = raw.toUpperCase()
  if (upper === 'ENDED' || upper === 'SOLD') return 'ENDED'
  return 'ACTIVE'
}

// Allowed auction platform domains for scraping
const ALLOWED_SCRAPE_DOMAINS = [
  'bringatrailer.com',
  'rmsothebys.com',
  'carsandbids.com',
  'collectingcars.com',
  'autoscout24.com',
  'classic.com',
  'beforward.jp',
  'autotrader.co.uk',
]

function isAllowedScrapeUrl(raw: string): boolean {
  try {
    const parsed = new URL(raw)
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false
    const host = parsed.hostname.toLowerCase()
    return ALLOWED_SCRAPE_DOMAINS.some(
      (d) => host === d || host.endsWith(`.${d}`)
    )
  } catch {
    return false
  }
}

// ─── GET: Zero-cost price fetch for a single URL ───
export async function GET(request: NextRequest) {
  // Auth check — prevent unauthenticated SSRF
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized' },
      { status: 401 }
    )
  }

  const url = request.nextUrl.searchParams.get("url")
  const forceRefresh = request.nextUrl.searchParams.get("refresh") === "true"
  const statsOnly = request.nextUrl.searchParams.get("stats") === "true"

  // Return cache stats if requested
  if (statsOnly) {
    const stats = getCacheStats()
    return NextResponse.json({
      success: true,
      cache: stats,
    })
  }

  if (!url) {
    return NextResponse.json(
      { success: false, error: "Missing 'url' parameter" },
      { status: 400 }
    )
  }

  if (!isAllowedScrapeUrl(url)) {
    return NextResponse.json(
      { success: false, error: "URL domain not allowed" },
      { status: 403 }
    )
  }

  try {
    // Check if we have recent data in DB first (persistent cache)
    const existingAuctionResult = await dbQuery<Record<string, unknown>>(
      'SELECT id, "currentBid", "bidCount", status, "scrapedAt" FROM "Auction" WHERE url = $1 LIMIT 1',
      [url],
    )
    const existingAuction = existingAuctionResult.rows[0]

    // If DB data is less than 24 hours old, return it (skip scraping)
    if (existingAuction && !forceRefresh) {
      const ageMs = Date.now() - new Date(String(existingAuction.scrapedAt)).getTime()
      const maxAgeMs = 24 * 60 * 60 * 1000 // 24 hours

      if (ageMs < maxAgeMs) {
        return NextResponse.json({
          success: true,
          source: "database",
          cached: true,
          ageHours: Math.round(ageMs / (60 * 60 * 1000) * 10) / 10,
          data: {
            currentBid: existingAuction.currentBid as number | null,
            bidCount: existingAuction.bidCount as number | null,
            status: existingAuction.status as string,
            scrapedAt: existingAuction.scrapedAt,
          },
        })
      }
    }

    // Fetch fresh data using the zero-cost scraper
    const scrapedData = await fetchAuctionData(url, forceRefresh)

    // Update DB if we got valid data
    if (scrapedData.currentBid !== null && existingAuction) {
      await dbQuery(
        `
          UPDATE "Auction"
          SET "currentBid" = $2,
              "bidCount" = COALESCE($3, "bidCount"),
              status = COALESCE($4, status),
              "scrapedAt" = NOW(),
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [
          existingAuction.id,
          scrapedData.currentBid,
          scrapedData.bidCount ?? null,
          scrapedData.status === 'SOLD' ? 'ENDED' : scrapedData.status ?? null,
        ],
      )
    }

    return NextResponse.json({
      success: true,
      source: "scraper",
      cached: false,
      data: scrapedData,
    })
  } catch (error) {
    console.error("[Scrape API] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Scraping failed",
      },
      { status: 500 }
    )
  }
}

// ─── DELETE: Clear cache ───
export async function DELETE(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const removed = cleanCache()
    return NextResponse.json({
      success: true,
      message: `Removed ${removed} expired cache entries`,
      currentStats: getCacheStats(),
    })
  } catch {
    return NextResponse.json(
      { success: false, error: "Failed to clean cache" },
      { status: 500 }
    )
  }
}

// ─── POST: Full platform scraping (existing functionality) ───
export async function POST(request: Request) {
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

    const body = await request.json().catch(() => ({}))

    let scrapedAuctions: ScrapedAuction[]
    const errors: string[] = []

    if (body.platform) {
      try {
        scrapedAuctions = await scrapePlatform(body.platform)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown scraping error'
        errors.push(`${body.platform}: ${message}`)
        scrapedAuctions = []
      }
    } else {
      const result = await scrapeAll()
      scrapedAuctions = result.auctions
      errors.push(...result.errors)
    }

    let auctionsUpdated = 0

    for (const auction of scrapedAuctions) {
      try {
        const images = auction.images?.length
          ? auction.images
          : auction.imageUrl
            ? [auction.imageUrl]
            : []

        await dbQuery(
          `
            INSERT INTO "Auction" (
              "externalId", platform, url, title, make, model, year, mileage, "mileageUnit",
              "currentBid", "bidCount", "endTime", images, description, "sellerNotes",
              transmission, engine, "exteriorColor", "interiorColor", location, vin, status, "scrapedAt", "updatedAt"
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,NOW(),NOW())
            ON CONFLICT ("externalId") DO UPDATE SET
              title = EXCLUDED.title,
              make = EXCLUDED.make,
              model = EXCLUDED.model,
              year = EXCLUDED.year,
              mileage = EXCLUDED.mileage,
              "currentBid" = EXCLUDED."currentBid",
              "bidCount" = EXCLUDED."bidCount",
              "endTime" = EXCLUDED."endTime",
              url = EXCLUDED.url,
              images = EXCLUDED.images,
              description = EXCLUDED.description,
              transmission = EXCLUDED.transmission,
              engine = EXCLUDED.engine,
              "exteriorColor" = EXCLUDED."exteriorColor",
              "interiorColor" = EXCLUDED."interiorColor",
              location = EXCLUDED.location,
              status = EXCLUDED.status,
              "scrapedAt" = NOW(),
              "updatedAt" = NOW()
          `,
          [
            auction.externalId,
            auction.platform,
            auction.url,
            auction.title,
            auction.make,
            auction.model,
            auction.year,
            auction.mileage,
            auction.mileageUnit ?? 'miles',
            auction.currentBid,
            auction.bidCount ?? 0,
            auction.endTime ? new Date(auction.endTime) : null,
            images,
            auction.description,
            auction.sellerNotes,
            auction.transmission,
            auction.engine,
            auction.exteriorColor,
            auction.interiorColor,
            auction.location,
            auction.vin,
            mapStatus(auction.status),
          ],
        )
        auctionsUpdated++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown DB error'
        errors.push(`Failed to upsert ${auction.externalId}: ${message}`)
      }
    }

    // Record price history
    for (const auction of scrapedAuctions) {
      if (auction.currentBid != null) {
        try {
          const dbAuction = await dbQuery<{ id: string }>('SELECT id FROM "Auction" WHERE "externalId" = $1 LIMIT 1', [auction.externalId])

          if (dbAuction.rows[0]) {
            await dbQuery('INSERT INTO "PriceHistory" ("auctionId", bid) VALUES ($1, $2)', [dbAuction.rows[0].id, auction.currentBid])
          }
        } catch {
          // Price history is non-critical
        }
      }
    }

    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      data: {
        auctionsFound: scrapedAuctions.length,
        auctionsUpdated,
        errors,
        duration: `${duration}ms`,
      },
    })
  } catch (error) {
    console.error('Error during scraping:', error)

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to run scraper',
        duration: `${Date.now() - startTime}ms`,
      },
      { status: 500 }
    )
  }
}
