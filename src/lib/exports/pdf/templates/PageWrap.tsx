import { Page, View } from "@react-pdf/renderer"
import { createPdfStyles } from "../styles"
import type { PdfTheme } from "../theme"
import { PageFooter } from "./PageFooter"

interface PageWrapProps {
  /** When `false`, the content is embedded as a `<View>` (no Page, no footer)
   *  so a parent `<Page>` can flow multiple chapters continuously. Default `true`
   *  preserves the legacy one-chapter-per-page behavior. */
  wrap: boolean
  theme: PdfTheme
  hash: string | null
  generatedAt: string
  children: React.ReactNode
}

/**
 * Wrapper helper for V3 chapter templates.
 *
 * Each chapter template renders its body via `<PageWrap>`. When the parent
 * renderer wants every chapter on its own page (the original behavior),
 * `wrap=true` adds the `<Page>` + `<PageFooter>` chrome. When the parent
 * wants flow continuo (single Page hosting many chapters), `wrap=false`
 * just emits a `<View>` and the parent supplies the Page + footer once.
 *
 * This eliminates the trailing-empty-space problem inherent to react-pdf's
 * per-Page layout — chapters that don't fill a page no longer leave the
 * bottom half black; the next chapter starts inline.
 */
export function PageWrap({
  wrap,
  theme,
  hash,
  generatedAt,
  children,
}: PageWrapProps) {
  if (!wrap) {
    return <View>{children}</View>
  }

  const styles = createPdfStyles(theme)

  return (
    <Page size="A4" style={styles.page}>
      {children}
      <PageFooter hash={hash} generatedAt={generatedAt} theme={theme} />
    </Page>
  )
}
