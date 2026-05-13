import { Page, Text, View } from "@react-pdf/renderer"
import { createPdfStyles, getThemeTokens } from "../styles"
import type { PdfTheme } from "../theme"
import { PageFooter } from "./PageFooter"
import { shortenUrl } from "../utils"

export interface Citation {
  label: string
  url: string
  category: "valuation" | "market-research" | "owner-sentiment" | "expert" | "data"
}

interface CitationsPageProps {
  citations: Citation[]
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
}

const CATEGORY_LABEL: Record<Citation["category"], string> = {
  valuation: "Valuation Modifiers",
  "market-research": "Market Research",
  "owner-sentiment": "Owner Sentiment",
  expert: "Expert Consensus",
  data: "Data & Methodology",
}

export function CitationsPage({
  citations,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
}: CitationsPageProps) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)

  // Group by category
  const grouped = new Map<Citation["category"], Citation[]>()
  for (const c of citations) {
    if (!grouped.has(c.category)) grouped.set(c.category, [])
    grouped.get(c.category)!.push(c)
  }

  const orderedCategories: Citation["category"][] = [
    "valuation",
    "expert",
    "market-research",
    "owner-sentiment",
    "data",
  ]

  return (
    <Page size="A4" style={styles.page}>
      <View>
        <Text style={styles.chapterEyebrow}>Sources</Text>
        <Text style={[styles.chapter, { marginBottom: 10 }]}>
          Where this knowledge comes from
        </Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}>
          Every claim, modifier, and expert quote in this dossier traces back to
          a public source. We list them here so you can verify our reasoning and
          build your own conviction.
        </Text>
      </View>

      <View style={{ flexDirection: "column", gap: 16 }}>
        {orderedCategories.map((cat) => {
          const items = grouped.get(cat)
          if (!items || items.length === 0) return null
          return (
            <View key={cat}>
              <Text
                style={[
                  styles.h3,
                  { color: tokens.primary, marginBottom: 8 },
                ]}
              >
                {CATEGORY_LABEL[cat]}
              </Text>
              <View style={{ flexDirection: "column", gap: 6 }}>
                {items.map((c, i) => {
                  const { domain, path } = shortenUrl(c.url)
                  return (
                    <View
                      key={`${cat}-${i}`}
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        paddingVertical: 6,
                        borderBottomWidth: 1,
                        borderBottomColor: tokens.borderSoft,
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: "Courier",
                          fontSize: 8,
                          color: tokens.muted,
                          width: 22,
                        }}
                      >
                        [{String(i + 1).padStart(2, "0")}]
                      </Text>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={{
                            fontFamily: "Karla",
                            fontWeight: 500,
                            fontSize: 10,
                            color: tokens.foreground,
                          }}
                        >
                          {c.label}
                        </Text>
                        <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
                          {domain}
                          {path ? ` · ${path}` : ""}
                        </Text>
                      </View>
                    </View>
                  )
                })}
              </View>
            </View>
          )
        })}
      </View>

      <View
        style={{
          marginTop: 24,
          paddingTop: 12,
          borderTopWidth: 1,
          borderTopColor: tokens.border,
        }}
      >
        <Text style={[styles.bodyMuted, { color: tokens.mutedStrong }]}>
          Fair Value is derived from the median of comparable sold transactions
          within the same variant, adjusted by modifiers with public citations.
          Modifiers are capped individually at ±15% and in aggregate at ±35%.
          Market Intel dimensions (trajectory, arbitrage, peer positioning,
          freshness) are computed from our market-data corpus aggregated from
          original marketplaces. See monzahaus.com/methodology for full
          documentation.
        </Text>
      </View>

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

/**
 * Helper that collects citations from V2/V3 report data into a unified array.
 */
export function gatherCitations(
  modifiers: { label: string; sourceUrl: string | null | undefined }[],
  expertConsensus?: { category: string }[] | null,
  ownerSentimentSource?: string | null,
  expertQuoteSource?: string | null,
): Citation[] {
  const out: Citation[] = []

  // Valuation modifier citations
  for (const m of modifiers) {
    if (m.sourceUrl) {
      out.push({ label: m.label, url: m.sourceUrl, category: "valuation" })
    }
  }

  // Generic expert + sentiment sources (placeholder until V3 model exposes URLs)
  if (expertQuoteSource) {
    out.push({
      label: "Expert market commentary",
      url: expertQuoteSource,
      category: "expert",
    })
  }
  if (ownerSentimentSource) {
    out.push({
      label: "Aggregated owner reviews",
      url: ownerSentimentSource,
      category: "owner-sentiment",
    })
  }

  // Methodology / data references
  out.push({
    label: "Methodology — valuation engine, modifier weights, confidence tiers",
    url: "https://monzahaus.com/methodology",
    category: "data",
  })
  out.push({
    label: "Aggregated comparable-sales corpus",
    url: "https://monzahaus.com/methodology#data-corpus",
    category: "data",
  })

  return out
}
