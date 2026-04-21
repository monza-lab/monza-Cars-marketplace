import { Page, Text, View } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import { pdfStyles, PDF_COLORS, verdictColors, fmtK, fmtDate } from "../styles"
import { PageFooter } from "./PageFooter"

interface CoverProps {
  report: HausReportV2
  car: CollectorCar
  verdict: "BUY" | "WATCH" | "WALK"
  askingUsd: number
  totalPages: number
}

export function Cover({ report, car, verdict, askingUsd, totalPages }: CoverProps) {
  const vColors = verdictColors(verdict)
  const carTitle = `${car.year} ${car.make} ${car.model}${
    car.trim && car.trim !== "—" && car.trim !== car.model ? ` ${car.trim}` : ""
  }`

  return (
    <Page size="A4" style={pdfStyles.page}>
      {/* Top: brand */}
      <View>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 10, letterSpacing: 3, color: PDF_COLORS.primary }}>
          MONZA HAUS
        </Text>
        <Text style={{ fontSize: 8, color: PDF_COLORS.muted, marginTop: 2 }}>
          Haus Report · Valuation Intelligence for Porsche
        </Text>
      </View>

      {/* Middle: car title + verdict + fair value */}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={{ fontSize: 11, color: PDF_COLORS.muted, textTransform: "uppercase", letterSpacing: 2 }}>
          Vehicle
        </Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 28, marginTop: 8 }}>{carTitle}</Text>

        <View style={{ marginTop: 32, alignItems: "center" }}>
          <Text
            style={[
              pdfStyles.verdictChip,
              { color: vColors.color, borderColor: vColors.borderColor },
            ]}
          >
            {verdict}
          </Text>
        </View>

        <View style={{ marginTop: 32 }}>
          <Text style={[pdfStyles.h3, { textAlign: "center" }]}>Specific-Car Fair Value</Text>
          <Text style={[pdfStyles.monoBold, { fontSize: 26, textAlign: "center", marginTop: 6 }]}>
            {fmtK(report.specific_car_fair_value_low)} – {fmtK(report.specific_car_fair_value_high)}
          </Text>
          <Text style={[pdfStyles.bodyMuted, { textAlign: "center", marginTop: 4 }]}>
            Mid {fmtK(report.specific_car_fair_value_mid)} · Asking {fmtK(askingUsd)} ·{" "}
            {report.comparables_count} comparables · {report.comparable_layer_used} layer
          </Text>
        </View>
      </View>

      {/* Bottom: verify callout */}
      {report.report_hash && (
        <View style={[pdfStyles.cardDashed, { alignItems: "center" }]}>
          <Text style={[pdfStyles.bodyMuted, { textAlign: "center" }]}>
            Verify this report at
          </Text>
          <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 11, marginTop: 4 }}>
            monzahaus.com/verify/{report.report_hash.slice(0, 12)}
          </Text>
        </View>
      )}

      <Text style={[pdfStyles.bodyMuted, { textAlign: "center" }]}>
        Generated {fmtDate(report.generated_at)} · v{report.report_version} · {report.tier.replace("_", " ")}
      </Text>

      <PageFooter
        hash={report.report_hash}
        generatedAt={report.generated_at}
        pageNumber={1}
        totalPages={totalPages}
      />
    </Page>
  )
}
