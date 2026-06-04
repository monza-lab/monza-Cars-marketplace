import { Text, View } from "@react-pdf/renderer"
import { PageWrap } from "../PageWrap"
import type { InvestmentAnalysis } from "@/lib/reports/types-v3"
import { createPdfStyles, getThemeTokens } from "../../styles"
import type { PdfTheme } from "../../theme"
import { humanize, fmtCurrency, fmtCurrencyFull, fmtDelta } from "../../utils"

interface Props {
  data: InvestmentAnalysis
  listingType: "auction" | "classified"
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
  /** When false, embed in parent Page (no PageFooter). */
  wrap?: boolean
}

export function InvestmentStrategyPage({
  data,
  listingType,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
  wrap = true,
}: Props) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)
  const { strategy, ownershipCosts, resaleTimeline, investmentNarrative } = data
  const isAuction = listingType === "auction"

  // ── Hero column values ─────────────────────────────────────────
  const heroPrimaryLabel = isAuction ? "Max Bid" : "Opening Offer"
  const heroPrimaryValue = isAuction
    ? strategy.maxBidRecommendation
    : strategy.openingOffer

  const heroSecondaryLabel = isAuction ? "Bid Timing" : "Walk-Away Price"
  const heroSecondaryAuctionText = strategy.bidTiming
  const heroSecondaryClassifiedValue = strategy.walkAwayPrice

  // Year keys used across ownership and resale projections.
  const ownershipYears = ["year1", "year3", "year5"] as const
  const resaleYears = ["year1", "year3", "year5", "year10"] as const

  const periodLabel = (key: "year1" | "year3" | "year5" | "year10") =>
    key === "year1"
      ? "1Y"
      : key === "year3"
        ? "3Y"
        : key === "year5"
          ? "5Y"
          : "10Y"

  const periodLabelLong = (key: "year1" | "year3" | "year5") =>
    key === "year1" ? "Year 1" : key === "year3" ? "Year 3" : "Year 5"

  return (
    <PageWrap wrap={wrap} theme={theme} hash={reportHash} generatedAt={generatedAt}>
      {/* ── Chapter opener ───────────────────────────────────────── */}
      <View>
        <Text style={styles.chapterEyebrow}>Chapter 02 · Strategy</Text>
        <Text style={[styles.chapter, { marginBottom: 14 }]}>Investment Strategy</Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}>
          {strategy.strategyInsight}
        </Text>
      </View>

      {/* ── Hero metrics row — 3 columns ─────────────────────────── */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        {/* Column 1 — Max Bid / Opening Offer (numeric) */}
        <View style={[styles.card, { flex: 1, paddingVertical: 14 }]}>
          <Text style={styles.h3}>{heroPrimaryLabel}</Text>
          <Text
            style={{
              fontFamily: "Cormorant",
              fontWeight: 500,
              fontSize: 22,
              letterSpacing: -0.4,
              color: tokens.foreground,
              marginTop: 6,
            }}
          >
            {fmtCurrency(heroPrimaryValue)}
          </Text>
        </View>

        {/* Column 2 — Bid Timing (text) / Walk-Away Price (numeric) */}
        <View style={[styles.card, { flex: 1, paddingVertical: 14 }]}>
          <Text style={styles.h3}>{heroSecondaryLabel}</Text>
          {isAuction ? (
            <Text style={[styles.body, { marginTop: 6, fontWeight: 500 }]}>
              {heroSecondaryAuctionText ?? "—"}
            </Text>
          ) : (
            <Text
              style={{
                fontFamily: "Cormorant",
                fontWeight: 500,
                fontSize: 22,
                letterSpacing: -0.4,
                color: tokens.negative,
                marginTop: 6,
              }}
            >
              {fmtCurrency(heroSecondaryClassifiedValue)}
            </Text>
          )}
        </View>

        {/* Column 3 — Reserve (text, both modes) */}
        <View style={[styles.card, { flex: 1, paddingVertical: 14 }]}>
          <Text style={styles.h3}>Reserve</Text>
          <Text style={[styles.body, { marginTop: 6, fontWeight: 500 }]}>
            {strategy.reserveStrategy ?? "—"}
          </Text>
        </View>
      </View>

      {/* ── Negotiation Leverage ─────────────────────────────────── */}
      {strategy.negotiationLeverage.length > 0 && (
        <View style={{ marginBottom: 14 }}>
          <Text style={styles.h2}>Negotiation Leverage</Text>
          {strategy.negotiationLeverage.map((point, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", marginBottom: 4, paddingLeft: 2 }}
            >
              <Text
                style={[styles.body, { color: tokens.primary, marginRight: 8 }]}
              >
                ·
              </Text>
              <Text style={[styles.body, { flex: 1 }]}>{point}</Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Potential Repair Costs ───────────────────────────────── */}
      {strategy.potentialRepairs && (
        <View style={[styles.cardLavender, { paddingVertical: 12 }]}>
          <Text style={[styles.h3, { color: tokens.primary, marginBottom: 4 }]}>
            Potential Repair Costs
          </Text>
          <Text
            style={{
              fontFamily: "Cormorant",
              fontWeight: 500,
              fontSize: 16,
              letterSpacing: -0.2,
              color: tokens.foreground,
              marginBottom: 4,
            }}
          >
            {fmtCurrency(strategy.potentialRepairs.low)}
            <Text style={{ color: tokens.muted }}> — </Text>
            {fmtCurrency(strategy.potentialRepairs.high)}
          </Text>
          <Text style={styles.bodyMuted}>
            {strategy.potentialRepairs.description}
          </Text>
        </View>
      )}

      {/* ── Ownership Cost Projections ───────────────────────────── */}
      <Text style={styles.h2}>Ownership Cost Projections</Text>
      <View style={[styles.card, { padding: 0, overflow: "hidden", marginBottom: 14 }]}>
        {/* Header row — tighter typography so columns don't crash */}
        <View
          style={{
            flexDirection: "row",
            backgroundColor: tokens.cardWarm,
            paddingVertical: 9,
            paddingHorizontal: 12,
          }}
        >
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 600,
              fontSize: 7,
              color: tokens.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              flex: 1.4,
            }}
          >
            Period
          </Text>
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 600,
              fontSize: 7,
              color: tokens.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              flex: 1,
              textAlign: "right",
            }}
          >
            Value Δ
          </Text>
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 600,
              fontSize: 7,
              color: tokens.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              flex: 1,
              textAlign: "right",
            }}
          >
            Maintenance
          </Text>
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 600,
              fontSize: 7,
              color: tokens.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              flex: 1,
              textAlign: "right",
            }}
          >
            Major Work
          </Text>
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 600,
              fontSize: 7,
              color: tokens.muted,
              textTransform: "uppercase",
              letterSpacing: 0.8,
              flex: 1.1,
              textAlign: "right",
            }}
          >
            Total
          </Text>
        </View>

        {ownershipYears.map((key, i) => {
          const c = ownershipCosts[key]
          const valueColor =
            c.breakdown.valueChange >= 0 ? tokens.positive : tokens.negative
          const displayedTotal = c.breakdown.valueChange + c.breakdown.maintenance + (c.breakdown.majorWork ?? 0)
          return (
            <View
              key={key}
              style={{
                flexDirection: "row",
                paddingVertical: 10,
                paddingHorizontal: 12,
                borderTopWidth: i > 0 ? 1 : 0,
                borderTopColor: tokens.borderSoft,
                alignItems: "center",
              }}
            >
              <View style={{ flex: 1.4, flexDirection: "row", alignItems: "baseline", gap: 6 }}>
                <Text style={[styles.bodyEmphasis, { fontSize: 10 }]}>
                  {periodLabelLong(key)}
                </Text>
                <Text
                  style={{
                    fontFamily: "Karla",
                    fontWeight: 500,
                    fontSize: 7,
                    color: tokens.muted,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                  }}
                >
                  · {humanize(c.confidence)}
                </Text>
              </View>
              <Text
                style={[
                  styles.mono,
                  {
                    flex: 1,
                    fontSize: 9,
                    textAlign: "right",
                    color: valueColor,
                  },
                ]}
              >
                {fmtCurrencyFull(c.breakdown.valueChange)}
              </Text>
              <Text
                style={[
                  styles.mono,
                  { flex: 1, fontSize: 9, textAlign: "right", color: tokens.foreground },
                ]}
              >
                {fmtCurrencyFull(c.breakdown.maintenance)}
              </Text>
              <Text
                style={[
                  styles.mono,
                  { flex: 1, fontSize: 9, textAlign: "right", color: tokens.foreground },
                ]}
              >
                {fmtCurrencyFull(c.breakdown.majorWork)}
              </Text>
              <Text
                style={[
                  styles.mono,
                  {
                    flex: 1.1,
                    fontSize: 10,
                    textAlign: "right",
                    color: tokens.foreground,
                    fontWeight: 600,
                  },
                ]}
              >
                {fmtCurrencyFull(displayedTotal)}
              </Text>
            </View>
          )
        })}
      </View>

      {/* ── Resale Timeline ──────────────────────────────────────── */}
      <Text style={styles.h2}>Resale Timeline</Text>
      <Text style={[styles.bodyMuted, { marginTop: -4, marginBottom: 8, fontSize: 8.5 }]}>
        Methodology: projections combine recent comparable sales, current fair
        value, market trend, mileage sensitivity, model-generation demand,
        ownership cost assumptions, and the key factors listed on each horizon.
        Confidence reflects data depth, recency, and comparable fit.
      </Text>
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        {resaleYears.map((key) => {
          const p = resaleTimeline[key]
          const positive = p.percentChange >= 0
          const deltaColor = positive ? tokens.positive : tokens.negative
          return (
            <View
              key={key}
              style={[styles.card, { flex: 1, paddingVertical: 12, paddingHorizontal: 10 }]}
              wrap={false}
            >
              <Text style={[styles.eyebrow, { color: tokens.primary }]}>
                {periodLabel(key)}
              </Text>
              <Text
                style={[
                  styles.mono,
                  { fontSize: 8.5, marginTop: 6, color: tokens.foreground },
                ]}
              >
                {fmtCurrency(p.estimatedRange.low)}–{fmtCurrency(p.estimatedRange.high)}
              </Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 18,
                  letterSpacing: -0.3,
                  color: deltaColor,
                  marginTop: 4,
                }}
              >
                {fmtDelta(p.percentChange)}
              </Text>
              <Text style={[styles.bodyMuted, { fontSize: 8, marginTop: 4 }]}>
                Confidence: {humanize(p.confidence)}
              </Text>
              {p.keyFactors.length > 0 && (
                <View style={{ marginTop: 6 }}>
                  {p.keyFactors.slice(0, 2).map((factor, i) => (
                    <View
                      key={i}
                      style={{ flexDirection: "row", marginBottom: 2 }}
                    >
                      <Text
                        style={[
                          styles.bodyMuted,
                          { fontSize: 8, color: tokens.primary, marginRight: 4 },
                        ]}
                      >
                        ·
                      </Text>
                      <Text style={[styles.bodyMuted, { fontSize: 8, flex: 1 }]}>
                        {factor}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          )
        })}
      </View>

      {/* ── Investment Narrative — closing thesis ────────────────── */}
      {investmentNarrative ? (
        <View style={styles.cardLavender}>
          <Text style={[styles.h3, { color: tokens.primary, marginBottom: 6 }]}>
            Investment Narrative
          </Text>
          <Text
            style={[
              styles.body,
              {
                fontFamily: "Cormorant",
                fontSize: 13,
                fontWeight: 400,
                lineHeight: 1.55,
                color: tokens.foreground,
              },
            ]}
          >
            {investmentNarrative}
          </Text>
        </View>
      ) : null}
    </PageWrap>
  )
}
