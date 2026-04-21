import { Page, Text, View } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import { pdfStyles, PDF_COLORS } from "../styles"
import { PageFooter } from "./PageFooter"

const RISK_SIGNAL_KEYS = new Set(["accident_history", "modifications", "repaint_disclosed"])

const FALLBACK_QUESTION: Record<string, string> = {
  service_records: "Ask the seller for documented service history",
  paint_to_sample: "Confirm whether this car has a Paint-to-Sample color",
  accident_history: "Ask seller to confirm no accident history in writing",
  original_paint: "Ask whether the paint is original and request paint meter readings",
  previous_owners: "Confirm the number of previous owners",
  documentation: "Request original documentation",
  warranty: "Check what factory or CPO warranty remains",
  mileage: "Verify mileage against service records or MOT history",
  transmission: "Confirm the transmission type (manual vs PDK)",
  seller_tier: "Ask where the seller sourced this car",
  modifications: "Request a list of all modifications performed on the car",
}

function prettyKey(key: string): string {
  return key
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ")
}

interface Props {
  report: HausReportV2
  pageNumber: number
  totalPages: number
}

export function DueDiligencePage({ report, pageNumber, totalPages }: Props) {
  const signals = report.signals_detected
  const risks = signals.filter((s) => RISK_SIGNAL_KEYS.has(s.key))
  const positives = signals.filter((s) => !RISK_SIGNAL_KEYS.has(s.key))

  return (
    <Page size="A4" style={pdfStyles.page}>
      <Text style={pdfStyles.h2}>What we found in this listing</Text>

      {risks.length > 0 && (
        <>
          <Text style={pdfStyles.h3}>Risk Flags</Text>
          {risks.map((s) => (
            <View
              key={s.key}
              style={[pdfStyles.card, { borderColor: PDF_COLORS.destructive }]}
              wrap={false}
            >
              <Text style={[pdfStyles.body, { color: PDF_COLORS.destructive, fontFamily: "Helvetica-Bold" }]}>
                {prettyKey(s.key)}
              </Text>
              <Text style={pdfStyles.bodyMuted}>{s.value_display}</Text>
            </View>
          ))}
        </>
      )}

      {positives.length > 0 && (
        <>
          <Text style={pdfStyles.h3}>Positive Signals</Text>
          {positives.slice(0, 10).map((s) => (
            <View key={s.key} style={pdfStyles.card} wrap={false}>
              <Text style={pdfStyles.body}>{prettyKey(s.key)}</Text>
              <Text style={pdfStyles.bodyMuted}>{s.value_display}</Text>
            </View>
          ))}
        </>
      )}

      {signals.length === 0 && (
        <View style={pdfStyles.cardDashed}>
          <Text style={pdfStyles.bodyMuted}>No objective signals were extracted yet.</Text>
        </View>
      )}

      {report.signals_missing.length > 0 && (
        <>
          <Text style={[pdfStyles.h2, { marginTop: 14 }]}>Questions Before You Commit</Text>
          <Text style={pdfStyles.bodyMuted}>
            Based on what&apos;s missing from the listing — converted to actionable asks.
          </Text>
          {report.signals_missing.map((s, i) => (
            <View key={s.key} style={[pdfStyles.card, { paddingVertical: 6 }]} wrap={false}>
              <Text style={pdfStyles.body}>
                {i + 1}. {FALLBACK_QUESTION[s.key] ?? `Ask the seller about ${s.key.replace(/_/g, " ")}`}
              </Text>
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
