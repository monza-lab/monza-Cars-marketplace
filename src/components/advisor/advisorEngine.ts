import type { AdvisorContext, AdvisorMessage, Intent, QuickAction, ReportCtaData, DetectedLanguage } from "./advisorTypes"
import { detectLanguage, getTimeGreeting, t } from "./advisorLanguage"
import { extractSeries, getSeriesThesis, getOwnershipCosts, getMarketDepth } from "@/lib/brandConfig"
import { formatRegionalPrice, formatUsd } from "@/lib/regionPricing"

// ═══ HELPERS ═══

/** Format a USD amount using the context's formatPrice (from useCurrency) or fallback to formatUsd */
function fmtPrice(ctx: AdvisorContext, usdAmount: number): string {
  return ctx.formatPrice ? ctx.formatPrice(usdAmount) : formatUsd(usdAmount)
}

// ═══ INTENT CLASSIFICATION ═══

const INTENT_KEYWORDS: Record<Intent, string[]> = {
  greeting: ["hola", "hello", "hi", "hey", "buenos", "good morning", "good afternoon", "bonjour", "ciao", "ola", "hallo"],
  valuation: ["worth", "value", "precio", "price", "cuanto", "how much", "cost", "cuesta", "vale", "fair", "valuation", "priced", "prix", "prezzo", "wert", "buen precio", "fairly priced"],
  investment: ["invest", "inversion", "buy", "comprar", "should i", "deberia", "recommendation", "roi", "return", "outlook", "should", "conviene", "recomendacion"],
  risks: ["risk", "riesgo", "red flag", "concern", "worry", "problem", "issue", "danger", "caution", "downside", "peligro", "problema", "cuidado"],
  strengths: ["strength", "fortaleza", "advantage", "highlight", "positive", "punto fuerte", "ventaja", "lo bueno", "bueno de"],
  specs: ["spec", "tell me about", "details", "engine", "motor", "transmission", "mileage", "kilometraje", "color", "description", "info", "about", "cuentame", "dime sobre", "detalles"],
  inspection: ["inspect", "check", "verificar", "look for", "what to check", "due diligence", "pre-purchase", "revision", "revisar", "inspeccionar"],
  "ownership-costs": ["own", "maintenance", "mantenimiento", "insurance", "seguro", "storage", "costs", "costos", "annual", "yearly", "mantener", "costo de"],
  shipping: ["ship", "envio", "transport", "deliver", "import", "logistics", "enviar", "importar", "transporte"],
  "regional-comparison": ["region", "where", "donde", "best deal", "mejor oferta", "compare region", "eu vs", "uk vs", "japan", "mejor mercado", "best market"],
  "market-overview": ["market", "mercado", "trend", "tendencia", "outlook", "panorama", "demand", "supply", "how is the", "como esta el"],
  report: ["report", "reporte", "informe", "full analysis", "generate", "generar", "detailed", "completo", "analisis completo", "quiero el reporte", "dame el reporte"],
  comparables: ["comparable", "similar", "comp", "recent sales", "ventas recientes", "sold", "vendido", "comparables", "similares", "parecidos"],
  thanks: ["thank", "gracias", "perfect", "perfecto", "excellent", "excelente", "great", "genial", "merci", "grazie", "obrigado", "danke", "listo", "super"],
  help: ["help", "ayuda", "what can you", "que puedes", "capabilities", "assist", "que haces", "como funciona"],
  unknown: [],
}

export function classifyIntent(text: string): Intent {
  const lower = text.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
  const words = lower.split(/\s+/)

  let bestIntent: Intent = "unknown"
  let bestScore = 0

  for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
    if (intent === "unknown") continue
    let score = 0
    for (const kw of keywords) {
      if (kw.includes(" ")) {
        if (lower.includes(kw)) score += 3
      } else {
        if (words.includes(kw)) score += 1
      }
    }
    if (score > bestScore) {
      bestScore = score
      bestIntent = intent as Intent
    }
  }

  return bestIntent
}

// ═══ WELCOME MESSAGE ═══

export function generateWelcome(ctx: AdvisorContext, lang: DetectedLanguage = "en"): AdvisorMessage {
  const greeting = getTimeGreeting(lang)
  const name = ctx.userName ? `, **${ctx.userName.split(" ")[0]}**` : ""
  const car = ctx.car

  let content: string
  let quickActions: QuickAction[]

  if (car) {
    const price = fmtPrice(ctx, car.currentBid)
    content = `${greeting}${name}.\n\n` +
      `I see you're looking at the **${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}**.\n\n` +
      `- ${t(lang, "currentBid")}: **${price}**\n` +
      `- ${t(lang, "grade")}: **${car.investmentGrade}**\n` +
      `- Status: **${car.status === "ENDED" ? "Sold" : car.status === "ENDING_SOON" ? "Ending Soon" : "Live"}**\n\n` +
      `How can I help you with this vehicle?`
    quickActions = [
      { id: "fair-price", label: t(lang, "isFairlyPriced"), prompt: "Is this fairly priced?" },
      { id: "risks", label: t(lang, "whatAreRisks"), prompt: "What are the risks?" },
      { id: "best-market", label: t(lang, "bestMarket"), prompt: "Best market to buy?" },
      { id: "report", label: t(lang, "investmentReport"), prompt: "Get investment report" },
    ]
  } else if (ctx.make) {
    const md = getMarketDepth(ctx.make)
    content = `${greeting}${name}.\n\n` +
      `You're exploring **${ctx.make}**. I have access to market data, regional pricing, and investment analysis.\n\n` +
      `- Demand score: **${md.demandScore}/10**\n` +
      `- Sell-through rate: **${md.sellThroughRate}%**\n\n` +
      `What would you like to know?`
    quickActions = [
      { id: "market", label: t(lang, "bestMarket"), prompt: "Best market to buy?" },
      { id: "risks", label: t(lang, "whatAreRisks"), prompt: "What are the risks?" },
    ]
  } else {
    content = `${greeting}${name}.\n\n${t(lang, "welcome")}`
    quickActions = []
  }

  return { id: "welcome", role: "assistant", content, timestamp: new Date(), quickActions }
}

// ═══ RESPONSE BUILDERS ═══

function buildValuationResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  if (!car) return t(lang, "noCarContext")

  const fv = car.fairValueByRegion
  const region = ctx.effectiveRegion ?? "US"
  const regionFv = fv[region as keyof typeof fv] || fv.US
  const priceFormatted = fmtPrice(ctx, car.currentBid)
  const lowFormatted = formatRegionalPrice(regionFv.low, regionFv.currency)
  const highFormatted = formatRegionalPrice(regionFv.high, regionFv.currency)

  const priceInCurrency = car.currentBid // prices are USD-based
  const range = regionFv.high - regionFv.low
  const positionPct = range > 0 ? Math.round(((priceInCurrency - regionFv.low) / range) * 100) : 50
  const positionLabel = positionPct < 30
    ? "**below** the fair value range — potential opportunity"
    : positionPct > 70
      ? "**above** the fair value midpoint — verify condition justifies the premium"
      : "**within** the fair value range — fairly priced for current conditions"

  let marketContext = ""
  if (ctx.dbMarketData) {
    const md = ctx.dbMarketData
    const sales = md.totalSales ?? 0
    if (sales > 0) {
      marketContext = `\n\n**Market Data** (${sales} sales tracked):\n` +
        (md.avgPrice ? `- Average: ${fmtPrice(ctx, md.avgPrice)}\n` : "") +
        (md.medianPrice ? `- Median: ${fmtPrice(ctx, md.medianPrice)}\n` : "") +
        (md.lowPrice && md.highPrice ? `- Range: ${fmtPrice(ctx, md.lowPrice)} – ${fmtPrice(ctx, md.highPrice)}\n` : "") +
        (md.trend ? `- Trend: ${md.trend}` : "")
    }
  }

  return `**${t(lang, "fairValue")} — ${car.year} ${car.make} ${car.model}**\n\n` +
    `${t(lang, "currentBid")}: **${priceFormatted}**\n` +
    `${t(lang, "fairValue")} (${region}): **${lowFormatted} – ${highFormatted}**\n\n` +
    `This price sits ${positionLabel} (${positionPct}th percentile).` +
    marketContext
}

function buildInvestmentResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  if (!car) return t(lang, "noCarContext")

  const series = extractSeries(car.model, car.year, car.make, car.title)
  const thesis = getSeriesThesis(series, car.make) || car.thesis
  const strengths = ctx.dbAnalysis?.keyStrengths || []
  const redFlags = ctx.dbAnalysis?.redFlags || []

  return `**${t(lang, "grade")}: ${car.investmentGrade}** — ${car.year} ${car.make} ${car.model}\n\n` +
    `**Thesis:**\n${thesis}\n\n` +
    (strengths.length > 0 ? `**${t(lang, "strengths")}:**\n${strengths.map(s => `- ${s}`).join("\n")}\n\n` : "") +
    (redFlags.length > 0 ? `**${t(lang, "risks")}:**\n${redFlags.map(f => `- ${f}`).join("\n")}\n\n` : "") +
    `Would you like the full investment report, or want me to compare regional pricing?`
}

function buildRisksResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  if (!car) return t(lang, "noCarContext")

  const redFlags = ctx.dbAnalysis?.redFlags || []
  const criticalQ = ctx.dbAnalysis?.criticalQuestions || []

  return `**${t(lang, "risks")} — ${car.year} ${car.make} ${car.model}**\n\n` +
    (redFlags.length > 0
      ? `**Red Flags:**\n${redFlags.map(f => `- ${f}`).join("\n")}\n\n`
      : `No specific red flags identified for this vehicle.\n\n`) +
    (criticalQ.length > 0
      ? `**Critical Questions for Seller:**\n${criticalQ.map(q => `- ${q}`).join("\n")}\n\n`
      : "") +
    `**General ${car.make} Inspection Points:**\n` +
    `- Verify matching numbers (engine, transmission, chassis)\n` +
    `- Request complete service history documentation\n` +
    `- Pre-purchase inspection by marque specialist recommended\n` +
    `- Check title history for accident or flood damage`
}

function buildStrengthsResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  if (!car) return t(lang, "noCarContext")

  const strengths = ctx.dbAnalysis?.keyStrengths || []

  return `**${t(lang, "strengths")} — ${car.year} ${car.make} ${car.model}**\n\n` +
    (strengths.length > 0
      ? strengths.map(s => `- ${s}`).join("\n")
      : `- ${car.investmentGrade} investment grade\n- ${car.make} heritage and brand desirability\n- Active collector market with strong demand`) +
    `\n\n**Grade: ${car.investmentGrade}** | **Trend: ${car.trend}**`
}

function buildSpecsResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  if (!car) return t(lang, "noCarContext")

  return `**${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}**\n\n` +
    `- **Engine:** ${car.engine}\n` +
    `- **Transmission:** ${car.transmission}\n` +
    `- **Mileage:** ${car.mileage.toLocaleString()} ${car.mileageUnit}\n` +
    `- **Location:** ${car.location}\n` +
    (car.exteriorColor ? `- **Exterior:** ${car.exteriorColor}\n` : "") +
    (car.interiorColor ? `- **Interior:** ${car.interiorColor}\n` : "") +
    `- **Platform:** ${car.platform.replace(/_/g, " ")}\n` +
    `- **${t(lang, "currentBid")}:** ${fmtPrice(ctx, car.currentBid)}\n` +
    `- **Bids:** ${car.bidCount}\n\n` +
    `**${t(lang, "grade")}:** ${car.investmentGrade}`
}

function buildOwnershipResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  const make = ctx.make || car?.make || "Porsche"

  const costs = getOwnershipCosts(make, car ? Math.max(car.currentBid / 100000, 0.5) : 1)
  const ins = ctx.dbAnalysis?.insuranceEstimate ?? costs.insurance
  const stor = costs.storage
  const maint = ctx.dbAnalysis?.yearlyMaintenance ?? costs.maintenance
  const total = ins + stor + maint

  return `**${t(lang, "ownershipCost")}${car ? ` — ${car.year} ${car.make} ${car.model}` : ""}**\n\n` +
    `- **Insurance:** ${fmtPrice(ctx, ins)}/yr\n` +
    `- **Storage:** ${fmtPrice(ctx, stor)}/yr\n` +
    `- **Maintenance:** ${fmtPrice(ctx, maint)}/yr\n` +
    `- **Total:** ${fmtPrice(ctx, total)}/yr\n\n` +
    (ctx.dbAnalysis?.majorServiceCost
      ? `**Major Service:** ${fmtPrice(ctx, ctx.dbAnalysis.majorServiceCost)} (every 3-4 years)\n\n`
      : "") +
    (car ? `These costs represent approximately **${((total / car.currentBid) * 100).toFixed(1)}%** of the vehicle's value annually.` : "")
}

function buildRegionalResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const car = ctx.car
  if (!car) {
    const md = getMarketDepth(ctx.make || "Porsche")
    return `**${ctx.make || "Porsche"} Market Overview:**\n\n` +
      `- Auctions/year: **${md.auctionsPerYear}**\n` +
      `- Avg days to sell: **${md.avgDaysToSell}**\n` +
      `- Sell-through rate: **${md.sellThroughRate}%**\n` +
      `- Demand score: **${md.demandScore}/10**\n\n` +
      t(lang, "noCarContext")
  }

  const fv = car.fairValueByRegion
  const regions = ["US", "EU", "UK", "JP"] as const
  const usAvg = (fv.US.low + fv.US.high) / 2
  const lines = regions.map(r => {
    const rv = fv[r]
    const rAvg = (rv.low + rv.high) / 2
    const premiumPct = usAvg > 0 ? ((rAvg - usAvg) / usAvg) * 100 : 0
    const premiumLabel = Math.abs(premiumPct) < 1 ? "baseline" : premiumPct > 0 ? `+${premiumPct.toFixed(0)}%` : `${premiumPct.toFixed(0)}%`
    return `- **${r}:** ${formatRegionalPrice(rv.low, rv.currency)} – ${formatRegionalPrice(rv.high, rv.currency)} (${premiumLabel})`
  })

  const bestRegion = regions.reduce((best, r) => {
    const rMid = (fv[r].low + fv[r].high) / 2
    const bMid = (fv[best].low + fv[best].high) / 2
    return rMid < bMid ? r : best
  }, regions[0])

  return `**${t(lang, "bestRegion")} — ${car.year} ${car.make} ${car.model}**\n\n` +
    `${t(lang, "fairValue")} by region:\n${lines.join("\n")}\n\n` +
    `**Best value:** ${bestRegion} market` +
    (bestRegion === "JP" ? " (Japanese market discount — factor in import costs)" : "")
}

function buildComparablesResponse(ctx: AdvisorContext, lang: DetectedLanguage): string {
  const comps = ctx.dbComparables

  if (!comps || comps.length === 0) {
    return `No comparable sales data currently available for this model. I can still provide analysis based on regional pricing and investment grade.`
  }

  const lines = comps.slice(0, 5).map((c, i) => {
    const price = fmtPrice(ctx, c.soldPrice)
    const date = c.soldDate ? new Date(c.soldDate).toLocaleDateString() : "N/A"
    return `${i + 1}. **${c.title}** — ${price} (${c.platform}, ${date})${c.mileage ? ` · ${c.mileage.toLocaleString()} mi` : ""}`
  })

  return `**${t(lang, "comparables")}:**\n\n${lines.join("\n")}` +
    (comps.length > 5 ? `\n\n+ ${comps.length - 5} more sales in our database.` : "") +
    `\n\nWant the full report with all comparables and detailed analysis?`
}

function buildReportResponse(ctx: AdvisorContext, lang: DetectedLanguage): { content: string; reportCta?: ReportCtaData } {
  const car = ctx.car
  if (!car) return { content: t(lang, "noCarContext") }

  const alreadyAnalyzed = ctx.hasAnalyzedCurrentCar ?? false
  const hasTokens = (ctx.analysesRemaining ?? 0) > 0

  const content = alreadyAnalyzed
    ? `You already have the full investment report for the **${car.year} ${car.make} ${car.model}**. You can access it anytime.`
    : hasTokens
      ? `I can generate a **${t(lang, "reportTitle")}** for the **${car.year} ${car.make} ${car.model}**.\n\n` +
        `**Includes:**\n` +
        `- Fair value analysis with regional comparison\n` +
        `- Comparable sales and market positioning\n` +
        `- Risk factors and inspection checklist\n` +
        `- Ownership cost breakdown\n` +
        `- Investment grade analysis\n\n` +
        `**Cost:** 1,000 tokens (you have ${(ctx.tokens ?? 0).toLocaleString()} tokens)`
      : `The ${t(lang, "reportTitle")} requires tokens. You currently have **${ctx.tokens ?? 0}** tokens. Upgrade your plan to generate reports.`

  return {
    content,
    reportCta: {
      carId: car.id,
      carTitle: `${car.year} ${car.make} ${car.model}`,
      make: car.make,
      alreadyAnalyzed,
      hasTokens,
      analysesRemaining: ctx.analysesRemaining ?? 0,
    },
  }
}

function buildHelpResponse(lang: DetectedLanguage): string {
  return `${t(lang, "helpIntro")}\n\n` +
    `- **${t(lang, "fairValue")}** — Fair value analysis with regional pricing\n` +
    `- **${t(lang, "grade")}** — Grade, thesis, and market outlook\n` +
    `- **${t(lang, "risks")}** — Red flags, inspection points, critical questions\n` +
    `- **${t(lang, "ownershipCost")}** — Insurance, storage, maintenance estimates\n` +
    `- **${t(lang, "bestRegion")}** — Where to find the best deal (US, EU, UK, JP)\n` +
    `- **${t(lang, "comparables")}** — Recent transactions for similar vehicles\n` +
    `- **${t(lang, "reportTitle")}** — Complete investment analysis (uses tokens)\n\n` +
    `Just ask in any language — I'll respond in yours.`
}

// ═══ MAIN DISPATCHER ═══

export function generateResponse(query: string, ctx: AdvisorContext): AdvisorMessage {
  const lang = detectLanguage(query)
  const intent = classifyIntent(query)

  let content: string
  let quickActions: QuickAction[] | undefined
  let reportCta: ReportCtaData | undefined

  switch (intent) {
    case "greeting":
      return generateWelcome(ctx, lang)

    case "valuation":
      content = buildValuationResponse(ctx, lang)
      quickActions = [
        { id: "comps", label: t(lang, "showComps"), prompt: "Show comparable sales" },
        { id: "report", label: t(lang, "getReport"), prompt: "Get investment report" },
      ]
      break

    case "investment":
      content = buildInvestmentResponse(ctx, lang)
      quickActions = [
        { id: "risks", label: t(lang, "whatAreRisks"), prompt: "What are the risks?" },
        { id: "report", label: t(lang, "getReport"), prompt: "Get investment report" },
      ]
      break

    case "risks":
      content = buildRisksResponse(ctx, lang)
      quickActions = [
        { id: "strengths", label: t(lang, "strengths"), prompt: "What are the strengths?" },
        { id: "report", label: t(lang, "getReport"), prompt: "Get investment report" },
      ]
      break

    case "strengths":
      content = buildStrengthsResponse(ctx, lang)
      quickActions = [
        { id: "valuation", label: t(lang, "isFairlyPriced"), prompt: "Is this fairly priced?" },
      ]
      break

    case "specs":
      content = buildSpecsResponse(ctx, lang)
      quickActions = [
        { id: "valuation", label: t(lang, "isFairlyPriced"), prompt: "Is this fairly priced?" },
        { id: "risks", label: t(lang, "whatAreRisks"), prompt: "What are the risks?" },
      ]
      break

    case "inspection":
      content = buildRisksResponse(ctx, lang)
      break

    case "ownership-costs":
      content = buildOwnershipResponse(ctx, lang)
      quickActions = [
        { id: "regional", label: t(lang, "bestMarket"), prompt: "Best market to buy?" },
      ]
      break

    case "shipping":
      content = buildOwnershipResponse(ctx, lang)
      break

    case "regional-comparison":
    case "market-overview":
      content = buildRegionalResponse(ctx, lang)
      quickActions = ctx.car ? [
        { id: "valuation", label: t(lang, "isFairlyPriced"), prompt: "Is this fairly priced?" },
        { id: "report", label: t(lang, "getReport"), prompt: "Get investment report" },
      ] : undefined
      break

    case "comparables":
      content = buildComparablesResponse(ctx, lang)
      quickActions = [
        { id: "report", label: t(lang, "getReport"), prompt: "Get investment report" },
      ]
      break

    case "report": {
      const result = buildReportResponse(ctx, lang)
      content = result.content
      reportCta = result.reportCta
      break
    }

    case "thanks": {
      const name = ctx.userName ? `, ${ctx.userName.split(" ")[0]}` : ""
      content = ctx.car
        ? `${t(lang, "thanksReply").replace("!", `${name}!`)} Don't hesitate to ask about the **${ctx.car.year} ${ctx.car.make} ${ctx.car.model}** or any other vehicle.`
        : `${t(lang, "thanksReply").replace("!", `${name}!`)}`
      break
    }

    case "help":
      content = buildHelpResponse(lang)
      break

    default:
      content = ctx.car
        ? `I'd be happy to help with the **${ctx.car.year} ${ctx.car.make} ${ctx.car.model}**. You can ask about:\n\n` +
          `- Valuation and fair price\n` +
          `- Investment potential and risks\n` +
          `- Specifications and details\n` +
          `- Regional market comparison\n` +
          `- Ownership costs\n` +
          `- Full investment report`
        : `Could you be more specific? I can help with valuation, investment analysis, risk assessment, regional pricing, and more.`
      quickActions = ctx.car ? [
        { id: "fair-price", label: t(lang, "isFairlyPriced"), prompt: "Is this fairly priced?" },
        { id: "risks", label: t(lang, "whatAreRisks"), prompt: "What are the risks?" },
      ] : undefined
  }

  return {
    id: `assistant-${Date.now()}`,
    role: "assistant",
    content,
    timestamp: new Date(),
    quickActions,
    reportCta,
  }
}
