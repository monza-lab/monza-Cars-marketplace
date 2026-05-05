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
      {/* Top: wordmark + tagline */}
      <View>
        <Text style={pdfStyles.wordmark}>MONZA HAUS</Text>
        <Text style={[pdfStyles.bodyMuted, { marginTop: 3 }]}>
          Investment-Grade Automotive Assets
        </Text>
      </View>

      {/* Middle: car title + verdict + fair value */}
      <View style={{ flex: 1, justifyContent: "center" }}>
        <Text style={pdfStyles.h3}>Vehicle</Text>
        <Text style={[pdfStyles.h1, { marginTop: 4 }]}>{carTitle}</Text>

        <View style={{ marginTop: 36, alignItems: "center" }}>
          <Text
            style={[
              pdfStyles.verdictChip,
              { color: vColors.color, borderColor: vColors.borderColor },
            ]}
          >
            {verdict}
          </Text>
        </View>

        <View style={{ marginTop: 36 }}>
          <Text style={[pdfStyles.h3, { textAlign: "center" }]}>
            Specific-Car Fair Value
          </Text>
          <Text style={[pdfStyles.priceDisplay, { textAlign: "center", marginTop: 8 }]}>
            {fmtK(report.specific_car_fair_value_low)} – {fmtK(report.specific_car_fair_value_high)}
          </Text>
          <Text style={[pdfStyles.bodyMuted, { textAlign: "center", marginTop: 6 }]}>
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
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 500,
              fontSize: 11,
              color: PDF_COLORS.foreground,
              marginTop: 4,
            }}
          >
            monzahaus.com/verify/{report.report_hash.slice(0, 12)}
          </Text>
        </View>
      )}

      <Text style={[pdfStyles.bodyMuted, { textAlign: "center" }]}>
        Generated {fmtDate(report.generated_at)} · v{report.report_version} ·{" "}
        {report.tier.replace("_", " ")}
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
