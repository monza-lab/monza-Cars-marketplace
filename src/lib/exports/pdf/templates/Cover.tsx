import { Page, Text, View, Image } from "@react-pdf/renderer"
import type { HausReportV2 } from "@/lib/fairValue/types"
import type { CollectorCar } from "@/lib/curatedCars"
import { createPdfStyles, verdictColorsForTheme, getThemeTokens } from "../styles"
import type { PdfTheme } from "../theme"
import { Wordmark } from "../Wordmark"
import { PageFooter } from "./PageFooter"
import { fmtCurrency, fmtDate, titleCaseVehicle } from "../utils"

interface CoverProps {
  report: HausReportV2
  car: CollectorCar
  verdict: "BUY" | "WATCH" | "WALK" | "PENDING"
  fairValueLow: number | null
  fairValueHigh: number | null
  fairValueMid: number | null
  askingUsd: number
  totalPages: number
  /** Optional one-liner thesis from V3 finalSynthesis (preferred over V2 derived line). */
  headline?: string | null
  /** Report version label shown in header — e.g. 3 for V3 reports. */
  reportVersionLabel?: number
  theme: PdfTheme
}

export function Cover({
  report,
  car,
  verdict,
  fairValueLow,
  fairValueHigh,
  fairValueMid,
  askingUsd,
  totalPages,
  headline,
  reportVersionLabel,
  theme,
}: CoverProps) {
  const styles = createPdfStyles(theme)
  const tokens = getThemeTokens(theme)
  const vColors = verdictColorsForTheme(verdict, theme)
  const carTitle = titleCaseVehicle(
    `${car.year} ${car.make} ${car.model}${
      car.trim && car.trim !== "—" && car.trim !== car.model ? ` ${car.trim}` : ""
    }`,
  )

  const heroImage =
    car.image ||
    (Array.isArray(car.images) && car.images.length > 0 ? car.images[0] : null)

  const hasFairRange = fairValueLow != null && fairValueHigh != null

  return (
    <Page size="A4" style={styles.pageCover}>
      {/* Top wordmark + tagline */}
      <View
        style={{
          paddingTop: 36,
          paddingHorizontal: 48,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <Wordmark theme={theme} size={16} />
        <Text
          style={{
            fontFamily: "Karla",
            fontWeight: 500,
            fontSize: 7.5,
            color: tokens.muted,
            letterSpacing: 2.2,
            textTransform: "uppercase",
          }}
        >
          Haus Report
        </Text>
      </View>

      {/* Hero image — 16:9 band */}
      <View
        style={{
          marginTop: 28,
          marginHorizontal: 48,
          height: 270,
          borderRadius: 14,
          overflow: "hidden",
          backgroundColor: tokens.card,
          borderWidth: 1,
          borderColor: tokens.border,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {heroImage ? (
          <Image
            src={heroImage}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}
          />
        ) : (
          <Text
            style={{
              fontFamily: "Karla",
              fontWeight: 500,
              fontSize: 9,
              color: tokens.muted,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            Photography pending
          </Text>
        )}
      </View>

      {/* Body */}
      <View
        style={{
          flex: 1,
          paddingHorizontal: 48,
          paddingTop: 28,
          paddingBottom: 24,
          justifyContent: "flex-start",
        }}
      >
        <Text style={styles.chapterEyebrow}>The Vehicle</Text>
        <Text
          style={[
            styles.chapter,
            { fontSize: 38, marginBottom: 14 },
          ]}
        >
          {carTitle}
        </Text>

        {headline ? (
          <Text style={[styles.lede, { color: tokens.mutedStrong, marginBottom: 24 }]}>
            {headline}
          </Text>
        ) : null}

        {/* Verdict + fair value stack */}
        <View
          style={{
            marginTop: 12,
            paddingTop: 16,
            borderTopWidth: 1,
            borderTopColor: tokens.border,
            flexDirection: "row",
            alignItems: "flex-start",
            justifyContent: "space-between",
            gap: 24,
          }}
        >
          {/* Fair value — primary */}
          <View style={{ flexDirection: "column", flex: 1 }}>
            <Text style={styles.eyebrow}>Specific-Car Fair Value</Text>
            {hasFairRange ? (
              <Text
                style={[
                  styles.priceLarge,
                  { fontSize: 34, marginTop: 6, lineHeight: 1.1 },
                ]}
              >
                {fmtCurrency(fairValueLow)} – {fmtCurrency(fairValueHigh)}
              </Text>
            ) : (
              <Text style={[styles.h2, { color: tokens.muted, marginTop: 6 }]}>
                Valuation pending
              </Text>
            )}
            <Text style={[styles.bodyMuted, { marginTop: 6 }]}>
              {hasFairRange && fairValueMid != null
                ? `Mid ${fmtCurrency(fairValueMid)} · Asking ${fmtCurrency(askingUsd)}`
                : `Asking ${fmtCurrency(askingUsd)}`}
            </Text>
          </View>

          {/* Verdict — secondary, top-right */}
          <View style={{ flexDirection: "column", alignItems: "flex-end" }}>
            <Text style={[styles.eyebrow, { textAlign: "right" }]}>Verdict</Text>
            <View style={{ marginTop: 6 }}>
              <Text
                style={[
                  styles.verdictChip,
                  {
                    color: vColors.color,
                    borderColor: vColors.borderColor,
                  },
                ]}
              >
                {verdict}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Footer */}
      <View
        style={{
          paddingHorizontal: 48,
          paddingBottom: 36,
          paddingTop: 14,
          borderTopWidth: 1,
          borderTopColor: tokens.border,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
        }}
      >
        <Text
          style={{
            fontFamily: "Karla",
            fontWeight: 400,
            fontSize: 8,
            color: tokens.muted,
            letterSpacing: 0.5,
          }}
        >
          Generated {fmtDate(report.generated_at)} · Tier {report.tier?.replace("tier_", "") || "—"}
        </Text>
        <Text
          style={{
            fontFamily: "Karla",
            fontWeight: 400,
            fontSize: 8,
            color: tokens.muted,
            letterSpacing: 0.5,
          }}
        >
          1 / {totalPages}
        </Text>
      </View>

      <PageFooter
        hash={report.report_hash || null}
        generatedAt={report.generated_at}
        pageNumber={1}
        totalPages={totalPages}
        hidden
      />
    </Page>
  )
}
