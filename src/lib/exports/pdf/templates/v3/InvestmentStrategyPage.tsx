import { Page, Text, View } from "@react-pdf/renderer"
import type { InvestmentAnalysis, ListingType } from "@/lib/reports/types-v3"
import { pdfStyles, PDF_COLORS, fmtK } from "../../styles"
import { PageFooter } from "../PageFooter"

interface Props {
  data: InvestmentAnalysis
  listingType: ListingType
  reportHash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

function confidenceColor(c: "high" | "medium" | "low") {
  if (c === "high") return PDF_COLORS.positive
  if (c === "medium") return PDF_COLORS.warning
  return PDF_COLORS.negative
}

export function InvestmentStrategyPage({ data, listingType, reportHash, generatedAt, pageNumber, totalPages }: Props) {
  const { strategy } = data
  const isAuction = listingType === "auction"

  return (
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.h2}>
        {isAuction ? "Bidding Strategy" : "Negotiation Strategy"}
      </Text>

      {/* Strategy Insight */}
      <Text style={[pdfStyles.body, { lineHeight: 1.6, marginBottom: 14 }]}>
        {strategy.strategyInsight}
      </Text>

      {/* Auction or Private Sale Metrics */}
      {isAuction ? (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {strategy.maxBidRecommendation != null && (
            <View style={[pdfStyles.card, { flex: 1, alignItems: "center" }]}>
              <Text style={pdfStyles.h3}>Max Bid</Text>
              <Text style={[pdfStyles.monoBold, { fontSize: 14, marginTop: 4, color: PDF_COLORS.positive }]}>
                {fmtK(strategy.maxBidRecommendation)}
              </Text>
            </View>
          )}
          {strategy.bidTiming && (
            <View style={[pdfStyles.card, { flex: 1 }]}>
              <Text style={pdfStyles.h3}>Bid Timing</Text>
              <Text style={[pdfStyles.body, { marginTop: 4 }]}>{strategy.bidTiming}</Text>
            </View>
          )}
          {strategy.reserveStrategy && (
            <View style={[pdfStyles.card, { flex: 1 }]}>
              <Text style={pdfStyles.h3}>Reserve</Text>
              <Text style={[pdfStyles.body, { marginTop: 4 }]}>{strategy.reserveStrategy}</Text>
            </View>
          )}
        </View>
      ) : (
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {strategy.openingOffer != null && (
            <View style={[pdfStyles.card, { flex: 1, alignItems: "center" }]}>
              <Text style={pdfStyles.h3}>Opening Offer</Text>
              <Text style={[pdfStyles.monoBold, { fontSize: 14, marginTop: 4, color: PDF_COLORS.positive }]}>
                {fmtK(strategy.openingOffer)}
              </Text>
            </View>
          )}
          {strategy.walkAwayPrice != null && (
            <View style={[pdfStyles.card, { flex: 1, alignItems: "center" }]}>
              <Text style={pdfStyles.h3}>Walk-Away Price</Text>
              <Text style={[pdfStyles.monoBold, { fontSize: 14, marginTop: 4, color: PDF_COLORS.negative }]}>
                {fmtK(strategy.walkAwayPrice)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Negotiation Leverage */}
      {strategy.negotiationLeverage.length > 0 && (
        <View style={{ marginBottom: 10 }}>
          <Text style={pdfStyles.h3}>Negotiation Leverage</Text>
          {strategy.negotiationLeverage.map((point, i) => (
            <View key={i} style={{ flexDirection: "row", marginBottom: 3, paddingLeft: 4 }}>
              <Text style={[pdfStyles.body, { color: PDF_COLORS.primary, marginRight: 6 }]}>→</Text>
              <Text style={pdfStyles.body}>{point}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Potential Repairs */}
      {strategy.potentialRepairs && (
        <View style={[pdfStyles.card, { borderColor: PDF_COLORS.negative }]}>
          <Text style={pdfStyles.h3}>Potential Repair Costs</Text>
          <Text style={[pdfStyles.monoBold, { fontSize: 12, marginTop: 4, color: PDF_COLORS.negative }]}>
            {fmtK(strategy.potentialRepairs.low)} – {fmtK(strategy.potentialRepairs.high)}
          </Text>
          <Text style={[pdfStyles.bodyMuted, { marginTop: 4 }]}>
            {strategy.potentialRepairs.description}
          </Text>
        </View>
      )}

      {/* Ownership Costs Table */}
      <Text style={[pdfStyles.h2, { marginTop: 14 }]}>Ownership Cost Projections</Text>
      <View style={[pdfStyles.card, { padding: 0, overflow: "hidden" }]}>
        {/* Header row */}
        <View style={{ flexDirection: "row", backgroundColor: PDF_COLORS.cardWarm, padding: 8 }}>
          <Text style={[pdfStyles.h3, { flex: 1.2, marginBottom: 0 }]}>Period</Text>
          <Text style={[pdfStyles.h3, { flex: 1, textAlign: "right", marginBottom: 0 }]}>Value Δ</Text>
          <Text style={[pdfStyles.h3, { flex: 1, textAlign: "right", marginBottom: 0 }]}>Insurance</Text>
          <Text style={[pdfStyles.h3, { flex: 1, textAlign: "right", marginBottom: 0 }]}>Maint.</Text>
          <Text style={[pdfStyles.h3, { flex: 1, textAlign: "right", marginBottom: 0 }]}>Total</Text>
        </View>
        {(["year1", "year3", "year5"] as const).map((key, i) => {
          const c = data.ownershipCosts[key]
          return (
            <View key={key} style={{ flexDirection: "row", padding: 8, borderTopWidth: i > 0 ? 1 : 0, borderTopColor: PDF_COLORS.border }}>
              <Text style={[pdfStyles.bodyEmphasis, { flex: 1.2 }]}>
                {key === "year1" ? "Year 1" : key === "year3" ? "Year 3" : "Year 5"}
              </Text>
              <Text style={[pdfStyles.mono, { flex: 1, textAlign: "right", fontSize: 9, color: c.breakdown.valueChange >= 0 ? PDF_COLORS.positive : PDF_COLORS.negative }]}>
                {fmtK(c.breakdown.valueChange)}
              </Text>
              <Text style={[pdfStyles.mono, { flex: 1, textAlign: "right", fontSize: 9 }]}>{fmtK(c.breakdown.insurance)}</Text>
              <Text style={[pdfStyles.mono, { flex: 1, textAlign: "right", fontSize: 9 }]}>{fmtK(c.breakdown.maintenance)}</Text>
              <Text style={[pdfStyles.mono, { flex: 1, textAlign: "right", fontSize: 9, color: PDF_COLORS.foreground }]}>{fmtK(c.totalCost)}</Text>
            </View>
          )
        })}
      </View>

      {/* Resale Timeline */}
      <Text style={[pdfStyles.h2, { marginTop: 14 }]}>Resale Timeline</Text>
      <View style={{ flexDirection: "row", gap: 8 }}>
        {(["year1", "year3", "year5", "year10"] as const).map((key) => {
          const p = data.resaleTimeline[key]
          const positive = p.percentChange >= 0
          return (
            <View key={key} style={[pdfStyles.card, { flex: 1 }]} wrap={false}>
              <Text style={pdfStyles.h3}>
                {key === "year1" ? "1 Year" : key === "year3" ? "3 Years" : key === "year5" ? "5 Years" : "10 Years"}
              </Text>
              <Text style={[pdfStyles.mono, { fontSize: 9, marginTop: 4 }]}>
                {fmtK(p.estimatedRange.low)}–{fmtK(p.estimatedRange.high)}
              </Text>
              <Text
                style={[
                  pdfStyles.monoBold,
                  { fontSize: 12, marginTop: 2, color: positive ? PDF_COLORS.positive : PDF_COLORS.negative },
                ]}
              >
                {positive ? "+" : ""}{p.percentChange.toFixed(1)}%
              </Text>
              <Text style={[pdfStyles.bodyMuted, { marginTop: 4, fontSize: 8 }]}>
                {p.confidence} confidence
              </Text>
            </View>
          )
        })}
      </View>

      <PageFooter hash={reportHash} generatedAt={generatedAt} pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  )
}
