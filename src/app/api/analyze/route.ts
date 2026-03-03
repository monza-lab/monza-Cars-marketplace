import { NextResponse } from 'next/server'
import { dbQuery } from '@/lib/db/sql'
import { analyzeAuction } from '@/lib/ai/analyzer'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser, deductCredit, hasAlreadyAnalyzed } from '@/lib/credits'

interface AnalyzeRequestBody {
  auctionId: string
}

const ANALYSIS_CACHE_HOURS = 24

export async function POST(request: Request) {
  try {
    // Check authentication
    const supabase = await createClient()
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        {
          success: false,
          error: 'AUTH_REQUIRED',
          message: 'Please sign in to analyze auctions',
        },
        { status: 401 }
      )
    }

    const body: AnalyzeRequestBody = await request.json()

    if (!body.auctionId) {
      return NextResponse.json(
        {
          success: false,
          error: 'auctionId is required',
        },
        { status: 400 }
      )
    }

    // Get or create user in our database
    const dbUser = await getOrCreateUser(
      authUser.id,
      authUser.email!,
      authUser.user_metadata?.full_name
    )

    // Fetch the auction from the database
    const auctionResult = await dbQuery<Record<string, unknown>>('SELECT * FROM "Auction" WHERE id = $1 LIMIT 1', [body.auctionId])
    const auction = auctionResult.rows[0]

    if (!auction) {
      return NextResponse.json(
        {
          success: false,
          error: 'Auction not found',
        },
        { status: 404 }
      )
    }

    // Check if user has already analyzed this auction (free re-access)
    const alreadyAnalyzed = await hasAlreadyAnalyzed(dbUser.id, body.auctionId)

    // Check if a recent analysis already exists (within cache window)
    const analysisLookup = await dbQuery<Record<string, unknown>>('SELECT * FROM "Analysis" WHERE "auctionId" = $1 LIMIT 1', [body.auctionId])
    const existingAnalysis = analysisLookup.rows[0]

    if (existingAnalysis) {
      const analysisAge =
        Date.now() - new Date(String(existingAnalysis.createdAt)).getTime()
      const cacheThreshold = ANALYSIS_CACHE_HOURS * 60 * 60 * 1000

      if (analysisAge < cacheThreshold) {
        return NextResponse.json({
          success: true,
          data: existingAnalysis,
          cached: true,
          creditUsed: 0,
          creditsRemaining: dbUser.creditsBalance,
        })
      }
    }

    // If new analysis needed and user hasn't analyzed before, check credits
    if (!alreadyAnalyzed && dbUser.creditsBalance < 1) {
      return NextResponse.json(
        {
          success: false,
          error: 'INSUFFICIENT_CREDITS',
          message: 'You have no analysis credits remaining. Purchase more to continue.',
          creditsRemaining: 0,
        },
        { status: 402 }
      )
    }

    // Fetch comparables linked to this auction + market data for context
    const [auctionComparables, marketDataRecords] = await Promise.all([
      dbQuery<Record<string, unknown>>(
        'SELECT * FROM "Comparable" WHERE "auctionId" = $1 ORDER BY "soldDate" DESC NULLS LAST LIMIT 10',
        [auction.id],
      ),
      dbQuery<Record<string, unknown>>(
        'SELECT * FROM "MarketData" WHERE make ILIKE $1 AND model ILIKE $2 ORDER BY "lastUpdated" DESC LIMIT 5',
        [auction.make, auction.model],
      ),
    ])

    // Format vehicle data and market data for the AI prompt
    const vehicleData = {
      id: String(auction.id),
      title: String(auction.title ?? ''),
      make: String(auction.make ?? ''),
      model: String(auction.model ?? ''),
      year: Number(auction.year ?? 0),
      mileage: (auction.mileage as number | null) ?? null,
      platform: String(auction.platform ?? ''),
      currentBid: (auction.currentBid as number | null) ?? null,
      endTime: (auction.endTime as string | Date | null | undefined) ?? null,
      description: (auction.description as string | null) ?? null,
      url: String(auction.url ?? ''),
      imageUrl: Array.isArray(auction.images) ? (auction.images[0] as string | undefined) ?? null : null,
    }

    const marketData = {
      comparableSales: auctionComparables.rows.map((comp) => ({
        title: String(comp.title ?? ''),
        mileage: comp.mileage as number | null,
        soldPrice: comp.soldPrice as number,
        soldDate: (comp.soldDate as string | Date | null | undefined) ?? null,
        platform: String(comp.platform ?? ''),
        condition: comp.condition as string | null,
      })),
      marketContext: marketDataRecords.rows.map((m) => ({
        avgPrice: m.avgPrice as number | null,
        medianPrice: m.medianPrice as number | null,
        totalSales: m.totalSales as number,
        trend: m.trend as string | null,
      })),
      totalComparables: auctionComparables.rows.length,
    }

    // Call the AI analyzer
    const aiAnalysis = await analyzeAuction(vehicleData, marketData)

    // Save or update the analysis in the database
    // Map analysis result fields to the persisted analysis columns
    const analysisData = {
      bidTargetLow: aiAnalysis.fairValueLow ?? null,
      bidTargetHigh: aiAnalysis.fairValueHigh ?? null,
      confidence: aiAnalysis.confidenceScore >= 0.8 ? 'HIGH' as const : aiAnalysis.confidenceScore >= 0.5 ? 'MEDIUM' as const : 'LOW' as const,
      redFlags: aiAnalysis.redFlags ?? [],
      keyStrengths: aiAnalysis.pros ?? [],
      criticalQuestions: [],
      investmentGrade: aiAnalysis.confidenceScore >= 0.8 ? 'EXCELLENT' as const : aiAnalysis.confidenceScore >= 0.6 ? 'GOOD' as const : aiAnalysis.confidenceScore >= 0.4 ? 'FAIR' as const : 'SPECULATIVE' as const,
      appreciationPotential: aiAnalysis.marketTrend ?? null,
      rawAnalysis: { summary: aiAnalysis.summary, recommendation: aiAnalysis.recommendation, cons: aiAnalysis.cons },
    }

    const savedAnalysisResult = await dbQuery<Record<string, unknown>>(
      `
        INSERT INTO "Analysis" (
          "auctionId", "bidTargetLow", "bidTargetHigh", confidence,
          "redFlags", "keyStrengths", "criticalQuestions", "investmentGrade", "appreciationPotential", "rawAnalysis"
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
        ON CONFLICT ("auctionId") DO UPDATE SET
          "bidTargetLow" = EXCLUDED."bidTargetLow",
          "bidTargetHigh" = EXCLUDED."bidTargetHigh",
          confidence = EXCLUDED.confidence,
          "redFlags" = EXCLUDED."redFlags",
          "keyStrengths" = EXCLUDED."keyStrengths",
          "criticalQuestions" = EXCLUDED."criticalQuestions",
          "investmentGrade" = EXCLUDED."investmentGrade",
          "appreciationPotential" = EXCLUDED."appreciationPotential",
          "rawAnalysis" = EXCLUDED."rawAnalysis"
        RETURNING *
      `,
      [
        auction.id,
        analysisData.bidTargetLow,
        analysisData.bidTargetHigh,
        analysisData.confidence,
        analysisData.redFlags,
        analysisData.keyStrengths,
        analysisData.criticalQuestions,
        analysisData.investmentGrade,
        analysisData.appreciationPotential,
        analysisData.rawAnalysis,
      ],
    )
    const savedAnalysis = savedAnalysisResult.rows[0]

    // Deduct credit if this is a new analysis for this user
    let creditUsed = 0
    if (!alreadyAnalyzed) {
      const creditResult = await deductCredit(dbUser.id, body.auctionId)
      if (creditResult.success) {
        creditUsed = creditResult.creditUsed
      }
    }

    // Get updated credits balance
    const updatedUserResult = await dbQuery<{ creditsBalance: number }>(
      'SELECT "creditsBalance" FROM "User" WHERE id = $1 LIMIT 1',
      [dbUser.id],
    )
    const updatedUser = updatedUserResult.rows[0]

    return NextResponse.json({
      success: true,
      data: savedAnalysis,
      cached: false,
      creditUsed,
      creditsRemaining: updatedUser?.creditsBalance ?? dbUser.creditsBalance,
    })
  } catch (error) {
    console.error('Error analyzing auction:', error)

    if (error instanceof SyntaxError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid JSON in request body',
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to analyze auction',
      },
      { status: 500 }
    )
  }
}
