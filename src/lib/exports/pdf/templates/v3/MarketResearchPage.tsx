import { Page, Text, View } from "@react-pdf/renderer"
import type { MarketResearch } from "@/lib/reports/types-v3"
import { pdfStyles, PDF_COLORS } from "../../styles"
import { PageFooter } from "../PageFooter"

interface Props {
  data: MarketResearch
  reportHash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

function sentimentColor(s: "positive" | "mixed" | "negative") {
  if (s === "positive") return PDF_COLORS.positive
  if (s === "negative") return PDF_COLORS.negative
  return PDF_COLORS.warning
}

export function MarketResearchPage({ data, reportHash, generatedAt, pageNumber, totalPages }: Props) {
  // Defensively handle expertConsensus — AI may return a bare array instead of { compiledAnalysis: [...] }
  const compiledAnalysis = Array.isArray(data.expertConsensus)
    ? data.expertConsensus as { category: string; sentiment: "positive" | "mixed" | "negative"; summary: string }[]
    : data.expertConsensus?.compiledAnalysis ?? []

  return (
    <Page size="A4" style={pdfStyles.page}>
      <View style={{ flex: 1 }}>
        <Text style={pdfStyles.h2}>Market Research</Text>

        {/* Expert Consensus */}
        {compiledAnalysis.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={pdfStyles.h3}>Expert Consensus</Text>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {compiledAnalysis.slice(0, 6).map((item, i) => (
                <View key={i} style={[pdfStyles.card, { width: "48%" }]} wrap={false}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 4 }}>
                    <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: sentimentColor(item.sentiment) }} />
                    <Text style={[pdfStyles.bodyEmphasis, { fontSize: 9 }]}>{item.category}</Text>
                  </View>
                  <Text style={[pdfStyles.bodyMuted, { lineHeight: 1.4 }]}>{item.summary}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Owner Sentiment */}
        <Text style={pdfStyles.h3}>Owner Sentiment</Text>
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 14 }}>
          {/* Praise */}
          {data.ownerSentiment.commonPraise.length > 0 && (
            <View style={[pdfStyles.card, { flex: 1 }]}>
              <Text style={[pdfStyles.bodyEmphasis, { color: PDF_COLORS.positive, marginBottom: 4 }]}>
                What Owners Love
              </Text>
              {data.ownerSentiment.commonPraise.slice(0, 5).map((p, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={[pdfStyles.body, { color: PDF_COLORS.positive, marginRight: 4 }]}>+</Text>
                  <Text style={[pdfStyles.bodyMuted, { flex: 1 }]}>{p}</Text>
                </View>
              ))}
            </View>
          )}
          {/* Complaints */}
          {data.ownerSentiment.commonComplaints.length > 0 && (
            <View style={[pdfStyles.card, { flex: 1 }]}>
              <Text style={[pdfStyles.bodyEmphasis, { color: PDF_COLORS.negative, marginBottom: 4 }]}>
                Common Complaints
              </Text>
              {data.ownerSentiment.commonComplaints.slice(0, 5).map((c, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 2 }}>
                  <Text style={[pdfStyles.body, { color: PDF_COLORS.negative, marginRight: 4 }]}>−</Text>
                  <Text style={[pdfStyles.bodyMuted, { flex: 1 }]}>{c}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Owner Tips */}
        {data.ownerSentiment.ownerTips.length > 0 && (
          <View style={{ marginBottom: 14 }}>
            <Text style={pdfStyles.h3}>Owner Tips</Text>
            {data.ownerSentiment.ownerTips.slice(0, 5).map((tip, i) => (
              <View key={i} style={{ flexDirection: "row", marginBottom: 3, paddingLeft: 4 }}>
                <Text style={[pdfStyles.body, { color: PDF_COLORS.primary, marginRight: 6 }]}>→</Text>
                <Text style={pdfStyles.body}>{tip}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Heritage */}
        {data.heritage && (
          <View style={[pdfStyles.card, { borderColor: PDF_COLORS.primary }]}>
            <Text style={pdfStyles.h3}>Heritage & Significance</Text>
            <Text style={[pdfStyles.body, { marginTop: 4, lineHeight: 1.6 }]}>{data.heritage}</Text>
          </View>
        )}

        {/* Events & Clubs */}
        {(data.relevantEvents.length > 0 || data.ownerClubs.length > 0) && (
          <View style={{ marginTop: 10 }}>
            {data.relevantEvents.length > 0 && (
              <View>
                <Text style={pdfStyles.h3}>Relevant Events</Text>
                {data.relevantEvents.slice(0, 4).map((e, i) => (
                  <View key={i} style={{ marginBottom: 4, paddingLeft: 4 }}>
                    <Text style={pdfStyles.bodyEmphasis}>{e.name}</Text>
                    <Text style={pdfStyles.bodyMuted}>{e.frequency} · {e.location}</Text>
                  </View>
                ))}
              </View>
            )}
            {data.ownerClubs.length > 0 && (
              <View style={{ marginTop: 6 }}>
                <Text style={pdfStyles.h3}>Owner Clubs</Text>
                <Text style={pdfStyles.body}>{data.ownerClubs.join(" · ")}</Text>
              </View>
            )}
          </View>
        )}
      </View>

      <PageFooter hash={reportHash} generatedAt={generatedAt} pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  )
}
