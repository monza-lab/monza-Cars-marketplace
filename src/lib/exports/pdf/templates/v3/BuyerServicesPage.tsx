import { Text, View } from "@react-pdf/renderer"
import { PageWrap } from "../PageWrap"
import type { BuyerServices } from "@/lib/reports/types-v3"
import { createPdfStyles, getThemeTokens } from "../../styles"
import type { PdfTheme } from "../../theme"
import { humanize, fmtCurrencyFull } from "../../utils"

interface Props {
  data: BuyerServices
  reportHash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme: PdfTheme
  /** When false, embed in parent Page (no PageFooter). */
  wrap?: boolean
}

function partsRatingDescription(
  rating: BuyerServices["partsAvailability"]["overallRating"],
): string {
  switch (rating) {
    case "readily_available":
      return "Service network is broad. Sourcing is rarely a constraint."
    case "available":
      return "Most components are sourceable through known channels with reasonable lead times."
    case "limited":
      return "Expect longer lead times and a smaller pool of qualified specialists."
    case "scarce":
      return "Sourcing is the dominant ownership variable. Plan around lead times."
    default:
      return ""
  }
}

export function BuyerServicesPage({
  data,
  reportHash,
  generatedAt,
  pageNumber,
  totalPages,
  theme,
  wrap = true,
}: Props) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)

  const parts = data.partsAvailability
  const regions = data.regionalVariations
  const msrp = data.originalMsrp

  return (
    <PageWrap wrap={wrap} theme={theme} hash={reportHash} generatedAt={generatedAt}>
      {/* Chapter opener */}
      <View>
        <Text style={styles.chapterEyebrow}>Chapter 06 · Operations</Text>
        <Text style={[styles.chapter, { marginBottom: 14 }]}>
          Buyer Services
        </Text>
        <Text
          style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 22 }]}
        >
          Owning a collector vehicle is an operational exercise. Here is what
          to know about parts availability and where the regional markets stand.
        </Text>
      </View>

      <View style={[styles.cardLavender, { marginBottom: 12, paddingVertical: 10 }]} wrap={false}>
        <Text style={[styles.h3, { color: tokens.primary, marginBottom: 4 }]}>
          Dealer Cross-Check
        </Text>
        <Text style={styles.bodyMuted}>
          Cross-check these prices with your Porsche dealer in your region.
          If you need support with part numbers, local pricing, or dealer
          questions, ask the advisor in the chat.
        </Text>
      </View>

      {/* ─── Parts & Service ──────────────────────────────────────── */}
      <Text style={styles.h2}>Parts & Service</Text>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          marginBottom: 10,
        }}
      >
        <Text
          style={[
            styles.tagPrimary,
            { fontSize: 8, paddingHorizontal: 10, paddingVertical: 4 },
          ]}
        >
          {humanize(parts.overallRating)}
        </Text>
        <Text style={[styles.bodyMuted, { flex: 1 }]}>
          {partsRatingDescription(parts.overallRating)}
        </Text>
      </View>

      <View style={{ flexDirection: "row", gap: 10, marginBottom: 10 }}>
        <View style={[styles.cardSoft, { flex: 1, marginBottom: 0 }]}>
          <Text style={styles.h3}>OEM</Text>
          <Text style={[styles.body, { marginTop: 4 }]}>{parts.oemNote}</Text>
        </View>
        <View style={[styles.cardSoft, { flex: 1, marginBottom: 0 }]}>
          <Text style={styles.h3}>Aftermarket</Text>
          <Text style={[styles.body, { marginTop: 4 }]}>
            {parts.aftermarketNote}
          </Text>
        </View>
      </View>

      {parts.commonParts.length > 0 ? (
        <View style={{ marginBottom: 4 }}>
          <View
            style={{
              flexDirection: "row",
              borderBottomWidth: 1,
              borderBottomColor: tokens.border,
              paddingBottom: 5,
              marginBottom: 5,
            }}
          >
            <Text style={[styles.h3, { flex: 2, marginBottom: 0 }]}>Part</Text>
            <Text style={[styles.h3, { flex: 1.5, marginBottom: 0 }]}>
              Availability
            </Text>
            <Text
              style={[
                styles.h3,
                { flex: 1, textAlign: "right", marginBottom: 0 },
              ]}
            >
              Price
            </Text>
          </View>
          {parts.commonParts.slice(0, 6).map((p, i) => (
            <View
              key={i}
              style={{
                flexDirection: "row",
                marginBottom: 4,
                paddingVertical: 2,
              }}
            >
              <Text style={[styles.body, { flex: 2 }]}>{p.name}</Text>
              <Text style={[styles.bodyMuted, { flex: 1.5 }]}>
                {humanize(p.availability)}
              </Text>
              <Text
                style={[
                  styles.body,
                  {
                    flex: 1,
                    textAlign: "right",
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 11,
                  },
                ]}
              >
                {p.priceRange}
              </Text>
            </View>
          ))}
        </View>
      ) : null}

      {/* ─── Regional Markets ─────────────────────────────────────── */}
      {regions.strongMarkets.length > 0 || regions.weakerMarkets.length > 0 ? (
        <>
          <Text style={styles.h2}>Regional Markets</Text>
          <View style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.h3, { color: tokens.positive }]}>
                Strong Markets
              </Text>
              {regions.strongMarkets.length === 0 ? (
                <Text style={[styles.bodyMuted, { marginTop: 4 }]}>—</Text>
              ) : (
                regions.strongMarkets.slice(0, 5).map((m, i) => (
                  <View key={i} style={{ marginTop: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <Text style={[styles.bodyEmphasis, { flex: 1 }]}>
                        {m.region}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Cormorant",
                          fontWeight: 500,
                          fontSize: 13,
                          color: tokens.positive,
                          letterSpacing: -0.2,
                        }}
                      >
                        +{m.premiumPercent.replace(/^\+/, "")}
                      </Text>
                    </View>
                    <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
                      {m.reason}
                    </Text>
                  </View>
                ))
              )}
            </View>
            <View
              style={{
                width: 1,
                backgroundColor: tokens.border,
                marginVertical: 4,
              }}
            />
            <View style={{ flex: 1 }}>
              <Text style={[styles.h3, { color: tokens.negative }]}>
                Weaker Markets
              </Text>
              {regions.weakerMarkets.length === 0 ? (
                <Text style={[styles.bodyMuted, { marginTop: 4 }]}>—</Text>
              ) : (
                regions.weakerMarkets.slice(0, 5).map((m, i) => (
                  <View key={i} style={{ marginTop: 6 }}>
                    <View
                      style={{
                        flexDirection: "row",
                        alignItems: "baseline",
                        gap: 6,
                      }}
                    >
                      <Text style={[styles.bodyEmphasis, { flex: 1 }]}>
                        {m.region}
                      </Text>
                      <Text
                        style={{
                          fontFamily: "Cormorant",
                          fontWeight: 500,
                          fontSize: 13,
                          color: tokens.negative,
                          letterSpacing: -0.2,
                        }}
                      >
                        -{m.discountPercent.replace(/^-/, "")}
                      </Text>
                    </View>
                    <Text style={[styles.bodyMuted, { marginTop: 2 }]}>
                      {m.reason}
                    </Text>
                  </View>
                ))
              )}
            </View>
          </View>
        </>
      ) : null}

      {/* ─── Original MSRP ────────────────────────────────────────── */}
      {msrp ? (
        <View style={[styles.cardDashed, { marginTop: 12 }]} wrap={false}>
          <Text style={styles.h3}>Original MSRP</Text>
          <View
            style={{
              flexDirection: "row",
              gap: 16,
              marginTop: 8,
              alignItems: "flex-start",
            }}
          >
            {msrp.basePrice != null ? (
              <View style={{ flex: 1 }}>
                <Text style={[styles.bodyMuted, { fontSize: 8 }]}>
                  Base Price
                </Text>
                <Text
                  style={{
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 18,
                    letterSpacing: -0.3,
                    color: tokens.foreground,
                    marginTop: 2,
                  }}
                >
                  {fmtCurrencyFull(msrp.basePrice)}
                </Text>
              </View>
            ) : null}
            {msrp.adjustedForInflation != null ? (
              <View
                style={{
                  flex: 1,
                  borderLeftWidth: 1,
                  borderLeftColor: tokens.border,
                  paddingLeft: 12,
                }}
              >
                <Text style={[styles.bodyMuted, { fontSize: 8 }]}>
                  Inflation-Adjusted
                </Text>
                <Text
                  style={{
                    fontFamily: "Cormorant",
                    fontWeight: 500,
                    fontSize: 18,
                    letterSpacing: -0.3,
                    color: tokens.primary,
                    marginTop: 2,
                  }}
                >
                  {fmtCurrencyFull(msrp.adjustedForInflation)}
                </Text>
              </View>
            ) : null}
          </View>
          {msrp.note ? (
            <Text style={[styles.bodyMuted, { marginTop: 8 }]}>
              {msrp.note}
            </Text>
          ) : null}
          <Text style={[styles.bodyMuted, { marginTop: 6, fontSize: 8.5 }]}>
            Regional taxes, options, dealer availability, and superseded part
            numbers can change landed prices. Confirm final values with a
            Porsche dealer near the vehicle or buyer.
          </Text>
        </View>
      ) : null}
    </PageWrap>
  )
}
