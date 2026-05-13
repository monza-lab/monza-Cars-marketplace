import { Text, View } from "@react-pdf/renderer"
import { createPdfStyles } from "../styles"
import type { PdfTheme } from "../theme"
import { fmtDate } from "../utils"

interface PageFooterProps {
  hash: string | null
  generatedAt: string
  pageNumber: number
  totalPages: number
  theme?: PdfTheme
  /** Cover renders its own footer — pass `hidden` to skip the fixed footer. */
  hidden?: boolean
}

/**
 * Page footer rendered on every page except the Cover (which has a dedicated one).
 *
 * Layout: left = brand line, center = optional hash (omitted if null),
 * right = page number "n / total".
 */
export function PageFooter({
  hash,
  generatedAt,
  pageNumber,
  totalPages,
  theme = "dark",
  hidden = false,
}: PageFooterProps) {
  if (hidden) return null

  const styles = createPdfStyles(theme)
  const short = hash && hash.length > 12 ? hash.slice(0, 12) : hash

  return (
    <View style={styles.pageFooter} fixed>
      <Text>MonzaHaus · Haus Report · {fmtDate(generatedAt)}</Text>
      {short ? <Text>Hash {short}</Text> : <Text> </Text>}
      <Text>
        {pageNumber} / {totalPages}
      </Text>
    </View>
  )
}
