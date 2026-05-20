import { View, Text, Svg, Path } from "@react-pdf/renderer"
import type { PdfTheme } from "./theme"
import { getHelmetColors, getPdfTokens } from "./theme"

/**
 * MonzaHaus official wordmark: M + [Helmet] + NZAHAUS
 * Font: Saira 600 UPPERCASE, letter-spacing ~2.5% of font size.
 * Helmet glyph replaces the O — sized at 0.78em (≈ 78% of the font).
 *
 * Per brand manual v2.1, the helmet uses three SVG paths
 * (shell, visor, strap) with colors that adapt to the surface theme.
 */

interface WordmarkProps {
  theme: PdfTheme
  /** Font size in PDF points (1pt ≈ 1.33px). Default 14. */
  size?: number
  /**
   * Override the shell color (e.g. when overlaying on a non-default surface).
   * Defaults to the brand-correct color for the chosen theme.
   */
  shellColor?: string
  /** Letter color override; defaults to foreground for theme. */
  letterColor?: string
}

const HELMET_SHELL_D =
  "M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z"
const HELMET_VISOR_D =
  "M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z"
const HELMET_STRAP_D = "M26 90Q60 86 94 90"

export function Helmet({
  size = 14,
  theme,
  shellColor,
}: {
  size?: number
  theme: PdfTheme
  shellColor?: string
}) {
  const colors = getHelmetColors(theme)
  const shell = shellColor ?? colors.shell
  // Match the web wordmark exactly: helmet sized at 0.78em × 0.79em
  // (cap-height parity, not full em). See MonzaHausHelmet.tsx.
  const w = size * 0.78
  const h = size * 0.79

  return (
    <Svg viewBox="0 0 120 121" style={{ width: w, height: h }}>
      <Path d={HELMET_SHELL_D} fill={shell} />
      <Path d={HELMET_VISOR_D} fill={colors.visor} />
      <Path
        d={HELMET_STRAP_D}
        stroke={colors.strap}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  )
}

export function Wordmark({ theme, size = 14, shellColor, letterColor }: WordmarkProps) {
  const tokens = getPdfTokens(theme)
  const color = letterColor ?? tokens.foreground
  const tracking = size * 0.025 // 0.025em equivalent

  const letterStyle = {
    fontFamily: "Saira",
    fontWeight: 600 as const,
    fontSize: size,
    letterSpacing: tracking,
    color,
    lineHeight: 1,
  }

  return (
    <View
      style={{
        flexDirection: "row",
        // Center cross-axis alignment puts the helmet on the vertical middle
        // of the letter line. From there we offset down with `top` so the
        // helmet sits squarely inside the cap-line, like the "O" it replaces.
        alignItems: "center",
      }}
    >
      <Text style={letterStyle}>M</Text>
      <View
        style={{
          marginHorizontal: size * 0.03,
          // Push down from the centered position so the helmet's top sits
          // around the cap-height of the surrounding letters. ~0.08em below
          // center hits the visual sweet spot for a Saira SemiBold line.
          top: size * 0.29,
        }}
      >
        <Helmet size={size} theme={theme} shellColor={shellColor} />
      </View>
      <Text style={letterStyle}>NZAHAUS</Text>
    </View>
  )
}

/**
 * Compact lockup — wordmark only. Tagline support removed per Edgar's
 * direction (no "Investment-Grade Automotive Assets" line; use the
 * positioning tagline `The Porsche Collector Platform` separately if needed).
 */
export function WordmarkWithTagline({
  theme,
  size = 22,
  shellColor,
  letterColor,
  tagline,
}: WordmarkProps & { tagline?: string }) {
  const tokens = getPdfTokens(theme)
  return (
    <View style={{ flexDirection: "column", gap: size * 0.3, alignItems: "center" }}>
      <Wordmark theme={theme} size={size} shellColor={shellColor} letterColor={letterColor} />
      {tagline ? (
        <Text
          style={{
            fontFamily: "Karla",
            fontWeight: 500,
            fontSize: size * 0.32,
            letterSpacing: size * 0.08,
            textTransform: "uppercase",
            color: tokens.mutedStrong,
          }}
        >
          {tagline}
        </Text>
      ) : null}
    </View>
  )
}
