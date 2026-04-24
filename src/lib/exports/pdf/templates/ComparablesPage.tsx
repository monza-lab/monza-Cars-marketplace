import { Page, Text, View } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { DbComparableRow } from "@/lib/db/queries"
import type { RegionalMarketStats } from "@/lib/reports/types"
import { pdfStyles, PDF_COLORS, fmtK } from "../styles"
import { PageFooter } from "./PageFooter"

interface Props {
  report: HausReportV2
  comparables: DbComparableRow[]
  regions: RegionalMarketStats[]
  pageNumber: number
  totalPages: number
}

export function ComparablesPage({
  report,
  comparables,
  regions,
  pageNumber,
  totalPages,
}: Props) {
  const d3 = report.market_intel.d3

  return (
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.h2}>Comparables & Peer Positioning</Text>
      {d3.variant_distribution_bins.length > 0 ? (
        <Text style={pdfStyles.body}>
          This VIN falls in the{" "}
          <Text style={pdfStyles.bodyEmphasis}>
            {d3.vin_percentile_within_variant}th percentile
          </Text>{" "}
          of variant sold prices in the last 12 months.
        </Text>
      ) : (
        <Text style={pdfStyles.bodyMuted}>
          Not enough sold comparables to compute peer positioning yet.
        </Text>
      )}

      <Text style={[pdfStyles.h3, { marginTop: 10 }]}>Comparables</Text>
      {comparables.length === 0 ? (
        <View style={pdfStyles.cardDashed}>
          <Text style={pdfStyles.bodyMuted}>No comparables available for this listing yet.</Text>
        </View>
      ) : (
        <>
          <View
            style={{
              flexDirection: "row",
              paddingHorizontal: 8,
              paddingVertical: 4,
              borderBottomWidth: 1,
              borderBottomColor: PDF_COLORS.border,
            }}
          >
            <Text style={[pdfStyles.bodyMuted, { flex: 3 }]}>Title</Text>
            <Text style={[pdfStyles.bodyMuted, { flex: 1 }]}>Mileage</Text>
            <Text style={[pdfStyles.bodyMuted, { flex: 1 }]}>Sold</Text>
            <Text style={[pdfStyles.bodyMuted, { flex: 1.2 }]}>Date · Source</Text>
          </View>
          {comparables.slice(0, 14).map((c, i) => (
            <View
              key={`${c.platform}-${i}`}
              style={{
                flexDirection: "row",
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderBottomWidth: 1,
                borderBottomColor: PDF_COLORS.border,
              }}
              wrap={false}
            >
              <Text style={[pdfStyles.body, { flex: 3 }]}>{c.title}</Text>
              <Text style={[pdfStyles.body, { flex: 1 }]}>
                {c.mileage?.toLocaleString() ?? "—"}
              </Text>
              <Text style={[pdfStyles.mono, { flex: 1 }]}>{fmtK(c.soldPrice)}</Text>
              <Text style={[pdfStyles.bodyMuted, { flex: 1.2 }]}>
                {c.soldDate ?? "—"} · {c.platform}
              </Text>
            </View>
          ))}
          {comparables.length > 14 && (
            <Text style={[pdfStyles.bodyMuted, { marginTop: 4, textAlign: "right" }]}>
              + {comparables.length - 14} more in full report online
            </Text>
          )}
        </>
      )}

      {regions.length > 0 && (
        <>
          <Text style={[pdfStyles.h2, { marginTop: 14 }]}>Market Context</Text>
          <View style={{ flexDirection: "row", gap: 8 }}>
            {regions.slice(0, 4).map((r) => (
              <View key={r.region} style={[pdfStyles.card, { flex: 1, marginBottom: 0 }]} wrap={false}>
                <Text style={[pdfStyles.bodyEmphasis, { fontSize: 10 }]}>{r.region}</Text>
                <Text style={[pdfStyles.mono, { marginTop: 2 }]}>{fmtK(r.medianPriceUsd)}</Text>
                <Text style={pdfStyles.bodyMuted}>{r.totalListings} sold · {r.trendDirection}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      <PageFooter
        hash={report.report_hash}
        generatedAt={report.generated_at}
        pageNumber={pageNumber}
        totalPages={totalPages}
      />
    </Page>
  )
}
