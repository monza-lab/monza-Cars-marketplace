import { Page, Text, View } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import { pdfStyles, PDF_COLORS, fmtK } from "../styles"
import { PageFooter } from "./PageFooter"

const FLAG: Record<string, string> = { US: "US", EU: "EU", UK: "UK", JP: "JP" }

interface Props {
  report: HausReportV2
  thisVinPriceUsd: number
  pageNumber: number
  totalPages: number
}

export function RemarkableAndArbitragePage({
  report,
  thisVinPriceUsd,
  pageNumber,
  totalPages,
}: Props) {
  const claims = report.remarkable_claims
  const d2 = report.market_intel.d2

  return (
    <Page size="A4" style={pdfStyles.page}>
      {/* What's Remarkable */}
      <Text style={pdfStyles.h2}>What&apos;s Remarkable About This VIN</Text>
      {claims.length === 0 ? (
        <View style={pdfStyles.cardDashed}>
          <Text style={pdfStyles.bodyMuted}>
            No remarkable findings were extracted for this listing.
          </Text>
        </View>
      ) : (
        claims.map((claim) => (
          <View key={claim.id} style={pdfStyles.card} wrap={false}>
            <Text style={pdfStyles.body}>{claim.claim_text}</Text>
            <Text style={[pdfStyles.bodyMuted, { marginTop: 4 }]}>
              Source: {claim.source_url ?? claim.source_type.replace(/_/g, " ")}
              {claim.capture_date ? ` · Captured ${claim.capture_date}` : ""}
            </Text>
          </View>
        ))
      )}

      {/* Arbitrage */}
      {d2.by_region.length > 0 && (
        <>
          <Text style={pdfStyles.h2}>Cross-Border Opportunity</Text>
          <Text style={[pdfStyles.bodyMuted, { marginBottom: 8 }]}>
            Cheapest comparable per region, landed to {d2.target_region}
          </Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
            {d2.by_region.map((row) => {
              const isTarget = row.region === d2.target_region
              return (
                <View
                  key={row.region}
                  style={[
                    pdfStyles.card,
                    {
                      width: "48%",
                      marginBottom: 0,
                      borderColor: isTarget ? PDF_COLORS.primary : PDF_COLORS.border,
                    },
                  ]}
                  wrap={false}
                >
                  <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10 }}>
                    {FLAG[row.region] ?? row.region} {row.region}
                    {isTarget ? "  (this listing)" : ""}
                  </Text>
                  <Text style={[pdfStyles.monoBold, { marginTop: 4 }]}>
                    {isTarget ? fmtK(thisVinPriceUsd) : fmtK(row.cheapest_comparable_usd)}
                  </Text>
                  {!isTarget && row.landed_cost_to_target_usd !== null && (
                    <Text style={[pdfStyles.bodyMuted, { marginTop: 2 }]}>
                      + landed {fmtK(row.landed_cost_to_target_usd)} ={" "}
                      {fmtK(row.total_landed_to_target_usd)}
                    </Text>
                  )}
                  {!isTarget && row.cheapest_comparable_usd === null && (
                    <Text style={[pdfStyles.bodyMuted, { marginTop: 2 }]}>
                      No comparable available
                    </Text>
                  )}
                </View>
              )
            })}
          </View>
          {d2.narrative_insight && (
            <Text
              style={[
                pdfStyles.body,
                {
                  marginTop: 8,
                  padding: 8,
                  backgroundColor: PDF_COLORS.card,
                  borderRadius: 4,
                  fontStyle: "italic",
                },
              ]}
            >
              {d2.narrative_insight}
            </Text>
          )}
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
