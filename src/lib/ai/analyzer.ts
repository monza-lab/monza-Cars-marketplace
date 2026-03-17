// ---------------------------------------------------------------------------
// AI Analyzer
// ---------------------------------------------------------------------------
// Ties together the Claude client and prompts to produce structured vehicle
// analysis. Handles JSON parsing, retries, and in-memory caching.
// ---------------------------------------------------------------------------

import { analyzeVehicle, analyzeWithSystem } from './claude';
import { analyzeWithGemini } from './gemini';
import {
  ANALYSIS_SYSTEM_PROMPT,
  buildVehicleAnalysisPrompt,
  buildMarketSummaryPrompt,
  REPORT_SYSTEM_PROMPT,
  buildReportAnalysisPrompt,
} from './prompts';
import type { AIAnalysisResponse } from '@/types/analysis';
import type { RegionalMarketStats, PricedListingRecord, ListingReport } from '@/lib/reports/types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** The shape returned to the API route for database persistence. */
export interface AnalysisResult {
  summary: string;
  fairValueLow: number;
  fairValueHigh: number;
  fairValueMid: number;
  confidenceScore: number;
  pros: string[];
  cons: string[];
  redFlags: string[];
  recommendation: string;
  marketTrend: string;
  rawResponse: AIAnalysisResponse;
}

interface VehicleData {
  id: string;
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
  imageUrl?: string | null;
  vin?: string | null;
}

interface MarketDataInput {
  comparableSales: Array<{
    title: string;
    make?: string;
    model?: string;
    year?: number;
    mileage?: number | null;
    soldPrice: number;
    soldDate?: string | Date | null;
    platform?: string;
    condition?: string | null;
  }>;
  totalComparables: number;
}

// ---------------------------------------------------------------------------
// In-memory cache
// ---------------------------------------------------------------------------

const analysisCache = new Map<
  string,
  { result: AnalysisResult; cachedAt: number }
>();

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function getCacheKey(vehicleData: VehicleData): string {
  return `${vehicleData.platform}:${vehicleData.id}`;
}

function getCachedResult(key: string): AnalysisResult | null {
  const entry = analysisCache.get(key);
  if (!entry) return null;

  if (Date.now() - entry.cachedAt > CACHE_TTL_MS) {
    analysisCache.delete(key);
    return null;
  }

  return entry.result;
}

function setCachedResult(key: string, result: AnalysisResult): void {
  // Prevent unbounded cache growth
  if (analysisCache.size > 500) {
    // Evict oldest entries
    const entries = Array.from(analysisCache.entries());
    entries.sort((a, b) => a[1].cachedAt - b[1].cachedAt);
    const toEvict = entries.slice(0, 100);
    for (const [k] of toEvict) {
      analysisCache.delete(k);
    }
  }

  analysisCache.set(key, { result, cachedAt: Date.now() });
}

// ---------------------------------------------------------------------------
// JSON parsing with retries
// ---------------------------------------------------------------------------

/**
 * Attempt to parse a JSON response from Claude. If the response contains
 * markdown code fences, strip them first. Retries with a corrective prompt
 * if initial parsing fails.
 */
function extractJSON<T>(text: string): T {
  // Strip markdown code fences if present
  let cleaned = text.trim();

  // Remove ```json ... ``` or ``` ... ```
  const fenceMatch = cleaned.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    cleaned = fenceMatch[1].trim();
  }

  // Try to find JSON object boundaries if there's extra text
  if (!cleaned.startsWith('{') && !cleaned.startsWith('[')) {
    const jsonStart = cleaned.indexOf('{');
    if (jsonStart !== -1) {
      cleaned = cleaned.slice(jsonStart);
    }
  }

  // Find the matching closing brace/bracket
  if (cleaned.startsWith('{')) {
    let depth = 0;
    let inString = false;
    let escapeNext = false;

    for (let i = 0; i < cleaned.length; i++) {
      const char = cleaned[i];

      if (escapeNext) {
        escapeNext = false;
        continue;
      }

      if (char === '\\' && inString) {
        escapeNext = true;
        continue;
      }

      if (char === '"') {
        inString = !inString;
        continue;
      }

      if (!inString) {
        if (char === '{') depth++;
        if (char === '}') {
          depth--;
          if (depth === 0) {
            cleaned = cleaned.slice(0, i + 1);
            break;
          }
        }
      }
    }
  }

  return JSON.parse(cleaned) as T;
}

async function parseWithRetry<T>(
  rawText: string,
  retryPrompt: string,
  maxRetries: number = 1,
): Promise<T> {
  // First attempt: parse the raw text
  try {
    return extractJSON<T>(rawText);
  } catch (firstError) {
    console.warn(
      '[Analyzer] First JSON parse attempt failed, retrying with corrective prompt...',
      firstError instanceof Error ? firstError.message : firstError,
    );
  }

  // Retry: ask Claude to fix its own output
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const corrected = await analyzeVehicle(
        `The following text was supposed to be valid JSON but failed to parse. ` +
        `Please return ONLY the corrected, valid JSON with no additional text:\n\n${rawText}`,
      );
      return extractJSON<T>(corrected);
    } catch (retryError) {
      console.warn(
        `[Analyzer] Retry ${attempt + 1} failed:`,
        retryError instanceof Error ? retryError.message : retryError,
      );
    }
  }

  throw new Error(
    'Failed to parse AI response as JSON after retries. Raw text: ' +
    rawText.slice(0, 200),
  );
}

// ---------------------------------------------------------------------------
// Confidence score mapping
// ---------------------------------------------------------------------------

function confidenceToScore(confidence: string): number {
  switch (confidence?.toUpperCase()) {
    case 'HIGH':
      return 90;
    case 'MEDIUM':
      return 70;
    case 'LOW':
      return 50;
    default:
      return 60;
  }
}

// ---------------------------------------------------------------------------
// Main analysis function
// ---------------------------------------------------------------------------

/**
 * Analyze an auction vehicle using Claude AI.
 *
 * @param vehicleData - The vehicle/auction data to analyze
 * @param marketData  - Optional comparable sales and market context
 * @returns Structured analysis result ready for database persistence
 */
export async function analyzeAuction(
  vehicleData: VehicleData,
  marketData?: MarketDataInput,
): Promise<AnalysisResult> {
  // Check cache first
  const cacheKey = getCacheKey(vehicleData);
  const cached = getCachedResult(cacheKey);
  if (cached) {
    console.log(`[Analyzer] Returning cached analysis for ${cacheKey}`);
    return cached;
  }

  console.log(`[Analyzer] Analyzing ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}...`);

  // Format comparable sales dates as strings
  const formattedMarketData = marketData
    ? {
        comparableSales: marketData.comparableSales.map((c) => ({
          ...c,
          soldDate: c.soldDate
            ? typeof c.soldDate === 'string'
              ? c.soldDate
              : c.soldDate.toISOString().split('T')[0]
            : null,
        })),
        totalComparables: marketData.totalComparables,
      }
    : undefined;

  // Build the prompt
  const prompt = buildVehicleAnalysisPrompt(vehicleData, formattedMarketData);

  // Call Claude with system prompt for better structured output
  const rawResponse = await analyzeWithSystem(ANALYSIS_SYSTEM_PROMPT, prompt);

  // Parse the JSON response with retry logic
  const parsed = await parseWithRetry<AIAnalysisResponse>(
    rawResponse,
    prompt,
    1,
  );

  // Transform into the shape expected by the API route / database
  const result: AnalysisResult = {
    summary: buildSummary(vehicleData, parsed),
    fairValueLow: parsed.bidTarget.low,
    fairValueHigh: parsed.bidTarget.high,
    fairValueMid: Math.round((parsed.bidTarget.low + parsed.bidTarget.high) / 2),
    confidenceScore: confidenceToScore(parsed.bidTarget.confidence),
    pros: parsed.keyStrengths || [],
    cons: [
      ...(parsed.redFlags || []),
    ],
    redFlags: parsed.redFlags || [],
    recommendation: buildRecommendation(vehicleData, parsed),
    marketTrend: parsed.investmentOutlook?.trend || 'STABLE',
    rawResponse: parsed,
  };

  // Cache the result
  setCachedResult(cacheKey, result);

  console.log(
    `[Analyzer] Analysis complete for ${vehicleData.title}: ` +
    `$${result.fairValueLow.toLocaleString()}-$${result.fairValueHigh.toLocaleString()} ` +
    `(${parsed.bidTarget.confidence} confidence)`,
  );

  return result;
}

// ---------------------------------------------------------------------------
// Summary and recommendation builders
// ---------------------------------------------------------------------------

function buildSummary(
  vehicleData: VehicleData,
  analysis: AIAnalysisResponse,
): string {
  const bidRange = `$${analysis.bidTarget.low.toLocaleString()}-$${analysis.bidTarget.high.toLocaleString()}`;
  const grade = analysis.investmentOutlook?.grade || 'N/A';
  const trend = analysis.investmentOutlook?.trend || 'STABLE';
  const strengthCount = analysis.keyStrengths?.length || 0;
  const flagCount = analysis.redFlags?.length || 0;

  return (
    `Fair value estimate for this ${vehicleData.year} ${vehicleData.make} ${vehicleData.model}: ${bidRange}. ` +
    `Investment grade: ${grade} (${trend.toLowerCase()} market). ` +
    `${strengthCount} key strength${strengthCount !== 1 ? 's' : ''} identified, ` +
    `${flagCount} potential concern${flagCount !== 1 ? 's' : ''} flagged. ` +
    `${analysis.bidTarget.reasoning}`
  );
}

function buildRecommendation(
  vehicleData: VehicleData,
  analysis: AIAnalysisResponse,
): string {
  const confidence = analysis.bidTarget.confidence;
  const grade = analysis.investmentOutlook?.grade || 'FAIR';
  const currentBid = vehicleData.currentBid;
  const highValue = analysis.bidTarget.high;

  let recommendation: string;

  if (currentBid != null && currentBid > highValue) {
    recommendation =
      `Current bid of $${currentBid.toLocaleString()} exceeds our high estimate of ` +
      `$${highValue.toLocaleString()}. Proceed with caution or set a firm maximum bid.`;
  } else if (currentBid != null && currentBid < analysis.bidTarget.low) {
    recommendation =
      `Current bid of $${currentBid.toLocaleString()} is below our low estimate of ` +
      `$${analysis.bidTarget.low.toLocaleString()}. This could represent good value if ` +
      `the vehicle checks out.`;
  } else {
    recommendation =
      `Current bidding appears within fair market range. ` +
      `Consider bidding up to $${highValue.toLocaleString()} based on our analysis.`;
  }

  if (grade === 'EXCELLENT' || grade === 'GOOD') {
    recommendation += ` Investment outlook is ${grade.toLowerCase()} - this model has strong long-term potential.`;
  } else if (grade === 'SPECULATIVE') {
    recommendation += ` Investment outlook is speculative - buy for enjoyment rather than appreciation.`;
  }

  if (analysis.redFlags && analysis.redFlags.length > 0) {
    recommendation += ` Note: ${analysis.redFlags.length} concern${analysis.redFlags.length > 1 ? 's' : ''} flagged - review before bidding.`;
  }

  if (analysis.criticalQuestions && analysis.criticalQuestions.length > 0) {
    recommendation += ` We recommend asking the seller ${analysis.criticalQuestions.length} important question${analysis.criticalQuestions.length > 1 ? 's' : ''} before placing a bid.`;
  }

  return recommendation;
}

// ---------------------------------------------------------------------------
// Market summary analysis
// ---------------------------------------------------------------------------

/**
 * Generate a market summary from current auction listings.
 */
export async function analyzeMarket(
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
): Promise<Record<string, unknown>> {
  const prompt = buildMarketSummaryPrompt(auctions);
  const rawResponse = await analyzeVehicle(prompt);
  return parseWithRetry<Record<string, unknown>>(rawResponse, prompt, 1);
}

// ---------------------------------------------------------------------------
// Investment Report Analysis (Gemini-powered)
// ---------------------------------------------------------------------------

/** LLM fields from listing_reports that Gemini fills */
export interface ReportLLMFields {
  investment_grade: string | null
  confidence: string | null
  red_flags: string[]
  key_strengths: string[]
  critical_questions: string[]
  yearly_maintenance: number | null
  insurance_estimate: number | null
  major_service_cost: number | null
  appreciation_potential: string | null
  bid_target_low: number | null
  bid_target_high: number | null
  raw_llm_response: Record<string, unknown> | null
  llm_model: string
}

/**
 * Generate a Gemini-powered investment report analysis.
 * Returns the LLM fields ready to merge into listing_reports.
 */
export async function analyzeForReport(
  vehicle: Parameters<typeof buildReportAnalysisPrompt>[0],
  regionalStats: RegionalMarketStats[],
  sampleListings: PricedListingRecord[],
  brandThesis: string | null,
): Promise<ReportLLMFields> {
  const userPrompt = buildReportAnalysisPrompt(
    vehicle,
    regionalStats,
    sampleListings,
    brandThesis,
  )

  const rawText = await analyzeWithGemini(REPORT_SYSTEM_PROMPT, userPrompt)

  // Reuse existing robust JSON parser
  const parsed = extractJSON<Record<string, unknown>>(rawText)

  const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'

  return {
    investment_grade: typeof parsed.investmentGrade === 'string' ? parsed.investmentGrade : null,
    confidence: typeof parsed.confidence === 'string' ? parsed.confidence : null,
    red_flags: Array.isArray(parsed.redFlags) ? parsed.redFlags.filter((s: unknown) => typeof s === 'string') : [],
    key_strengths: Array.isArray(parsed.keyStrengths) ? parsed.keyStrengths.filter((s: unknown) => typeof s === 'string') : [],
    critical_questions: Array.isArray(parsed.criticalQuestions) ? parsed.criticalQuestions.filter((s: unknown) => typeof s === 'string') : [],
    yearly_maintenance: typeof parsed.ownershipCosts === 'object' && parsed.ownershipCosts != null
      ? (parsed.ownershipCosts as Record<string, unknown>).yearlyMaintenance as number ?? null
      : null,
    insurance_estimate: typeof parsed.ownershipCosts === 'object' && parsed.ownershipCosts != null
      ? (parsed.ownershipCosts as Record<string, unknown>).insuranceEstimate as number ?? null
      : null,
    major_service_cost: typeof parsed.ownershipCosts === 'object' && parsed.ownershipCosts != null
      ? (parsed.ownershipCosts as Record<string, unknown>).majorServiceCost as number ?? null
      : null,
    appreciation_potential: typeof parsed.appreciationPotential === 'string' ? parsed.appreciationPotential : null,
    bid_target_low: typeof parsed.bidTargetLow === 'number' ? parsed.bidTargetLow : null,
    bid_target_high: typeof parsed.bidTargetHigh === 'number' ? parsed.bidTargetHigh : null,
    raw_llm_response: parsed,
    llm_model: model,
  }
}
