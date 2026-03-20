import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { fetchPricedListingsForModel, fetchLiveListingById } from "@/lib/supabaseLiveListings"
import { extractSeries, getSeriesThesis } from "@/lib/brandConfig"
import { computeMarketStatsForCar } from "@/lib/marketStats"
import { getExchangeRates } from "@/lib/exchangeRates"
import { analyzeForReport } from "@/lib/ai/analyzer"
import {
  getReportForListing,
  saveReport,
  getOrCreateUser,
  hasAlreadyGenerated,
  deductCredit,
  checkAndResetFreeCredits,
} from "@/lib/reports/queries"

interface AnalyzeRequestBody {
  listingId: string
}

export async function POST(request: Request) {
  try {
    // 1. Auth
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { success: false, error: "AUTH_REQUIRED", message: "Please sign in to generate reports" },
        { status: 401 },
      )
    }

    const body: AnalyzeRequestBody = await request.json()
    if (!body.listingId) {
      return NextResponse.json({ success: false, error: "listingId is required" }, { status: 400 })
    }

    // 2. Get/create user + reset credits if needed
    const dbUser = await getOrCreateUser(authUser.id, authUser.email!, authUser.user_metadata?.full_name)
    const user = await checkAndResetFreeCredits(dbUser.id)

    // 3. Check if user already generated this report (free re-access)
    const alreadyGenerated = await hasAlreadyGenerated(user.id, body.listingId)

    // 4. Check existing report
    const existingReport = await getReportForListing(body.listingId)
    if (existingReport && existingReport.investment_grade) {
      return NextResponse.json({
        success: true,
        data: existingReport,
        cached: true,
        creditUsed: 0,
        creditsRemaining: user.credits_balance,
      })
    }

    // 5. Credits check (if not already generated and no cached report)
    if (!alreadyGenerated && user.credits_balance < 1) {
      return NextResponse.json(
        {
          success: false,
          error: "INSUFFICIENT_CREDITS",
          message: "You have no report credits remaining.",
          creditsRemaining: 0,
        },
        { status: 402 },
      )
    }

    // 6. Fetch the car
    const car = await fetchLiveListingById(body.listingId)
    if (!car) {
      return NextResponse.json({ success: false, error: "Listing not found" }, { status: 404 })
    }

    // 7. Fetch priced listings and compute market stats (shared helper)
    const allPriced = await fetchPricedListingsForModel(car.make)
    const rates = await getExchangeRates()
    const { marketStats, pricedRecords } = computeMarketStatsForCar(car, allPriced, rates)
    const series = extractSeries(car.model, car.year, car.make)

    // 8. Get brand thesis
    const brandThesis = getSeriesThesis(series, car.make)

    // 9. Call Gemini
    let llmData = null
    try {
      llmData = await analyzeForReport(
        {
          title: car.title,
          year: car.year,
          make: car.make,
          model: car.model,
          trim: car.trim,
          mileage: car.mileage,
          mileageUnit: car.mileageUnit,
          transmission: car.transmission,
          engine: car.engine,
          exteriorColor: car.exteriorColor,
          interiorColor: car.interiorColor,
          location: car.location,
          price: car.price,
          vin: car.vin,
          description: car.description,
          sellerNotes: car.sellerNotes,
          platform: car.platform,
          sourceUrl: car.sourceUrl,
        },
        marketStats?.regions ?? [],
        pricedRecords.slice(0, 60),
        brandThesis,
      )
    } catch (geminiError) {
      console.error("[analyze] Gemini failed:", geminiError)
      // Continue with market stats only
    }

    // 10. Save report
    const report = await saveReport(body.listingId, marketStats, llmData)

    // 11. Deduct credit
    let creditUsed = 0
    if (!alreadyGenerated) {
      const creditResult = await deductCredit(user.id, body.listingId, report.id)
      if (creditResult.success) {
        creditUsed = creditResult.creditUsed
      }
    }

    return NextResponse.json({
      success: true,
      data: report,
      cached: false,
      creditUsed,
      creditsRemaining: user.credits_balance - creditUsed,
      geminiUsed: !!llmData,
    })
  } catch (error) {
    console.error("Error analyzing listing:", error)

    if (error instanceof SyntaxError) {
      return NextResponse.json({ success: false, error: "Invalid JSON in request body" }, { status: 400 })
    }

    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : "Failed to generate report" },
      { status: 500 },
    )
  }
}
