import { NextResponse } from 'next/server'
import { prisma } from '@/lib/db/prisma'
import { createClient } from '@supabase/supabase-js'
import { featuredAuctions } from '@/lib/featuredAuctions'
import { CURATED_CARS } from '@/lib/curatedCars'
import { fetchLiveListingById } from '@/lib/supabaseLiveListings'
import { fetchFerrariHistoricalByModel } from '@/features/ferrari_history/service'
import { isSupportedLiveMake } from '@/lib/makeProfiles'

type ListingPriceHistoryRow = {
  time: string
  status: string | null
  price_usd: number | null
  price_eur: number | null
  price_gbp: number | null
}

async function fetchListingPriceHistory(liveId: string): Promise<Array<{ id: string; bid: number; timestamp: string; status: string | null }>> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!url || !key) return []

  const listingId = liveId.startsWith('live-') ? liveId.slice(5) : liveId
  const supabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase
    .from('price_history')
    .select('time,status,price_usd,price_eur,price_gbp')
    .eq('listing_id', listingId)
    .order('time', { ascending: true })

  if (error || !data) return []

  return (data as ListingPriceHistoryRow[]).map((row, idx) => ({
    id: `ph-${idx}`,
    bid: row.price_usd ?? row.price_eur ?? row.price_gbp ?? 0,
    timestamp: row.time,
    status: row.status,
  }))
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    // Check if this is a live listing from Supabase (id starts with "live-")
    if (id.startsWith("live-")) {
      const liveCar = await fetchLiveListingById(id)
      if (liveCar && isSupportedLiveMake(liveCar.make)) {
        const requestId = request.headers.get('x-request-id') ?? crypto.randomUUID()
        let comparables: Array<Record<string, unknown>> = []
        let priceHistory: Array<{ id: string; bid: number; timestamp: string; status?: string | null }> = []

        if (liveCar.make.toLowerCase() === 'ferrari') {
          const ferrariHistory = await fetchFerrariHistoricalByModel(
            { make: liveCar.make, model: liveCar.model, months: 12, limit: 120 },
            { requestId }
          )
          comparables = ferrariHistory.isFerrariContext ? ferrariHistory.comparables : []
          priceHistory = ferrariHistory.isFerrariContext ? ferrariHistory.priceHistory : []
        } else {
          priceHistory = await fetchListingPriceHistory(liveCar.id)
        }

        return NextResponse.json({
          success: true,
          data: {
            id: liveCar.id,
            externalId: liveCar.id,
            platform: liveCar.platform,
            url: liveCar.sourceUrl ?? "",
            title: liveCar.title,
            make: liveCar.make,
            model: liveCar.model,
            year: liveCar.year,
            trim: liveCar.trim,
            vin: liveCar.vin ?? null,
            mileage: liveCar.mileage || null,
            mileageUnit: liveCar.mileageUnit,
            transmission: liveCar.transmission !== "\u2014" ? liveCar.transmission : null,
            engine: liveCar.engine !== "\u2014" ? liveCar.engine : null,
            exteriorColor: liveCar.exteriorColor ?? null,
            interiorColor: liveCar.interiorColor ?? null,
            location: liveCar.location,
            currentBid: liveCar.currentBid,
            reserveStatus: null,
            bidCount: liveCar.bidCount,
            viewCount: 0,
            watchCount: 0,
            startTime: null,
            endTime: liveCar.endTime.toISOString(),
            status: liveCar.status,
            finalPrice: liveCar.status === "ENDED" ? liveCar.currentBid : null,
            description: liveCar.description ?? liveCar.thesis,
            sellerNotes: liveCar.history,
            images: liveCar.images,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            scrapedAt: new Date().toISOString(),
            analysis: null,
            comparables,
            priceHistory,
          },
        })
      }
    }

    // Check if this is a curated car — exclude curated Ferraris (only real DB data for Ferrari)
    const curatedCar = CURATED_CARS.find(car => car.id === id && car.make === "Porsche")
    if (curatedCar) {
      return NextResponse.json({
        success: true,
        data: {
          id: curatedCar.id,
          externalId: curatedCar.id,
          platform: curatedCar.platform,
          url: `https://example.com/auction/${curatedCar.id}`,
          title: curatedCar.title,
          make: curatedCar.make,
          model: curatedCar.model,
          year: curatedCar.year,
          trim: curatedCar.trim,
          vin: null,
          mileage: curatedCar.mileage,
          mileageUnit: curatedCar.mileageUnit,
          transmission: curatedCar.transmission,
          engine: curatedCar.engine,
          exteriorColor: null,
          interiorColor: null,
          location: curatedCar.location,
          currentBid: curatedCar.currentBid,
          reserveStatus: null,
          bidCount: curatedCar.bidCount,
          viewCount: 15000,
          watchCount: 800,
          startTime: null,
          endTime: curatedCar.endTime.toISOString(),
          status: curatedCar.status,
          finalPrice: curatedCar.status === "ENDED" ? curatedCar.currentBid : null,
          description: curatedCar.thesis,
          sellerNotes: curatedCar.history,
          images: curatedCar.images,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
          analysis: {
            id: `analysis-${curatedCar.id}`,
            auctionId: curatedCar.id,
            bidTargetLow: Math.floor(curatedCar.currentBid * 0.92),
            bidTargetHigh: Math.floor(curatedCar.currentBid * 1.08),
            confidence: "HIGH",
            criticalQuestions: [],
            redFlags: [],
            keyStrengths: [curatedCar.thesis.split('.')[0]],
            yearlyMaintenance: null,
            insuranceEstimate: null,
            majorServiceCost: null,
            investmentGrade: curatedCar.investmentGrade === "AAA" ? "EXCELLENT" : curatedCar.investmentGrade === "AA" ? "GOOD" : "FAIR",
            appreciationPotential: curatedCar.trend,
            rawAnalysis: { summary: curatedCar.thesis, recommendation: "Strong buy for serious collectors" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          comparables: [],
          priceHistory: [],
        },
      })
    }

    // Check if this is a featured auction — exclude featured Ferraris (only real DB data)
    const featuredAuction = featuredAuctions.find(fa => fa.id === id && fa.make === "Porsche")
    if (featuredAuction) {
      // Transform featured auction to match DB auction format
      return NextResponse.json({
        success: true,
        data: {
          id: featuredAuction.id,
          externalId: featuredAuction.id,
          platform: featuredAuction.platform,
          url: featuredAuction.platformUrl,
          title: featuredAuction.title,
          make: featuredAuction.make,
          model: featuredAuction.model,
          year: featuredAuction.year,
          trim: featuredAuction.trim,
          vin: null,
          mileage: featuredAuction.mileage,
          mileageUnit: featuredAuction.mileageUnit,
          transmission: featuredAuction.transmission,
          engine: featuredAuction.engine,
          exteriorColor: featuredAuction.exteriorColor,
          interiorColor: featuredAuction.interiorColor,
          location: featuredAuction.location,
          currentBid: featuredAuction.currentBid,
          reserveStatus: null,
          bidCount: featuredAuction.bidCount,
          viewCount: 15000,
          watchCount: 800,
          startTime: null,
          endTime: featuredAuction.endTime,
          status: featuredAuction.status === "SOLD" ? "ENDED" : featuredAuction.status,
          finalPrice: featuredAuction.status === "SOLD" ? featuredAuction.currentBid : null,
          description: featuredAuction.provenance,
          sellerNotes: featuredAuction.highlight,
          images: featuredAuction.images,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          scrapedAt: new Date().toISOString(),
          analysis: {
            id: `analysis-${featuredAuction.id}`,
            auctionId: featuredAuction.id,
            bidTargetLow: Math.floor(featuredAuction.currentBid * 0.92),
            bidTargetHigh: Math.floor(featuredAuction.currentBid * 1.08),
            confidence: "HIGH",
            criticalQuestions: [],
            redFlags: [],
            keyStrengths: [featuredAuction.highlight],
            yearlyMaintenance: null,
            insuranceEstimate: null,
            majorServiceCost: null,
            investmentGrade: featuredAuction.investmentGrade === "AAA" ? "EXCELLENT" : featuredAuction.investmentGrade === "AA" ? "GOOD" : "FAIR",
            appreciationPotential: "+8% Annually",
            rawAnalysis: { summary: featuredAuction.provenance, recommendation: "Strong buy for serious collectors" },
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          comparables: [],
          priceHistory: [],
        },
      })
    }

    // Otherwise, fetch from database
    const auction = await prisma.auction.findUnique({
      where: { id },
      include: {
        analysis: true,
        comparables: true,
        priceHistory: {
          orderBy: { timestamp: 'asc' },
        },
      },
    })

    if (!auction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Auction not found',
        },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      data: auction,
    })
  } catch (error) {
    console.error('Error fetching auction:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch auction',
      },
      { status: 500 }
    )
  }
}
