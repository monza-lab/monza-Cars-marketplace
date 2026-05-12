import { Page, Text, View } from "@react-pdf/renderer"
import type { DueDiligenceReport } from "@/lib/reports/types-v3"
import { pdfStyles, PDF_COLORS } from "../../styles"
import { PageFooter } from "../PageFooter"

interface Props {
  data: DueDiligenceReport
  reportHash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

function riskColor(score: number) {
  if (score <= 30) return PDF_COLORS.positive
  if (score <= 60) return PDF_COLORS.warning
  return PDF_COLORS.negative
}

function priorityColor(p: "critical" | "recommended" | "optional") {
  if (p === "critical") return PDF_COLORS.negative
  if (p === "recommended") return PDF_COLORS.warning
  return PDF_COLORS.muted
}

function categoryLabel(c: string) {
  return c.replace(/_/g, " ").replace(/\b\w/g, ch => ch.toUpperCase())
}

export function DueDiligenceV3Page({ data, reportHash, generatedAt, pageNumber, totalPages }: Props) {
  // Group questions by category
  const grouped = new Map<string, typeof data.questions>()
  for (const q of data.questions) {
    const list = grouped.get(q.category) ?? []
    list.push(q)
    grouped.set(q.category, list)
  }

  return (
    <Page size="A4" style={pdfStyles.page}>
      <View style={{ flex: 1 }}>
        <Text style={pdfStyles.h2}>Due Diligence</Text>

        {/* Risk Assessment */}
        <View style={[pdfStyles.card, { marginBottom: 14 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 14 }}>
            <View style={{ alignItems: "center" }}>
              <Text style={pdfStyles.h3}>Overall Risk</Text>
              <Text style={[pdfStyles.monoBold, { fontSize: 22, color: riskColor(data.riskScore.overall) }]}>
                {data.riskScore.overall}
              </Text>
              <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>/ 100</Text>
            </View>
            <View style={{ flex: 1 }}>
              {data.riskScore.breakdown.slice(0, 6).map((b, i) => (
                <View key={i} style={{ flexDirection: "row", alignItems: "center", marginBottom: 3 }}>
                  <Text style={[pdfStyles.bodyMuted, { width: 80, fontSize: 8 }]}>{b.category}</Text>
                  {/* Score bar */}
                  <View style={{ flex: 1, height: 6, backgroundColor: PDF_COLORS.border, borderRadius: 3, marginHorizontal: 6 }}>
                    <View
                      style={{
                        width: `${Math.min(b.score, 100)}%`,
                        height: 6,
                        backgroundColor: riskColor(b.score),
                        borderRadius: 3,
                      }}
                    />
                  </View>
                  <Text style={[pdfStyles.mono, { fontSize: 8, width: 20, textAlign: "right" }]}>{b.score}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        {/* Questions to Ask */}
        <Text style={pdfStyles.h3}>Questions to Ask the Seller</Text>
        {Array.from(grouped.entries()).map(([category, questions]) => (
          <View key={category} style={{ marginBottom: 8 }} wrap={false}>
            <Text style={[pdfStyles.bodyEmphasis, { color: PDF_COLORS.primary, fontSize: 9, marginBottom: 4 }]}>
              {categoryLabel(category)}
            </Text>
            {questions.slice(0, 4).map((q, i) => (
              <View key={i} style={{ marginBottom: 4, paddingLeft: 8 }}>
                <Text style={pdfStyles.body}>{q.question}</Text>
                <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>{q.whyItMatters}</Text>
              </View>
            ))}
          </View>
        ))}

        {/* PPI Checklist */}
        {data.ppiChecklist.length > 0 && (
          <View style={{ marginTop: 10 }}>
            <Text style={pdfStyles.h3}>Pre-Purchase Inspection Checklist</Text>
            {data.ppiChecklist.slice(0, 8).map((item, i) => (
              <View key={i} style={{ flexDirection: "row", alignItems: "flex-start", marginBottom: 4, paddingLeft: 4 }} wrap={false}>
                <Text style={[pdfStyles.bodyMuted, { fontSize: 7, textTransform: "uppercase", color: priorityColor(item.priority), width: 60, marginTop: 1 }]}>
                  {item.priority}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={pdfStyles.body}>{item.item}</Text>
                  <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>
                    {item.specificTo}{item.estimatedCost ? ` · ${item.estimatedCost}` : ""}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      <PageFooter hash={reportHash} generatedAt={generatedAt} pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  )
}
