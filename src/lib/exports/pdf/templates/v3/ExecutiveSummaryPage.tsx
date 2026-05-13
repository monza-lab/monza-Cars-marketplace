import { Page, Text, View } from "@react-pdf/renderer"
import type { FinalSynthesis } from "@/lib/reports/types-v3"
import { createPdfStyles, getThemeTokens, verdictColorsForTheme } from "../../styles"
import type { PdfTheme } from "../../theme"
import { PageFooter } from "../PageFooter"

interface Props {
  data: FinalSynthesis
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
}

function riskColor(score: number, tokens: ReturnType<typeof getThemeTokens>) {
  if (score <= 30) return tokens.positive
  if (score <= 60) return tokens.warning
  return tokens.negative
}

export function ExecutiveSummaryPage({
  data,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
}: Props) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)
  const { executiveSummary, finalRecommendation } = data
  const km = executiveSummary.keyMetrics
  const vColors = verdictColorsForTheme(km.verdict, theme)

  return (
    <Page size="A4" style={styles.page}>
      {/* Chapter opener */}
      <View>
        <Text style={styles.chapterEyebrow}>Chapter 01 · The Verdict</Text>
        <Text style={[styles.chapter, { marginBottom: 14 }]}>Executive Summary</Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}>
          {executiveSummary.headline}
        </Text>
      </View>

      {/* Key metrics — 3 columns, the heart of the page */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 14 }}>
        <View style={[styles.card, { flex: 1, paddingVertical: 14 }]}>
          <Text style={styles.h3}>Fair Value</Text>
          <Text
            style={{
              fontFamily: "Cormorant",
              fontWeight: 500,
              fontSize: 20,
              letterSpacing: -0.3,
              color: tokens.foreground,
              marginTop: 6,
            }}
          >
            {km.fairValueRange}
          </Text>
        </View>

        <View
          style={[
            styles.card,
            { flex: 1, paddingVertical: 14, alignItems: "flex-start" },
          ]}
        >
          <Text style={styles.h3}>Verdict</Text>
          <Text
            style={[
              styles.verdictChip,
              {
                fontSize: 12,
                paddingHorizontal: 14,
                paddingVertical: 5,
                marginTop: 8,
                color: vColors.color,
                borderColor: vColors.borderColor,
                alignSelf: "flex-start",
              },
            ]}
          >
            {km.verdict}
          </Text>
        </View>

        <View style={[styles.card, { flex: 1, paddingVertical: 14 }]}>
          <Text style={styles.h3}>Risk Score</Text>
          <Text
            style={{
              fontFamily: "Cormorant",
              fontWeight: 500,
              fontSize: 26,
              color: riskColor(km.riskScore, tokens),
              marginTop: 2,
              letterSpacing: -0.5,
            }}
          >
            {km.riskScore}
            <Text style={{ fontSize: 12, color: tokens.muted }}> / 100</Text>
          </Text>
        </View>
      </View>

      {/* Signals + Market position */}
      <View style={{ flexDirection: "row", gap: 10, marginBottom: 18 }}>
        <View style={[styles.cardSoft, { flex: 1 }]}>
          <Text style={styles.h3}>Signals Coverage</Text>
          <Text
            style={{
              fontFamily: "Cormorant",
              fontWeight: 500,
              fontSize: 18,
              color: tokens.foreground,
              marginTop: 4,
            }}
          >
            {km.signalsCoverage}
          </Text>
        </View>
        <View style={[styles.cardSoft, { flex: 1 }]}>
          <Text style={styles.h3}>Market Position</Text>
          <Text
            style={{
              fontFamily: "Cormorant",
              fontWeight: 500,
              fontSize: 18,
              color: tokens.foreground,
              marginTop: 4,
            }}
          >
            {km.marketPosition}
          </Text>
        </View>
      </View>

      {/* Investment thesis — hero card with lavender accent */}
      <View style={styles.cardLavender}>
        <Text style={[styles.h3, { color: tokens.primary, marginBottom: 6 }]}>
          Investment Thesis
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
          {executiveSummary.investmentThesis}
        </Text>
      </View>

      {/* Final recommendation */}
      {finalRecommendation ? (
        <View style={{ marginTop: 14 }}>
          <View style={styles.dividerSoft} />
          <View style={{ flexDirection: "row", gap: 20, marginTop: 12, alignItems: "flex-start" }}>
            <View
              style={{
                width: 110,
                paddingRight: 20,
                borderRightWidth: 1,
                borderRightColor: tokens.border,
              }}
            >
              <Text style={styles.h3}>Final Score</Text>
              <View style={{ flexDirection: "row", alignItems: "baseline", marginTop: 4 }}>
                <Text
                  style={{
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 38,
                    color: tokens.foreground,
                    letterSpacing: -1,
                    lineHeight: 1,
                  }}
                >
                  {finalRecommendation.score}
                </Text>
                <Text style={{ fontSize: 12, color: tokens.muted, marginLeft: 4 }}>
                  / 100
                </Text>
              </View>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>Condition</Text>
              <Text style={[styles.body, { marginTop: 4, fontWeight: 500 }]}>
                {finalRecommendation.conditionEstimate}
              </Text>
              <Text style={[styles.bodyMuted, { marginTop: 6 }]}>
                {finalRecommendation.verdict}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      <PageFooter
        hash={reportHash}
        generatedAt={generatedAt}
        pageNumber={pageNumber}
        totalPages={totalPages}
        theme={theme}
      />
    </Page>
  )
}
