import { Page, Text, View } from "@react-pdf/renderer"
import type { BuyerServices } from "@/lib/reports/types-v3"
import { pdfStyles, PDF_COLORS, fmtK } from "../../styles"
import { PageFooter } from "../PageFooter"

interface Props {
  data: BuyerServices
  reportHash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

export function BuyerServicesPage({ data, reportHash, generatedAt, pageNumber, totalPages }: Props) {
  return (
    <Page size="A4" style={pdfStyles.page}>
      <View style={{ flex: 1 }}>
        <Text style={pdfStyles.h2}>Buyer Services & Logistics</Text>

        {/* Parts Availability */}
        <View style={[pdfStyles.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <Text style={pdfStyles.h3}>Parts Availability</Text>
            <Text style={[pdfStyles.bodyEmphasis, { color: PDF_COLORS.primary, fontSize: 9 }]}>
              {data.partsAvailability.overallRating.replace(/_/g, " ").toUpperCase()}
            </Text>
          </View>
          <Text style={[pdfStyles.bodyMuted, { marginBottom: 2 }]}>OEM: {data.partsAvailability.oemNote}</Text>
          <Text style={[pdfStyles.bodyMuted, { marginBottom: 8 }]}>Aftermarket: {data.partsAvailability.aftermarketNote}</Text>

          {data.partsAvailability.commonParts.length > 0 && (
            <View>
              {/* Parts table header */}
              <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: PDF_COLORS.border, paddingBottom: 4, marginBottom: 4 }}>
                <Text style={[pdfStyles.h3, { flex: 2, marginBottom: 0 }]}>Part</Text>
                <Text style={[pdfStyles.h3, { flex: 1.5, marginBottom: 0 }]}>Availability</Text>
                <Text style={[pdfStyles.h3, { flex: 1, textAlign: "right", marginBottom: 0 }]}>Price</Text>
              </View>
              {data.partsAvailability.commonParts.slice(0, 6).map((p, i) => (
                <View key={i} style={{ flexDirection: "row", marginBottom: 3 }}>
                  <Text style={[pdfStyles.body, { flex: 2, fontSize: 9 }]}>{p.name}</Text>
                  <Text style={[pdfStyles.bodyMuted, { flex: 1.5, fontSize: 9 }]}>{p.availability}</Text>
                  <Text style={[pdfStyles.mono, { flex: 1, textAlign: "right", fontSize: 9 }]}>{p.priceRange}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Insurance Estimates */}
        <View style={{ flexDirection: "row", gap: 8, marginBottom: 10 }}>
          <View style={[pdfStyles.card, { flex: 1 }]}>
            <Text style={pdfStyles.h3}>Collector Insurance</Text>
            <Text style={[pdfStyles.monoBold, { fontSize: 12, marginTop: 4 }]}>
              {fmtK(data.insuranceEstimates.collectorPolicy.annualPremium.low)}–{fmtK(data.insuranceEstimates.collectorPolicy.annualPremium.high)}/yr
            </Text>
            <Text style={[pdfStyles.bodyMuted, { marginTop: 4 }]}>
              Mileage limit: {data.insuranceEstimates.collectorPolicy.mileageLimit}
            </Text>
            <Text style={[pdfStyles.bodyMuted, { marginTop: 2 }]}>
              {data.insuranceEstimates.collectorPolicy.providers.join(", ")}
            </Text>
          </View>
          {data.insuranceEstimates.dailyDriver && (
            <View style={[pdfStyles.card, { flex: 1 }]}>
              <Text style={pdfStyles.h3}>Daily Driver</Text>
              <Text style={[pdfStyles.monoBold, { fontSize: 12, marginTop: 4 }]}>
                {fmtK(data.insuranceEstimates.dailyDriver.annualPremium.low)}–{fmtK(data.insuranceEstimates.dailyDriver.annualPremium.high)}/yr
              </Text>
            </View>
          )}
        </View>

        {data.insuranceEstimates.notes && (
          <Text style={[pdfStyles.bodyMuted, { marginBottom: 10, paddingLeft: 4 }]}>
            {data.insuranceEstimates.vehicleCategory} · {data.insuranceEstimates.notes}
          </Text>
        )}

        {/* Transport Estimates */}
        <View style={[pdfStyles.card, { marginBottom: 10 }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Text style={pdfStyles.h3}>Transport</Text>
            <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>
              Recommended: {data.transportEstimates.recommendation}
            </Text>
          </View>
          {data.transportEstimates.routes.slice(0, 2).map((route, ri) => (
            <View key={ri} style={{ marginBottom: 6 }}>
              <Text style={[pdfStyles.bodyEmphasis, { fontSize: 9, marginBottom: 4 }]}>
                {route.type.charAt(0).toUpperCase() + route.type.slice(1)} Transport
              </Text>
              <View style={{ flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>Short Haul</Text>
                  <Text style={[pdfStyles.mono, { fontSize: 9 }]}>{route.shortHaul.perMile}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>Medium Haul</Text>
                  <Text style={[pdfStyles.mono, { fontSize: 9 }]}>{route.mediumHaul.perMile}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>Long Haul</Text>
                  <Text style={[pdfStyles.mono, { fontSize: 9 }]}>{route.longHaul.perMile}</Text>
                </View>
              </View>
            </View>
          ))}
          {data.transportEstimates.seasonalNote && (
            <Text style={[pdfStyles.bodyMuted, { marginTop: 4, fontSize: 8 }]}>
              {data.transportEstimates.seasonalNote}
            </Text>
          )}
        </View>

        {/* Original MSRP */}
        {data.originalMsrp && (
          <View style={[pdfStyles.card, { flexDirection: "row", gap: 14 }]}>
            <Text style={pdfStyles.h3}>Original MSRP</Text>
            {data.originalMsrp.basePrice != null && (
              <View>
                <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>Base Price</Text>
                <Text style={pdfStyles.mono}>{fmtK(data.originalMsrp.basePrice)}</Text>
              </View>
            )}
            {data.originalMsrp.adjustedForInflation != null && (
              <View>
                <Text style={[pdfStyles.bodyMuted, { fontSize: 8 }]}>Inflation-Adjusted</Text>
                <Text style={pdfStyles.mono}>{fmtK(data.originalMsrp.adjustedForInflation)}</Text>
              </View>
            )}
            <Text style={[pdfStyles.bodyMuted, { flex: 1, fontSize: 8 }]}>{data.originalMsrp.note}</Text>
          </View>
        )}
      </View>

      <PageFooter hash={reportHash} generatedAt={generatedAt} pageNumber={pageNumber} totalPages={totalPages} />
    </Page>
  )
}
