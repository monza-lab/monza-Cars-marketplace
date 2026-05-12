import { Page, Text, View } from "@react-pdf/renderer"
import type { FinalSynthesis } from "@/lib/reports/types-v3"
import { pdfStyles, PDF_COLORS, verdictColors, fmtK } from "../../styles"
import { PageFooter } from "../PageFooter"

interface Props {
  data: FinalSynthesis
  reportHash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

export function ExecutiveSummaryPage({ data, reportHash, generatedAt, pageNumber, totalPages }: Props) {
  const { executiveSummary, finalRecommendation } = data
  const km = executiveSummary.keyMetrics
  const vColors = verdictColors(km.verdict)

  return (
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.h2}>Executive Summary</Text>

      {/* Headline */}
      <Text style={[pdfStyles.body, { fontSize: 12, lineHeight: 1.6, marginBottom: 14 }]}>
        {executiveSummary.headline}
      </Text>

      {/* Key Metrics row */}
      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <View style={[pdfStyles.card, { flex: 1, alignItems: "center" }]}>
          <Text style={pdfStyles.h3}>Fair Value</Text>
          <Text style={[pdfStyles.monoBold, { fontSize: 12, marginTop: 4 }]}>
            {km.fairValueRange}
          </Text>
        </View>

        <View style={[pdfStyles.card, { flex: 1, alignItems: "center" }]}>
          <Text style={pdfStyles.h3}>Verdict</Text>
          <View style={{ marginTop: 4 }}>
            <Text
              style={[
                pdfStyles.verdictChip,
                { fontSize: 11, paddingHorizontal: 12, paddingVertical: 4, color: vColors.color, borderColor: vColors.borderColor },
              ]}
            >
              {km.verdict}
            </Text>
          </View>
        </View>

        <View style={[pdfStyles.card, { flex: 1, alignItems: "center" }]}>
          <Text style={pdfStyles.h3}>Risk Score</Text>
          <Text
            style={[
              pdfStyles.monoBold,
              { fontSize: 14, marginTop: 4, color: km.riskScore <= 30 ? PDF_COLORS.positive : km.riskScore <= 60 ? PDF_COLORS.warning : PDF_COLORS.negative },
            ]}
          >
            {km.riskScore}/100
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
        <View style={[pdfStyles.card, { flex: 1 }]}>
          <Text style={pdfStyles.h3}>Signals Coverage</Text>
          <Text style={[pdfStyles.body, { marginTop: 4 }]}>{km.signalsCoverage}</Text>
        </View>
        <View style={[pdfStyles.card, { flex: 1 }]}>
          <Text style={pdfStyles.h3}>Market Position</Text>
          <Text style={[pdfStyles.body, { marginTop: 4 }]}>{km.marketPosition}</Text>
        </View>
      </View>

      {/* Investment Thesis */}
      <View style={[pdfStyles.card, { backgroundColor: "#1F1A14", borderColor: PDF_COLORS.warning }]}>
        <Text style={pdfStyles.h3}>Investment Thesis</Text>
        <Text style={[pdfStyles.body, { marginTop: 4, lineHeight: 1.6 }]}>
          {executiveSummary.investmentThesis}
        </Text>
      </View>

      {/* Final Recommendation */}
      {finalRecommendation && (
        <View style={{ marginTop: 10 }}>
          <View style={pdfStyles.divider} />
          <View style={{ flexDirection: "row", gap: 14, marginTop: 8 }}>
            <View style={{ flex: 1 }}>
              <Text style={pdfStyles.h3}>Final Score</Text>
              <Text style={[pdfStyles.monoBold, { fontSize: 18 }]}>
                {finalRecommendation.score}/100
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pdfStyles.h3}>Condition Estimate</Text>
              <Text style={pdfStyles.body}>{finalRecommendation.conditionEstimate}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={pdfStyles.h3}>Verdict</Text>
              <Text style={pdfStyles.body}>{finalRecommendation.verdict}</Text>
            </View>
          </View>
        </View>
      )}

      <PageFooter hash={reportHash} generatedAt={generatedAt} pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  )
}
