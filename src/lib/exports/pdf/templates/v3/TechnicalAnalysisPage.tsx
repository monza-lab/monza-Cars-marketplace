import { Page, Text, View } from "@react-pdf/renderer"
import type { TechnicalAnalysis } from "@/lib/reports/types-v3"
import { createPdfStyles, getThemeTokens } from "../../styles"
import type { PdfTheme } from "../../theme"
import { humanize, truncate } from "../../utils"
import { PageFooter } from "../PageFooter"

interface Props {
  data: TechnicalAnalysis
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
}

function severityColor(
  severity: "critical" | "moderate" | "minor",
  tokens: ReturnType<typeof getThemeTokens>,
) {
  if (severity === "critical") return tokens.negative
  if (severity === "moderate") return tokens.warning
  return tokens.muted
}

export function TechnicalAnalysisPage({
  data,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
}: Props) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)

  const lede = truncate(data.modelHistory, 250)

  return (
    <Page size="A4" style={styles.page}>
      {/* Chapter opener */}
      <View>
        <Text style={styles.chapterEyebrow}>Chapter 04 · Technical</Text>
        <Text style={[styles.chapter, { marginBottom: 14 }]}>
          Technical Deep-Dive
        </Text>
        <Text
          style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}
        >
          {lede}
        </Text>
      </View>

      {/* What makes this spec special — hero card */}
      <View style={styles.cardLavender}>
        <Text style={[styles.h3, { color: tokens.primary, marginBottom: 6 }]}>
          What Makes This Spec Special
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
          {data.whatMakesThisSpecSpecial}
        </Text>
      </View>

      {/* Production data — three columns inside a soft card */}
      {data.productionData ? (
        <View style={styles.cardSoft}>
          <View style={{ flexDirection: "row", gap: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>Total Production</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: -0.2,
                  color: tokens.foreground,
                  marginTop: 4,
                }}
              >
                {data.productionData.totalProduction ?? "—"}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                borderLeftWidth: 1,
                borderLeftColor: tokens.border,
                paddingLeft: 12,
              }}
            >
              <Text style={styles.h3}>This Config</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: -0.2,
                  color: tokens.foreground,
                  marginTop: 4,
                }}
              >
                {data.productionData.thisConfigEstimate ?? "—"}
              </Text>
            </View>
            <View
              style={{
                flex: 1,
                borderLeftWidth: 1,
                borderLeftColor: tokens.border,
                paddingLeft: 12,
              }}
            >
              <Text style={styles.h3}>Rarity</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: -0.2,
                  color: tokens.primary,
                  marginTop: 4,
                }}
              >
                {humanize(data.productionData.rarityAssessment)}
              </Text>
            </View>
          </View>
          {data.productionData.rarityNote ? (
            <Text style={[styles.bodyMuted, { marginTop: 8 }]}>
              {data.productionData.rarityNote}
            </Text>
          ) : null}
        </View>
      ) : null}

      {/* Key strengths */}
      {data.keyStrengths.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.h2}>Key Strengths</Text>
          <View style={{ marginTop: 4 }}>
            {data.keyStrengths.slice(0, 6).map((s, i) => (
              <View
                key={i}
                style={{
                  flexDirection: "row",
                  marginBottom: 8,
                  paddingLeft: 2,
                }}
              >
                <Text
                  style={{
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 14,
                    color: tokens.primary,
                    marginRight: 8,
                    lineHeight: 1,
                  }}
                >
                  +
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.bodyEmphasis}>{s.point}</Text>
                  <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
                    {s.detail}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {/* Known issues */}
      {data.commonIssues.length > 0 ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.h2}>Known Issues</Text>
          {data.commonIssues.slice(0, 5).map((issue, i) => (
            <View
              key={i}
              style={[styles.card, { paddingVertical: 10 }]}
              wrap={false}
            >
              <View
                style={{
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 8,
                  marginBottom: 4,
                }}
              >
                <Text
                  style={[
                    styles.tag,
                    {
                      color: severityColor(issue.severity, tokens),
                      borderColor: severityColor(issue.severity, tokens),
                    },
                  ]}
                >
                  {humanize(issue.severity)}
                </Text>
                <Text style={[styles.bodyEmphasis, { flex: 1 }]}>
                  {issue.issue}
                </Text>
              </View>
              {(issue.typicalCost || issue.appliesTo) ? (
                <Text style={styles.bodyMuted}>
                  {issue.typicalCost
                    ? `Typical cost: ${issue.typicalCost}`
                    : "Cost varies"}
                  {issue.appliesTo ? ` · Applies to ${issue.appliesTo}` : ""}
                </Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}

      {/* Reliability */}
      {data.reliability ? (
        <View style={{ marginTop: 6 }}>
          <Text style={styles.h2}>Reliability</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 8 }}>
            <View style={[styles.cardSoft, { flex: 1 }]}>
              <Text style={styles.h3}>Rating</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: -0.2,
                  color: tokens.foreground,
                  marginTop: 4,
                }}
              >
                {humanize(data.reliability.rating)}
              </Text>
            </View>
            <View style={[styles.cardSoft, { flex: 1 }]}>
              <Text style={styles.h3}>Maintenance Cost</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 16,
                  letterSpacing: -0.2,
                  color: tokens.foreground,
                  marginTop: 4,
                }}
              >
                {humanize(data.reliability.maintenanceCostLevel)}
              </Text>
            </View>
          </View>
          {data.reliability.commonProblems.length > 0 ? (
            <View>
              <Text style={[styles.h3, { marginBottom: 6 }]}>
                Common Problems
              </Text>
              {data.reliability.commonProblems.slice(0, 5).map((problem, i) => (
                <View
                  key={i}
                  style={{
                    flexDirection: "row",
                    marginBottom: 4,
                    paddingLeft: 2,
                  }}
                >
                  <Text
                    style={{
                      color: tokens.muted,
                      marginRight: 8,
                      fontSize: 10,
                    }}
                  >
                    ·
                  </Text>
                  <Text style={[styles.body, { flex: 1 }]}>{problem}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Collector outlook — lavender summary */}
      {data.collectorOutlook ? (
        <View style={[styles.cardLavender, { marginTop: 10 }]}>
          <Text style={[styles.h3, { color: tokens.primary, marginBottom: 8 }]}>
            Collector Outlook
          </Text>
          <View
            style={{
              flexDirection: "row",
              gap: 16,
              marginBottom: 8,
              paddingBottom: 8,
              borderBottomWidth: 1,
              borderBottomColor: tokens.border,
            }}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>Investment Grade</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 15,
                  letterSpacing: -0.2,
                  color: tokens.foreground,
                  marginTop: 4,
                }}
              >
                {humanize(data.collectorOutlook.investmentGrade)}
              </Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.h3}>Demand</Text>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 15,
                  letterSpacing: -0.2,
                  color: tokens.foreground,
                  marginTop: 4,
                }}
              >
                {humanize(data.collectorOutlook.demandLevel)}
              </Text>
            </View>
          </View>
          <Text
            style={[
              styles.body,
              {
                fontFamily: "Cormorant",
                fontSize: 12,
                fontWeight: 400,
                lineHeight: 1.55,
                color: tokens.foreground,
              },
            ]}
          >
            {data.collectorOutlook.futureOutlook}
          </Text>
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
