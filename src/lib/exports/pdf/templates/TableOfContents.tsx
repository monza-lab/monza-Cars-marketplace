import { Page, Text, View } from "@react-pdf/renderer"
import { createPdfStyles, getThemeTokens } from "../styles"
import type { PdfTheme } from "../theme"
import { PageFooter } from "./PageFooter"

export interface TocEntry {
  number: string         // "01", "02", ...
  title: string          // "Executive Summary"
  summary?: string       // one-line description
  page: number           // page number where it starts
}

interface TableOfContentsProps {
  entries: TocEntry[]
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
}

export function TableOfContents({
  entries,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
}: TableOfContentsProps) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)

  return (
    <Page size="A4" style={styles.page}>
      <View>
        <Text style={styles.chapterEyebrow}>Contents</Text>
        <Text style={[styles.chapter, { marginBottom: 8 }]}>What's inside</Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 28 }]}>
          A complete Haus Report — ten chapters covering valuation, technical
          history, market intelligence, ownership economics, and what to verify
          before committing.
        </Text>
      </View>

      <View style={{ flexDirection: "column", gap: 0 }}>
        {entries.map((entry, idx) => (
          <View
            key={entry.number}
            style={{
              flexDirection: "row",
              alignItems: "flex-start",
              paddingVertical: 10,
              borderTopWidth: idx === 0 ? 1 : 0,
              borderBottomWidth: 1,
              borderColor: tokens.borderSoft,
            }}
          >
            <Text
              style={{
                fontFamily: "Karla",
                fontWeight: 600,
                fontSize: 9,
                color: tokens.primary,
                width: 36,
                letterSpacing: 1.5,
                paddingTop: 3,
              }}
            >
              {entry.number}
            </Text>
            <View style={{ flex: 1 }}>
              <Text
                style={{
                  fontFamily: "Cormorant",
                  fontWeight: 500,
                  fontSize: 17,
                  color: tokens.foreground,
                  letterSpacing: -0.2,
                }}
              >
                {entry.title}
              </Text>
              {entry.summary ? (
                <Text style={[styles.bodyMuted, { marginTop: 3 }]}>{entry.summary}</Text>
              ) : null}
            </View>
            <Text
              style={{
                fontFamily: "Courier",
                fontSize: 10,
                color: tokens.muted,
                paddingTop: 4,
                marginLeft: 12,
              }}
            >
              {String(entry.page).padStart(2, "0")}
            </Text>
          </View>
        ))}
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
