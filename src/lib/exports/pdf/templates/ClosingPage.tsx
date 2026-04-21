import { Page, Text, View } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import { pdfStyles, PDF_COLORS } from "../styles"
import { PageFooter } from "./PageFooter"

interface SourceRow {
  label: string
  rows: Array<{ name: string; detail?: string | null; url?: string | null }>
}

function buildSourceCategories(
  report: HausReportV2,
  regions: RegionalMarketStats[]
): SourceRow[] {
  const market: SourceRow["rows"] = []
  for (const r of regions) {
    for (const s of r.sources) {
      market.push({
        name: s,
        detail: `${r.region} · ${r.totalListings} listings · newest ${r.newestDate}`,
      })
    }
  }

  const modifierRows = report.modifiers_applied
    .filter((m) => m.citation_url)
    .map((m) => ({
      name: m.citation_url!,
      detail: m.key.replace(/_/g, " "),
      url: m.citation_url,
    }))

  const refPackRows = report.remarkable_claims
    .filter((c) => c.source_type === "reference_pack" && c.source_url)
    .map((c) => ({ name: c.source_url!, url: c.source_url, detail: c.capture_date }))

  const kbRows = report.remarkable_claims
    .filter((c) => c.source_type === "kb_entry")
    .map((c) => ({ name: c.source_url ?? `KB ${c.source_ref}`, detail: c.capture_date }))

  const agentRows = report.remarkable_claims
    .filter((c) => c.source_type === "specialist_agent")
    .map((c) => ({ name: c.source_url ?? "specialist finding", detail: c.capture_date }))

  return [
    { label: "Market data", rows: market },
    { label: "Modifier citations", rows: modifierRows },
    { label: "Reference pack", rows: refPackRows },
    { label: "Knowledge base", rows: kbRows },
    { label: "Specialist agent", rows: agentRows },
  ].filter((cat) => cat.rows.length > 0)
}

interface Props {
  report: HausReportV2
  regions: RegionalMarketStats[]
  pageNumber: number
  totalPages: number
}

export function ClosingPage({ report, regions, pageNumber, totalPages }: Props) {
  const categories = buildSourceCategories(report, regions)

  return (
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.h2}>Sources</Text>
      {categories.length === 0 ? (
        <View style={pdfStyles.cardDashed}>
          <Text style={pdfStyles.bodyMuted}>No sources cited for this report.</Text>
        </View>
      ) : (
        categories.map((cat) => (
          <View key={cat.label} style={{ marginBottom: 10 }}>
            <Text style={pdfStyles.h3}>{cat.label}</Text>
            {/* Two-column layout to fill the page */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
              {cat.rows.map((row, i) => (
                <View
                  key={`${row.url ?? row.name}-${i}`}
                  style={[pdfStyles.card, { width: "48%", marginBottom: 6, paddingVertical: 6 }]}
                  wrap={false}
                >
                  <Text style={[pdfStyles.body, { fontSize: 9 }]}>{row.name}</Text>
                  {row.detail && (
                    <Text style={[pdfStyles.bodyMuted, { fontSize: 8, marginTop: 2 }]}>{row.detail}</Text>
                  )}
                </View>
              ))}
            </View>
          </View>
        ))
      )}

      <View style={pdfStyles.divider} />

      <Text style={pdfStyles.h3}>Methodology</Text>
      <Text style={pdfStyles.body}>
        Fair Value is derived from the median of comparable sold transactions within the same
        variant, adjusted by up to twelve modifiers with public citations. Modifiers are capped
        individually at ±15% and in aggregate at ±35%. Market Intel dimensions (trajectory,
        arbitrage, peer positioning, freshness) are computed from our market-data corpus aggregated
        from original marketplaces. See monzahaus.com/methodology for full documentation.
      </Text>

      <View style={pdfStyles.divider} />

      <Text style={[pdfStyles.bodyMuted, { fontSize: 8, lineHeight: 1.5 }]}>
        Content is provided for informational and educational purposes only. Market signals,
        price benchmarks, arbitrage scores, and analytical assessments do not constitute
        financial, investment, legal, or tax advice. Collector vehicles are illiquid assets
        with significant transaction costs and price volatility. Past performance does not
        indicate future results. Consult qualified professionals before any purchase or sale
        decision. Monza Haus is an independent market intelligence platform, not affiliated
        with Porsche AG or any of the marketplaces referenced.
      </Text>

      <Text
        style={{
          fontFamily: "Helvetica-Bold",
          fontSize: 8,
          color: PDF_COLORS.muted,
          marginTop: 10,
          letterSpacing: 2,
        }}
      >
        MONZA HAUS · Haus Report
      </Text>

      <PageFooter
        hash={report.report_hash}
        generatedAt={report.generated_at}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />
    </Page>
  )
}
