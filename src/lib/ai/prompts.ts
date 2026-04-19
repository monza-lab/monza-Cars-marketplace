import type { RegionalMarketStats, PricedListingRecord } from "@/lib/reports/types"

// ---------------------------------------------------------------------------
// AI Prompts for Vehicle Analysis
// ---------------------------------------------------------------------------
// Structured prompts that instruct Claude to return JSON responses for
// vehicle analysis, market summaries, and investment outlooks.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// System prompt (shared context for all analysis calls)
// ---------------------------------------------------------------------------

export const ANALYSIS_SYSTEM_PROMPT = `You are Monza Lab AI, an expert automotive analyst specializing in collector cars, enthusiast vehicles, and online car auctions. You have deep knowledge of:

- Auction platforms (Bring a Trailer, Cars & Bids, Collecting Cars)
- Vehicle valuations, market trends, and price history
- Mechanical reliability, common issues, and maintenance costs for specific makes/models
- Investment potential of collector and enthusiast vehicles
- What to look for (and avoid) when buying at auction

You always respond with valid JSON when asked to do so. You are honest about uncertainty and clearly state when you are making estimates vs citing known data. You flag potential red flags without being alarmist.`;

// ---------------------------------------------------------------------------
// Vehicle Analysis Prompt
// ---------------------------------------------------------------------------

/**
 * Build the main vehicle analysis prompt.
 * The AI is asked to return a structured JSON object with bid targets,
 * red flags, strengths, ownership costs, and investment outlook.
 */
export function buildVehicleAnalysisPrompt(
  vehicleData: {
    title: string;
    make: string;
    model: string;
    year: number;
    mileage?: number | null;
    transmission?: string | null;
    engine?: string | null;
    exteriorColor?: string | null;
    interiorColor?: string | null;
    location?: string | null;
    currentBid?: number | null;
    endTime?: string | Date | null;
    description?: string | null;
    sellerNotes?: string | null;
    platform: string;
    url: string;
    vin?: string | null;
  },
  marketData?: {
    comparableSales?: Array<{
      title: string;
      soldPrice: number;
      soldDate?: string | null;
      mileage?: number | null;
      platform?: string;
      condition?: string | null;
    }>;
    totalComparables?: number;
  },
): string {
  const comparablesSection = marketData?.comparableSales?.length
    ? `
COMPARABLE SALES DATA:
${marketData.comparableSales
  .map(
    (c, i) =>
      `${i + 1}. ${c.title} - Sold for $${c.soldPrice?.toLocaleString() ?? 'N/A'}${c.soldDate ? ` on ${c.soldDate}` : ''}${c.mileage ? ` (${c.mileage.toLocaleString()} mi)` : ''}${c.platform ? ` [${c.platform}]` : ''}${c.condition ? ` - Condition: ${c.condition}` : ''}`,
  )
  .join('\n')}
Total comparable sales in database: ${marketData.totalComparables ?? marketData.comparableSales.length}
`
    : `
COMPARABLE SALES DATA:
No comparable sales data available. Please estimate based on your knowledge of the market.
`;

  return `Analyze this vehicle auction listing and provide a comprehensive buyer advisory.

VEHICLE DATA:
- Title: ${vehicleData.title}
- Year: ${vehicleData.year}
- Make: ${vehicleData.make}
- Model: ${vehicleData.model}
- Mileage: ${vehicleData.mileage != null ? `${vehicleData.mileage.toLocaleString()}` : 'Not specified'}
- Transmission: ${vehicleData.transmission || 'Not specified'}
- Engine: ${vehicleData.engine || 'Not specified'}
- Exterior Color: ${vehicleData.exteriorColor || 'Not specified'}
- Interior Color: ${vehicleData.interiorColor || 'Not specified'}
- Location: ${vehicleData.location || 'Not specified'}
- VIN: ${vehicleData.vin || 'Not provided'}
- Platform: ${vehicleData.platform}
- Current Bid: ${vehicleData.currentBid != null ? `$${vehicleData.currentBid.toLocaleString()}` : 'No bids yet'}
- Auction End: ${vehicleData.endTime || 'Not specified'}
- URL: ${vehicleData.url}

LISTING DESCRIPTION:
${vehicleData.description || 'No description available.'}

SELLER NOTES:
${vehicleData.sellerNotes || 'No seller notes available.'}

${comparablesSection}

INSTRUCTIONS:
Analyze this listing thoroughly and respond with ONLY a valid JSON object (no markdown fences, no explanation outside the JSON). Use this exact structure:

{
  "bidTarget": {
    "low": <number - conservative fair value in USD>,
    "high": <number - aggressive fair value in USD>,
    "confidence": "<HIGH|MEDIUM|LOW>",
    "reasoning": "<string - 2-3 sentences explaining the valuation range>"
  },
  "criticalQuestions": [
    "<string - important question a buyer should ask the seller before bidding>"
  ],
  "redFlags": [
    "<string - potential concern or risk identified in the listing>"
  ],
  "keyStrengths": [
    "<string - positive aspect of this vehicle or listing>"
  ],
  "ownershipCosts": {
    "yearlyMaintenance": <number - estimated annual maintenance cost in USD>,
    "insuranceEstimate": <number - estimated annual insurance cost in USD>,
    "majorService": {
      "description": "<string - what the next major service would be>",
      "estimatedCost": <number - estimated cost in USD>,
      "intervalMiles": <number - miles between major services>
    }
  },
  "investmentOutlook": {
    "trend": "<APPRECIATING|STABLE|DECLINING>",
    "reasoning": "<string - 2-3 sentences explaining the investment outlook>"
  },
  "comparableAnalysis": "<string - 2-3 paragraph analysis of how this vehicle compares to recent sales, what drives its value, and whether the current bid represents good value>"
}

Be specific to THIS exact vehicle. Reference known issues for the ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}. If the mileage, condition, or options are unusual, factor that into your analysis. If information is missing, note that as a risk factor.`;
}

// ---------------------------------------------------------------------------
// Market Summary Prompt
// ---------------------------------------------------------------------------

/**
 * Build a prompt to generate a market trend summary across platforms.
 */
export function buildMarketSummaryPrompt(
  auctions: Array<{
    title: string;
    platform: string;
    currentBid?: number | null;
    bidCount?: number;
    endTime?: string | null;
    make?: string;
    model?: string;
    year?: number;
  }>,
): string {
  const listingsSummary = auctions
    .slice(0, 50) // Cap at 50 to stay within token limits
    .map(
      (a, i) =>
        `${i + 1}. [${a.platform}] ${a.title}${a.currentBid != null ? ` - $${a.currentBid.toLocaleString()}` : ''}${a.bidCount ? ` (${a.bidCount} bids)` : ''}`,
    )
    .join('\n');

  return `You are analyzing current online car auction activity across Bring a Trailer, Cars & Bids, and Collecting Cars. Here are the currently active auctions:

${listingsSummary}

Based on these listings, provide a market summary as a JSON object with this structure:

{
  "totalActiveAuctions": <number>,
  "averageBidActivity": <number - average bids per auction>,
  "hotSegments": ["<string - vehicle segments seeing strong bidding activity>"],
  "coolSegments": ["<string - segments with less interest than usual>"],
  "trendingMakes": ["<string - makes attracting the most attention>"],
  "notableAuctions": ["<string - specific auctions worth watching and why>"],
  "summary": "<string - 2-3 paragraph market commentary covering current trends, notable finds, and overall market sentiment>"
}

Respond with ONLY the JSON object, no markdown fences or additional text.`;
}

// ---------------------------------------------------------------------------
// Quick Valuation Prompt (lighter, faster)
// ---------------------------------------------------------------------------

/**
 * Build a quick valuation prompt for a vehicle without full analysis.
 */
export function buildQuickValuationPrompt(
  make: string,
  model: string,
  year: number,
  mileage?: number | null,
): string {
  return `What is the current fair market value range for a ${year} ${make} ${model}${mileage ? ` with ${mileage.toLocaleString()} miles` : ''}?

Respond with ONLY a JSON object:

{
  "lowEstimate": <number in USD>,
  "highEstimate": <number in USD>,
  "medianEstimate": <number in USD>,
  "confidence": "<HIGH|MEDIUM|LOW>",
  "factors": ["<string - key factors affecting value>"],
  "notes": "<string - brief notes on this model's market position>"
}`;
}

// ---------------------------------------------------------------------------
// Investment Report Analysis Prompt (Gemini)
// ---------------------------------------------------------------------------

export const REPORT_SYSTEM_PROMPT = `You are Monza Lab AI, an expert collector car investment analyst. You specialize in valuations based on real market data — actual sale prices, asking prices, and listing histories.

RULES:
- Base ALL analysis on the real market data provided below
- Clearly distinguish between verified sales and asking prices in your reasoning
- If insufficient data exists for any field, return null for that field
- Never fabricate sale records, price data, or market statistics
- Be specific to the exact vehicle being analyzed
- Reference known issues for the specific year/make/model
- Express uncertainty when data is limited

You always respond with valid JSON when asked to do so.`

export function buildReportAnalysisPrompt(
  vehicle: {
    title: string
    year: number
    make: string
    model: string
    trim?: string | null
    mileage?: number | null
    mileageUnit?: string
    transmission?: string | null
    engine?: string | null
    exteriorColor?: string | null
    interiorColor?: string | null
    location?: string | null
    price: number
    vin?: string | null
    description?: string | null
    sellerNotes?: string | null
    platform: string
    sourceUrl?: string
  },
  regionalStats: RegionalMarketStats[],
  sampleListings: PricedListingRecord[],
  brandThesis: string | null,
): string {
  // Vehicle section
  const vehicleSection = `VEHICLE BEING ANALYZED:
- Title: ${vehicle.title}
- Year: ${vehicle.year}
- Make: ${vehicle.make}
- Model: ${vehicle.model}${vehicle.trim ? ` ${vehicle.trim}` : ""}
- Price: $${vehicle.price.toLocaleString()} (listing price)
- Mileage: ${vehicle.mileage != null ? `${vehicle.mileage.toLocaleString()} ${vehicle.mileageUnit || "mi"}` : "Not specified"}
- Transmission: ${vehicle.transmission || "Not specified"}
- Engine: ${vehicle.engine || "Not specified"}
- Exterior: ${vehicle.exteriorColor || "Not specified"}
- Interior: ${vehicle.interiorColor || "Not specified"}
- Location: ${vehicle.location || "Not specified"}
- VIN: ${vehicle.vin || "Not provided"}
- Platform: ${vehicle.platform}
${vehicle.sourceUrl ? `- URL: ${vehicle.sourceUrl}` : ""}

${vehicle.description ? `LISTING DESCRIPTION:\n${vehicle.description.slice(0, 3000)}\n` : ""}
${vehicle.sellerNotes ? `SELLER NOTES:\n${vehicle.sellerNotes.slice(0, 1000)}\n` : ""}`

  // Regional market data
  const marketSections = regionalStats.map(r => {
    const tierNote = r.tier === 1
      ? "VERIFIED SALES (actual transaction prices)"
      : r.tier === 2
        ? "ASKING PRICES (active listings, NOT confirmed sales)"
        : "RECENTLY DELISTED (last known asking prices)"

    return `${r.region} MARKET — ${tierNote} [${r.sources.join(", ")}]:
  Count: ${r.totalListings}
  Median: ${r.currency === "USD" ? "$" : r.currency === "EUR" ? "€" : r.currency === "GBP" ? "£" : "¥"}${r.medianPrice.toLocaleString()} (${r.currency})
  Range: P25=${r.p25Price.toLocaleString()} — P75=${r.p75Price.toLocaleString()} (${r.currency})
  Min-Max: ${r.minPrice.toLocaleString()} — ${r.maxPrice.toLocaleString()} (${r.currency})
  Trend: ${r.trendDirection} (${r.trendPercent > 0 ? "+" : ""}${r.trendPercent}%)
  Period: ${r.oldestDate} to ${r.newestDate}`
  }).join("\n\n")

  // Sample comparables (up to 20 per region)
  const sampleSection = sampleListings.length > 0
    ? `SAMPLE COMPARABLE LISTINGS:\n${sampleListings.slice(0, 60).map((l, i) =>
        `${i + 1}. ${l.year} ${l.make} ${l.model}${l.trim ? ` ${l.trim}` : ""} — ${l.originalCurrency ?? "USD"} ${l.hammerPrice.toLocaleString()} [${l.source}] ${l.status} ${l.saleDate ?? ""} ${l.mileage ? `(${l.mileage.toLocaleString()} mi)` : ""}`
      ).join("\n")}`
    : "NO COMPARABLE LISTINGS AVAILABLE."

  const thesisSection = brandThesis
    ? `BRAND/SERIES INVESTMENT THESIS:\n${brandThesis}\n`
    : ""

  return `${vehicleSection}

REGIONAL MARKET DATA:
${marketSections}

${sampleSection}

${thesisSection}
INSTRUCTIONS:
Analyze this vehicle and respond with ONLY a valid JSON object (no markdown fences). Use this exact structure:

{
  "investmentGrade": "<AAA|AA|A|BBB|BB|B or null if insufficient data>",
  "confidence": "<HIGH|MEDIUM|LOW>",
  "redFlags": ["<string — potential concern identified from listing or market data>"],
  "keyStrengths": ["<string — positive aspect of this vehicle>"],
  "criticalQuestions": ["<string — important question a buyer should ask>"],
  "ownershipCosts": {
    "yearlyMaintenance": <number in USD or null>,
    "insuranceEstimate": <number in USD or null>,
    "majorServiceCost": <number in USD or null>,
    "majorServiceDescription": "<string describing what the service is>"
  },
  "appreciationPotential": "<string — 2-3 sentences on investment outlook>",
  "bidTargetLow": <number in USD — conservative buy price or null>,
  "bidTargetHigh": <number in USD — aggressive buy price or null>,
  "comparableAnalysis": "<string — 2-3 paragraphs analyzing this vehicle vs comparable market data>"
}

Be specific to THIS exact vehicle. Weight verified sales (Tier 1) more heavily than asking prices (Tier 2). If data is limited, lower the confidence and explain why.`
}
