import { Text, View } from "@react-pdf/renderer"
import { PageWrap } from "../PageWrap"
import type { MarketResearch } from "@/lib/reports/types-v3"
import { createPdfStyles, getThemeTokens } from "../../styles"
import type { PdfTheme } from "../../theme"
import { humanize } from "../../utils"

interface Props {
  data: MarketResearch
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
  /** When false, embed in parent Page (no PageFooter). */
  wrap?: boolean
}

function sentimentDotColor(
  sentiment: "positive" | "mixed" | "negative",
  tokens: ReturnType<typeof getThemeTokens>,
) {
  if (sentiment === "positive") return tokens.positive
  if (sentiment === "negative") return tokens.negative
  return tokens.warning
}

export function MarketResearchPage({
  data,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
  wrap = true,
}: Props) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)

  // Defensively handle expertConsensus — AI may return a bare array instead of { compiledAnalysis: [...] }.
  const compiledAnalysis = Array.isArray(data.expertConsensus)
    ? (data.expertConsensus as {
        category: string
        sentiment: "positive" | "mixed" | "negative"
        summary: string
      }[])
    : data.expertConsensus?.compiledAnalysis ?? []

  const { commonPraise, commonComplaints, ownerTips } = data.ownerSentiment
  const hasPraise = commonPraise.length > 0
  const hasComplaints = commonComplaints.length > 0
  const hasTips = ownerTips.length > 0
  const hasEvents = data.relevantEvents.length > 0
  const hasClubs = data.ownerClubs.length > 0

  return (
    <PageWrap wrap={wrap} theme={theme} hash={reportHash} generatedAt={generatedAt}>
      {/* Chapter opener */}
      <View>
        <Text style={styles.chapterEyebrow}>Chapter 03 · Market</Text>
        <Text style={[styles.chapter, { marginBottom: 14 }]}>Market Research</Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}>
          How specialists, owners, and the broader marketplace see this car — synthesized from
          expert commentary, owner reviews, and heritage context.
        </Text>
      </View>

      {/* Expert Consensus — 2-col grid of cards */}
      {compiledAnalysis.length > 0 && (
        <View>
          <Text style={styles.h2}>Expert Consensus</Text>
          <View
            style={{
              flexDirection: "row",
              flexWrap: "wrap",
              gap: 10,
              marginBottom: 8,
            }}
          >
            {compiledAnalysis.map((item, i) => (
              <View
                key={i}
                style={[
                  styles.card,
                  { width: "48%", marginBottom: 0, paddingTop: 14 },
                ]}
                wrap={false}
              >
                <View
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 6,
                    marginBottom: 6,
                  }}
                >
                  <View
                    style={{
                      width: 6,
                      height: 6,
                      borderRadius: 3,
                      backgroundColor: sentimentDotColor(item.sentiment, tokens),
                    }}
                  />
                  <Text style={[styles.eyebrow, { color: tokens.muted }]}>
                    {humanize(item.sentiment)}
                  </Text>
                </View>
                <Text
                  style={{
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 14,
                    color: tokens.foreground,
                    letterSpacing: -0.2,
                    marginBottom: 4,
                  }}
                >
                  {humanize(item.category)}
                </Text>
                <Text style={[styles.bodyMuted, { lineHeight: 1.5 }]}>
                  {item.summary}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Owner Sentiment */}
      {(hasPraise || hasComplaints) && (
        <View>
          <Text style={styles.h2}>Owner Sentiment</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 4 }}>
            {hasPraise && (
              <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
                <Text
                  style={[
                    styles.h3,
                    { color: tokens.positive, marginBottom: 8 },
                  ]}
                >
                  What Owners Love
                </Text>
                {commonPraise.map((p, i) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", marginBottom: 4 }}
                  >
                    <Text
                      style={[
                        styles.body,
                        { color: tokens.positive, marginRight: 6, width: 8 },
                      ]}
                    >
                      +
                    </Text>
                    <Text style={[styles.body, { flex: 1 }]}>{p}</Text>
                  </View>
                ))}
              </View>
            )}
            {hasComplaints && (
              <View style={[styles.card, { flex: 1, marginBottom: 0 }]}>
                <Text
                  style={[
                    styles.h3,
                    { color: tokens.negative, marginBottom: 8 },
                  ]}
                >
                  Common Complaints
                </Text>
                {commonComplaints.map((c, i) => (
                  <View
                    key={i}
                    style={{ flexDirection: "row", marginBottom: 4 }}
                  >
                    <Text
                      style={[
                        styles.body,
                        { color: tokens.negative, marginRight: 6, width: 8 },
                      ]}
                    >
                      −
                    </Text>
                    <Text style={[styles.body, { flex: 1 }]}>{c}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>
      )}

      {/* Owner Tips */}
      {hasTips && (
        <View style={{ marginTop: 8, marginBottom: 4 }}>
          <Text style={styles.h3}>Owner Tips</Text>
          {ownerTips.map((tip, i) => (
            <View
              key={i}
              style={{ flexDirection: "row", marginBottom: 4 }}
            >
              <Text
                style={[
                  styles.body,
                  { color: tokens.primary, marginRight: 6, width: 10 },
                ]}
              >
                ›
              </Text>
              <Text style={[styles.body, { flex: 1 }]}>{tip}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Heritage — paragraph in serif inside lavender card */}
      {data.heritage && (
        <View>
          <Text style={styles.h2}>Heritage</Text>
          <View style={styles.cardLavender}>
            <Text
              style={{
                fontFamily: "Cormorant",
                fontWeight: 400,
                fontSize: 13,
                lineHeight: 1.55,
                letterSpacing: -0.1,
                color: tokens.foreground,
              }}
            >
              {data.heritage}
            </Text>
          </View>
        </View>
      )}

      {/* Where to Show It — compact list */}
      {hasEvents && (
        <View>
          <Text style={styles.h2}>Where to Show It</Text>
          {data.relevantEvents.map((e, i) => (
            <View key={i} style={{ marginBottom: 8 }} wrap={false}>
              <Text style={styles.bodyEmphasis}>{e.name}</Text>
              <Text style={[styles.bodyMuted, { marginTop: 1 }]}>
                {e.frequency} · {e.location}
              </Text>
              {e.description && (
                <Text style={[styles.body, { marginTop: 3 }]}>{e.description}</Text>
              )}
            </View>
          ))}
        </View>
      )}

      {/* Owner Communities — inline · separated list */}
      {hasClubs && (
        <View style={{ marginTop: 4 }}>
          <Text style={styles.h2}>Owner Communities</Text>
          <Text style={[styles.body, { lineHeight: 1.6 }]}>
            {data.ownerClubs.join("  ·  ")}
          </Text>
        </View>
      )}
    </PageWrap>
  )
}
