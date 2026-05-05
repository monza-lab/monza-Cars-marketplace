import { Page, Text, View } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import { pdfStyles, PDF_COLORS, fmtK } from "../styles"
import { PageFooter } from "./PageFooter"

function prettyKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

interface Props {
  report: HausReportV2
  askingUsd: number
  verdictOneLiner: string
  pageNumber: number
  totalPages: number
}

export function ValuationPage({
  report,
  askingUsd,
  verdictOneLiner,
  pageNumber,
  totalPages,
}: Props) {
  const delta = ((askingUsd - report.specific_car_fair_value_mid) / report.specific_car_fair_value_mid) * 100
  const sorted = [...report.modifiers_applied].sort(
    (a, b) => Math.abs(b.baseline_contribution_usd) - Math.abs(a.baseline_contribution_usd)
  )

  return (
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.h2}>Verdict Detail</Text>
      <Text style={pdfStyles.body}>{verdictOneLiner}</Text>
      <View style={[pdfStyles.rowSpread, { marginTop: 10 }]}>
        <View>
          <Text style={pdfStyles.h3}>Asking</Text>
          <Text style={pdfStyles.monoBold}>{fmtK(askingUsd)}</Text>
        </View>
        <View>
          <Text style={pdfStyles.h3}>Fair Value</Text>
          <Text style={pdfStyles.monoBold}>{fmtK(report.specific_car_fair_value_mid)}</Text>
        </View>
        <View>
          <Text style={pdfStyles.h3}>Delta</Text>
          <Text style={pdfStyles.monoBold}>
            {delta >= 0 ? "+" : ""}
            {delta.toFixed(1)}%
          </Text>
        </View>
      </View>

      <View style={pdfStyles.divider} />

      <Text style={pdfStyles.h2}>How we arrived at {fmtK(report.specific_car_fair_value_mid)}</Text>
      <View style={pdfStyles.card} wrap={false}>
        <View style={pdfStyles.rowSpread}>
          <Text style={pdfStyles.body}>Baseline median</Text>
          <Text style={pdfStyles.mono}>{fmtK(report.median_price)}</Text>
        </View>
        <View style={[pdfStyles.rowSpread, { marginTop: 4 }]}>
          <Text style={pdfStyles.body}>Aggregate modifiers</Text>
          <Text style={pdfStyles.mono}>
            {report.modifiers_total_percent >= 0 ? "+" : ""}
            {report.modifiers_total_percent.toFixed(1)}%
          </Text>
        </View>
        <View style={[pdfStyles.rowSpread, { marginTop: 4 }]}>
          <Text style={pdfStyles.bodyEmphasis}>Specific-car fair value</Text>
          <Text style={[pdfStyles.monoBold, { color: PDF_COLORS.primary }]}>
            {fmtK(report.specific_car_fair_value_mid)}
          </Text>
        </View>
      </View>

      {sorted.length > 0 && (
        <>
          <Text style={pdfStyles.h3}>Top modifiers applied</Text>
          {sorted.slice(0, 6).map((m) => (
            <View key={m.key} style={[pdfStyles.card, { paddingVertical: 6 }]} wrap={false}>
              <View style={pdfStyles.rowSpread}>
                <Text style={pdfStyles.body}>{prettyKey(m.key)}</Text>
                <Text
                  style={[
                    pdfStyles.mono,
                    {
                      color:
                        m.baseline_contribution_usd >= 0
                          ? PDF_COLORS.positive
                          : PDF_COLORS.negative,
                    },
                  ]}
                >
                  {m.delta_percent >= 0 ? "+" : ""}
                  {m.delta_percent}% · {fmtK(Math.abs(m.baseline_contribution_usd))}
                </Text>
              </View>
              {m.citation_url && (
                <Text style={[pdfStyles.bodyMuted, { marginTop: 2 }]}>
                  Source: {m.citation_url}
                </Text>
              )}
            </View>
          ))}
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
