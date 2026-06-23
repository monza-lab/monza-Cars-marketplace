import type { HausReportV3 } from "@/lib/reports/types-v3"

export interface ReportExportSection {
  title: string
  rows: [string, string][]
}

export interface ReportExportModel {
  title: string
  subtitle: string
  metrics: [string, string][]
  sections: ReportExportSection[]
  generatedAt: string
  searchText: string
}

function valueOrEmpty(value: unknown): string {
  if (value === null || value === undefined) return ""
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : ""
  if (typeof value === "string") return value.trim()
  return ""
}

function usd(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ""
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value)
}

function joinList(values: string[] | undefined, separator = "; "): string {
  return (values ?? []).map(valueOrEmpty).filter(Boolean).join(separator)
}

function pushRow(rows: [string, string][], label: string, value: unknown): void {
  const normalized = valueOrEmpty(value)
  if (normalized) rows.push([label, normalized])
}

function buildSearchText(model: Omit<ReportExportModel, "searchText">): string {
  const parts = [
    model.title,
    model.subtitle,
    ...model.metrics.flat(),
    ...model.sections.flatMap((section) => [
      section.title,
      ...section.rows.flat(),
    ]),
  ]
  return parts.filter(Boolean).join("\n")
}

export function buildV3ReportExportModel(report: HausReportV3): ReportExportModel {
  const summary = report.finalSynthesis?.executiveSummary
  const recommendation = report.finalSynthesis?.finalRecommendation
  const title = summary?.headline || "MonzaHaus Report"
  const subtitle = [
    report.vehicleIdentity?.year,
    report.vehicleIdentity?.make,
    report.vehicleIdentity?.model,
    report.vehicleIdentity?.trim,
  ].map(valueOrEmpty).filter(Boolean).join(" ")

  const metrics: [string, string][] = []
  pushRow(metrics, "Fair Value", summary?.keyMetrics.fairValueRange)
  pushRow(metrics, "Signals", summary?.keyMetrics.signalsCoverage)
  if (summary?.keyMetrics.riskScore !== undefined) {
    metrics.push(["Risk Score", `${summary.keyMetrics.riskScore}/100`])
  }
  pushRow(metrics, "Verdict", summary?.keyMetrics.verdict ?? recommendation?.verdict)
  pushRow(metrics, "Market Position", summary?.keyMetrics.marketPosition)

  const sections: ReportExportSection[] = []

  if (summary?.investmentThesis) {
    sections.push({
      title: "Investment Thesis",
      rows: [["Thesis", summary.investmentThesis]],
    })
  }

  const strategy = report.investmentAnalysis?.strategy
  const strategyRows: [string, string][] = []
  pushRow(strategyRows, "Strategy Insight", strategy?.strategyInsight)
  pushRow(strategyRows, "Opening Offer", usd(strategy?.openingOffer))
  pushRow(strategyRows, "Walk-Away Price", usd(strategy?.walkAwayPrice))
  pushRow(strategyRows, "Max Bid", usd(strategy?.maxBidRecommendation))
  pushRow(strategyRows, "Bid Timing", strategy?.bidTiming)
  pushRow(strategyRows, "Reserve Strategy", strategy?.reserveStrategy)
  pushRow(strategyRows, "Negotiation Leverage", joinList(strategy?.negotiationLeverage))
  if (strategy?.potentialRepairs) {
    pushRow(
      strategyRows,
      "Potential Repairs",
      `${usd(strategy.potentialRepairs.low)}-${usd(strategy.potentialRepairs.high)} ${strategy.potentialRepairs.description}`.trim(),
    )
  }
  pushRow(strategyRows, "Market Narrative", report.investmentAnalysis?.investmentNarrative)
  if (strategyRows.length > 0) {
    sections.push({ title: "Acquisition Strategy", rows: strategyRows })
  }

  const technical = report.technicalAnalysis
  const technicalRows: [string, string][] = []
  pushRow(technicalRows, "Model History", technical?.modelHistory)
  pushRow(technicalRows, "Spec Significance", technical?.whatMakesThisSpecSpecial)
  pushRow(technicalRows, "Production", technical?.productionData?.totalProduction)
  pushRow(technicalRows, "Configuration Estimate", technical?.productionData?.thisConfigEstimate)
  pushRow(technicalRows, "Rarity", technical?.productionData?.rarityAssessment)
  pushRow(technicalRows, "Rarity Note", technical?.productionData?.rarityNote)
  for (const strength of technical?.keyStrengths ?? []) {
    pushRow(technicalRows, "Key Strength", `${strength.point}: ${strength.detail}`)
  }
  for (const issue of technical?.commonIssues ?? []) {
    pushRow(
      technicalRows,
      "Common Issue",
      `${issue.issue} (${issue.severity})${issue.typicalCost ? `, typical cost ${issue.typicalCost}` : ""}. ${issue.appliesTo}`,
    )
  }
  pushRow(technicalRows, "Reliability", technical?.reliability?.rating)
  pushRow(technicalRows, "Maintenance Cost", technical?.reliability?.maintenanceCostLevel)
  pushRow(technicalRows, "Known Problems", joinList(technical?.reliability?.commonProblems))
  pushRow(technicalRows, "Collector Outlook", technical?.collectorOutlook?.futureOutlook)
  if (technicalRows.length > 0) {
    sections.push({ title: "Technical Analysis", rows: technicalRows })
  }

  const diligence = report.dueDiligence
  const diligenceRows: [string, string][] = []
  if (diligence?.riskScore) {
    diligenceRows.push(["Risk Score", `${diligence.riskScore.overall}/100`])
  }
  for (const item of diligence?.riskScore?.breakdown ?? []) {
    pushRow(diligenceRows, "Risk Driver", `${item.category}: ${item.score}/100. ${item.note}`)
  }
  for (const question of diligence?.questions ?? []) {
    pushRow(diligenceRows, "Seller Question", `${question.question} Why it matters: ${question.whyItMatters}`)
  }
  for (const item of diligence?.ppiChecklist ?? []) {
    pushRow(diligenceRows, "PPI Item", `${item.item} (${item.priority}). ${item.specificTo}${item.estimatedCost ? `, ${item.estimatedCost}` : ""}`)
  }
  if (diligenceRows.length > 0) {
    sections.push({ title: "Due Diligence", rows: diligenceRows })
  }

  const market = report.marketResearch
  const marketRows: [string, string][] = []
  for (const item of market?.expertConsensus?.compiledAnalysis ?? []) {
    pushRow(marketRows, "Expert Consensus", `${item.category} (${item.sentiment}): ${item.summary}`)
  }
  pushRow(marketRows, "Owner Praise", joinList(market?.ownerSentiment?.commonPraise))
  pushRow(marketRows, "Owner Complaints", joinList(market?.ownerSentiment?.commonComplaints))
  pushRow(marketRows, "Owner Tips", joinList(market?.ownerSentiment?.ownerTips))
  pushRow(marketRows, "Heritage", market?.heritage)
  for (const event of market?.relevantEvents ?? []) {
    pushRow(marketRows, "Relevant Event", `${event.name}, ${event.location}, ${event.frequency}: ${event.description}`)
  }
  pushRow(marketRows, "Owner Clubs", joinList(market?.ownerClubs))
  if (marketRows.length > 0) {
    sections.push({ title: "Market Research", rows: marketRows })
  }

  const services = report.buyerServices
  const servicesRows: [string, string][] = []
  pushRow(servicesRows, "Parts Availability", services?.partsAvailability?.overallRating)
  pushRow(servicesRows, "OEM Note", services?.partsAvailability?.oemNote)
  pushRow(servicesRows, "Aftermarket Note", services?.partsAvailability?.aftermarketNote)
  for (const part of services?.partsAvailability?.commonParts ?? []) {
    pushRow(servicesRows, "Common Part", `${part.name}: ${part.availability}, ${part.priceRange}`)
  }
  for (const marketItem of services?.regionalVariations?.strongMarkets ?? []) {
    pushRow(servicesRows, "Strong Market", `${marketItem.region}: ${marketItem.premiumPercent}. ${marketItem.reason}`)
  }
  for (const marketItem of services?.regionalVariations?.weakerMarkets ?? []) {
    pushRow(servicesRows, "Weaker Market", `${marketItem.region}: ${marketItem.discountPercent}. ${marketItem.reason}`)
  }
  if (services?.originalMsrp) {
    pushRow(servicesRows, "Original MSRP", usd(services.originalMsrp.basePrice))
    pushRow(servicesRows, "Inflation Adjusted MSRP", usd(services.originalMsrp.adjustedForInflation))
    pushRow(servicesRows, "MSRP Note", services.originalMsrp.note)
  }
  if (servicesRows.length > 0) {
    sections.push({ title: "Buyer Services", rows: servicesRows })
  }

  const modelWithoutSearchText = {
    title,
    subtitle,
    metrics,
    sections,
    generatedAt: report.generatedAt,
  }

  return {
    ...modelWithoutSearchText,
    searchText: buildSearchText(modelWithoutSearchText),
  }
}
