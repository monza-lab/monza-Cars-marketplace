import { Page, Text, View } from "@react-pdf/renderer"
import type { TechnicalAnalysis } from "@/lib/reports/types-v3"
import { pdfStyles, PDF_COLORS } from "../../styles"
import { PageFooter } from "../PageFooter"

interface Props {
  data: TechnicalAnalysis
  reportHash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

function severityColor(severity: "critical" | "moderate" | "minor") {
  if (severity === "critical") return PDF_COLORS.negative
  if (severity === "moderate") return PDF_COLORS.warning
  return PDF_COLORS.muted
}

function rarityLabel(r: string) {
  return r.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())
}

export function TechnicalAnalysisPage({ data, reportHash, generatedAt, pageNumber, totalPages }: Props) {
  return (
    <Page size="A4" style={pdfStyles.page}>
      <View style={{ flex: 1 }}>
        <Text style={pdfStyles.h2}>Technical Deep-Dive</Text>

        {/* Model History */}
        <Text style={[pdfStyles.body, { lineHeight: 1.6, marginBottom: 10 }]}>
          {data.modelHistory}
        </Text>

        {/* What Makes This Spec Special */}
        <View style={[pdfStyles.card, { borderColor: PDF_COLORS.primary }]}>
          <Text style={pdfStyles.h3}>What Makes This Spec Special</Text>
          <Text style={[pdfStyles.body, { marginTop: 4, lineHeight: 1.6 }]}>
            {data.whatMakesThisSpecSpecial}
          </Text>
        </View>

        {/* Production Data */}
        {data.productionData && (
          <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
            {data.productionData.totalProduction && (
              <View style={[pdfStyles.card, { flex: 1 }]}>
                <Text style={pdfStyles.h3}>Total Production</Text>
                <Text style={[pdfStyles.body, { marginTop: 4 }]}>{data.productionData.totalProduction}</Text>
              </View>
            )}
            {data.productionData.thisConfigEstimate && (
              <View style={[pdfStyles.card, { flex: 1 }]}>
                <Text style={pdfStyles.h3}>This Config</Text>
                <Text style={[pdfStyles.body, { marginTop: 4 }]}>{data.productionData.thisConfigEstimate}</Text>
              </View>
            )}
            <View style={[pdfStyles.card, { flex: 1 }]}>
              <Text style={pdfStyles.h3}>Rarity</Text>
              <Text style={[pdfStyles.body, { marginTop: 4, color: PDF_COLORS.primary }]}>
                {rarityLabel(data.productionData.rarityAssessment)}
              </Text>
            </View>
          </View>
        )}

        {/* Key Strengths */}
        {data.keyStrengths.length > 0 && (
          <View>
            <Text style={pdfStyles.h3}>Key Strengths</Text>
            {data.keyStrengths.slice(0, 6).map((s, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 4, paddingLeft: 4 }}>
                <Text style={[pdfStyles.body, { color: PDF_COLORS.positive, marginRight: 6 }]}>+</Text>
                <View style={{ flex: 1 }}>
                  <Text style={pdfStyles.bodyEmphasis}>{s.point}</Text>
                  <Text style={pdfStyles.bodyMuted}>{s.detail}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Common Issues */}
        {data.commonIssues.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={pdfStyles.h3}>Known Issues</Text>
            {data.commonIssues.slice(0, 5).map((issue, i) => (
              <View key={i} style={[pdfStyles.card, { paddingVertical: 8 }]} wrap={false}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                  <Text style={[pdfStyles.bodyEmphasis, { color: severityColor(issue.severity), fontSize: 8, textTransform: "uppercase" }]}>
                    {issue.severity}
                  </Text>
                  <Text style={pdfStyles.bodyEmphasis}>{issue.issue}</Text>
                </View>
                {issue.typicalCost && (
                  <Text style={[pdfStyles.bodyMuted, { marginTop: 2 }]}>
                    Typical cost: {issue.typicalCost} · {issue.appliesTo}
                  </Text>
                )}
              </View>
            ))}
          </View>
        )}

        {/* Collector Outlook */}
        {data.collectorOutlook && (
          <View style={[pdfStyles.card, { backgroundColor: "#1F1A14", borderColor: PDF_COLORS.warning, marginTop: 10 }]}>
            <Text style={pdfStyles.h3}>Collector Outlook</Text>
            <View style={{ flexDirection: "row", gap: 14, marginTop: 4, marginBottom: 6 }}>
              <Text style={pdfStyles.bodyMuted}>
                Investment: {rarityLabel(data.collectorOutlook.investmentGrade)}
              </Text>
              <Text style={pdfStyles.bodyMuted}>
                Demand: {rarityLabel(data.collectorOutlook.demandLevel)}
              </Text>
            </View>
            <Text style={[pdfStyles.body, { lineHeight: 1.5 }]}>
              {data.collectorOutlook.futureOutlook}
            </Text>
          </View>
        )}
      </View>

      <PageFooter hash={reportHash} generatedAt={generatedAt} pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  )
}
