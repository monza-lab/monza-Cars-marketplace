import { Text, View } from "@react-pdf/renderer"
import { createPdfStyles } from "../styles"
import type { PdfTheme } from "../theme"
import { fmtDate } from "../utils"
import { Helmet } from "../Wordmark"

interface PageFooterProps {
  hash: string | null
  generatedAt: string
  /** Kept for API compat — physical numbering is computed at render time. */
  pageNumber?: number
  totalPages?: number
  theme?: PdfTheme
  /** Cover renders its own footer — pass `hidden` to skip the fixed footer. */
  hidden?: boolean
}

/**
 * Page footer rendered on every page except the Cover (which has a dedicated one).
 *
 * Layout: left = brand line, center = optional hash (omitted if null),
 * right = physical page number (n / total) computed by react-pdf at render
 * time so multi-page sections show the real "N of 23" instead of the
 * chapter index.
 */
export function PageFooter({
  hash,
  generatedAt,
  theme = "dark",
  hidden = false,
}: PageFooterProps) {
  if (hidden) return null

  const styles = createPdfStyles(theme)
  const short = hash && hash.length > 12 ? hash.slice(0, 12) : hash

  return (
    <>
      {/* Editorial helmet glyph - fills the natural breathing room above
          the footer on every page, including chapters with trailing empty
          space, so the page never feels half-finished. */}
      <View
        fixed
        style={{
          position: "absolute",
          bottom: 56,
          left: 0,
          right: 0,
          alignItems: "center",
          opacity: 0.22,
        }}
      >
        <Helmet size={8} theme={theme} />
      </View>

      <View style={styles.pageFooter} fixed>
        <Text>MonzaHaus · Haus Report · {fmtDate(generatedAt)}</Text>
        {short ? <Text>Hash {short}</Text> : <Text> </Text>}
        <Text
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`}
        />
      </View>
    </>
  )
}
