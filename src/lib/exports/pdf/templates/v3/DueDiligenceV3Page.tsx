import { Page, Text, View } from "@react-pdf/renderer"
import type { DueDiligenceReport } from "@/lib/reports/types-v3"
import { createPdfStyles, getThemeTokens } from "../../styles"
import type { PdfTheme } from "../../theme"
import { humanize } from "../../utils"
import { PageFooter } from "../PageFooter"

interface Props {
  data: DueDiligenceReport
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

function priorityColor(
  p: "critical" | "recommended" | "optional",
  tokens: ReturnType<typeof getThemeTokens>,
) {
  if (p === "critical") return tokens.negative
  if (p === "recommended") return tokens.warning
  return tokens.muted
}

export function DueDiligenceV3Page({
  data,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
}: Props) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)

  // Group questions by category, preserving first-seen order.
  const grouped = new Map<string, DueDiligenceReport["questions"]>()
  for (const q of data.questions) {
    const list = grouped.get(q.category) ?? []
    list.push(q)
    grouped.set(q.category, list)
  }

  const overall = data.riskScore.overall
  const overallColor = riskColor(overall, tokens)

  return (
    <Page size="A4" style={styles.page}>
      {/* Chapter opener */}
      <View>
        <Text style={styles.chapterEyebrow}>Chapter 05 · Risk</Text>
        <Text style={[styles.chapter, { marginBottom: 14 }]}>Due Diligence</Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}>
          What to verify before committing — a structured risk assessment, the
          questions worth asking the seller in writing, and a pre-purchase
          inspection checklist calibrated to this model.
        </Text>
      </View>

      {/* Risk score — left column number, right column breakdown bars */}
      <View style={{ flexDirection: "row", gap: 18, marginBottom: 18 }}>
        <View
          style={{
            flex: 0,
            paddingRight: 18,
            borderRightWidth: 1,
            borderRightColor: tokens.border,
            minWidth: 140,
          }}
        >
          <Text style={styles.h3}>Overall Risk</Text>
          <Text
            style={[
              styles.priceLarge,
              { fontSize: 56, color: overallColor, marginTop: 2 },
            ]}
          >
            {overall}
            <Text
              style={{
                fontFamily: "Cormorant",
                fontWeight: 400,
                fontSize: 18,
                color: tokens.muted,
                letterSpacing: -0.2,
              }}
            >
              {" "}
              / 100
            </Text>
          </Text>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.h3, { marginBottom: 8 }]}>Risk Breakdown</Text>
          {data.riskScore.breakdown.map((b, i) => {
            const barColor = riskColor(b.score, tokens)
            const pct = Math.max(0, Math.min(100, b.score))
            return (
              <View
                key={i}
                style={{ marginBottom: i === data.riskScore.breakdown.length - 1 ? 0 : 8 }}
                wrap={false}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    marginBottom: 3,
                  }}
                >
                  <Text
                    style={[
                      styles.bodyEmphasis,
                      { flex: 1, fontSize: 9.5 },
                    ]}
                  >
                    {humanize(b.category)}
                  </Text>
                  <Text
                    style={{
                      fontFamily: "Cormorant",
                      fontWeight: 500,
                      fontSize: 14,
                      color: barColor,
                      letterSpacing: -0.2,
                    }}
                  >
                    {b.score}
                  </Text>
                </View>
                <View
                  style={{
                    height: 5,
                    backgroundColor: tokens.borderSoft,
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <View
                    style={{
                      width: `${pct}%`,
                      height: 5,
                      backgroundColor: barColor,
                      borderRadius: 3,
                    }}
                  />
                </View>
                {b.note ? (
                  <Text style={[styles.bodyMuted, { fontSize: 8.5, marginTop: 4 }]}>
                    {b.note}
                  </Text>
                ) : null}
              </View>
            )
          })}
        </View>
      </View>

      <View style={styles.dividerSoft} />

      {/* Questions to Ask the Seller */}
      <Text style={styles.h2}>Questions to Ask the Seller</Text>
      {Array.from(grouped.entries()).map(([category, questions]) => (
        <View key={category} style={{ marginBottom: 10 }} wrap={false}>
          <Text
            style={[
              styles.h3,
              { color: tokens.primary, marginBottom: 6 },
            ]}
          >
            {humanize(category)}
          </Text>
          {questions.map((q, i) => (
            <View key={i} style={{ marginBottom: 6, paddingLeft: 4 }}>
              <Text style={[styles.bodyEmphasis, { marginBottom: 2 }]}>
                {q.question}
              </Text>
              <Text style={styles.bodyMuted}>{q.whyItMatters}</Text>
            </View>
          ))}
        </View>
      ))}

      {/* PPI Checklist */}
      {data.ppiChecklist.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.h2}>Pre-Purchase Inspection Checklist</Text>
          {data.ppiChecklist.map((item, i) => {
            const isLast = i === data.ppiChecklist.length - 1
            const pColor = priorityColor(item.priority, tokens)
            const isCritical = item.priority === "critical"
            return (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 10,
                  paddingVertical: 6,
                  borderBottomWidth: isLast ? 0 : 1,
                  borderBottomColor: tokens.borderSoft,
                }}
                wrap={false}
              >
                <Text
                  style={[
                    isCritical ? styles.tag : styles.tagPrimary,
                    {
                      color: pColor,
                      borderColor: isCritical ? pColor : undefined,
                      backgroundColor: isCritical ? "transparent" : tokens.primaryVeil,
                      minWidth: 70,
                      textAlign: "center",
                      marginTop: 2,
                    },
                  ]}
                >
                  {humanize(item.priority).toUpperCase()}
                </Text>

                <View style={{ flex: 1 }}>
                  <Text style={styles.bodyEmphasis}>{item.item}</Text>
                  <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
                    {item.specificTo}
                  </Text>
                </View>

                <Text
                  style={{
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 12,
                    color: tokens.foreground,
                    letterSpacing: -0.2,
                    minWidth: 70,
                    textAlign: "right",
                    marginTop: 2,
                  }}
                >
                  {item.estimatedCost ?? "—"}
                </Text>
              </View>
            )
          })}
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
