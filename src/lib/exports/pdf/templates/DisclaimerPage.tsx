import { Page, Text, View } from "@react-pdf/renderer"
import { createPdfStyles, getThemeTokens } from "../styles"
import type { PdfTheme } from "../theme"
import { Wordmark } from "../Wordmark"
import { PageFooter } from "./PageFooter"

interface DisclaimerPageProps {
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
}

/**
 * Final page of every Haus Report.
 * - Editorial wordmark lockup
 * - Legal disclaimer covering: not financial advice, illiquid assets,
 *   no guarantee of returns, not affiliated with manufacturers,
 *   data limitations, professional consultation requirement.
 * - Brand & copyright line.
 */
export function DisclaimerPage({
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
}: DisclaimerPageProps) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)
  const year = new Date(generatedAt).getFullYear() || new Date().getFullYear()

  return (
    <Page size="A4" style={styles.page}>
      <View>
        <Text style={styles.chapterEyebrow}>Closing</Text>
        <Text style={[styles.chapter, { marginBottom: 12 }]}>
          The fine print
        </Text>
        <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 24 }]}>
          MonzaHaus is an independent market-intelligence platform. This dossier
          is published to support — not replace — your own judgment as a
          collector and steward of investment-grade automotive assets.
        </Text>
      </View>

      <View style={styles.cardLavender}>
        <Text
          style={[
            styles.h3,
            { color: tokens.primary, marginBottom: 8, letterSpacing: 2.6 },
          ]}
        >
          Important — Please Read
        </Text>
        <Text style={[styles.body, { color: tokens.foreground, marginBottom: 8 }]}>
          This report is provided for informational and educational purposes
          only. It does not constitute financial, investment, legal, tax, or
          professional advice. No portion of this dossier should be interpreted
          as a solicitation, recommendation, or offer to buy, sell, or hold any
          asset.
        </Text>
        <Text style={[styles.body, { color: tokens.foreground, marginBottom: 8 }]}>
          Collector vehicles are illiquid alternative assets with elevated
          transaction costs and significant price volatility. Past performance —
          whether of an individual vehicle, model line, or the broader market —
          does not indicate future results. Market signals, valuation ranges,
          arbitrage scores, and any forward-looking statement contained herein
          are estimates derived from publicly available data and proprietary
          analytical methodology; they may prove inaccurate, incomplete, or
          superseded by events occurring after the generation date stated on the
          cover.
        </Text>
        <Text style={[styles.body, { color: tokens.foreground }]}>
          Always commission an in-person pre-purchase inspection by a qualified
          marque specialist, verify chain of custody and title independently,
          and consult licensed financial, legal, and tax professionals before
          executing any transaction.
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 14, marginTop: 4 }}>
        <View style={[styles.cardSoft, { flex: 1 }]}>
          <Text style={styles.h3}>Data Sources</Text>
          <Text style={[styles.bodyMuted, { color: tokens.mutedStrong }]}>
            Sold transactions, listings, and market signals are aggregated from
            public auction platforms and classified marketplaces. Modifiers and
            heritage references cite third-party publications listed throughout
            this dossier.
          </Text>
        </View>
        <View style={[styles.cardSoft, { flex: 1 }]}>
          <Text style={styles.h3}>Independence</Text>
          <Text style={[styles.bodyMuted, { color: tokens.mutedStrong }]}>
            MonzaHaus is not affiliated with Porsche AG, Ferrari S.p.A., BMW AG,
            or any of the marketplaces, brokers, or auction houses referenced.
            All trademarks remain the property of their respective owners.
          </Text>
        </View>
      </View>

      <View style={{ flexDirection: "row", gap: 14 }}>
        <View style={[styles.cardSoft, { flex: 1 }]}>
          <Text style={styles.h3}>Privacy &amp; Confidentiality</Text>
          <Text style={[styles.bodyMuted, { color: tokens.mutedStrong }]}>
            Reports are licensed to the recipient for personal use. Redistribution,
            commercial republication, or sale of this document or its derivatives
            without written authorization is prohibited.
          </Text>
        </View>
        <View style={[styles.cardSoft, { flex: 1 }]}>
          <Text style={styles.h3}>Methodology</Text>
          <Text style={[styles.bodyMuted, { color: tokens.mutedStrong }]}>
            Full methodology — valuation engine, modifier weights, arbitrage
            scoring, confidence tiers — is published at
            monzahaus.com/methodology and is subject to refinement.
          </Text>
        </View>
      </View>

      {/* Closing lockup */}
      <View
        style={{
          marginTop: "auto",
          paddingTop: 28,
          alignItems: "center",
          gap: 8,
        }}
      >
        <Wordmark theme={theme} size={20} />
        <Text
          style={{
            fontFamily: "Karla",
            fontWeight: 500,
            fontSize: 8,
            color: tokens.muted,
            letterSpacing: 2.8,
            textTransform: "uppercase",
            marginTop: 4,
          }}
        >
          The Porsche Collector Platform
        </Text>
        <Text
          style={{
            fontFamily: "Karla",
            fontWeight: 400,
            fontSize: 7.5,
            color: tokens.muted,
            marginTop: 6,
          }}
        >
          © {year} Monza Lab LLC · All rights reserved · monzahaus.com
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
