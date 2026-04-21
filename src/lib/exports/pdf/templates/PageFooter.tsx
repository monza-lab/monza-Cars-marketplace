import { Text, View } from "@react-pdf/renderer"
import { pdfStyles, fmtDate } from "../styles"

interface PageFooterProps {
  hash: string
  generatedAt: string
  pageNumber: number
  totalPages: number
}

export function PageFooter({ hash, generatedAt, pageNumber, totalPages }: PageFooterProps) {
  const short = hash ? (hash.length > 12 ? hash.slice(0, 12) : hash) : "—"
  return (
    <View style={pdfStyles.pageFooter} fixed>
      <Text>Monza Haus · Haus Report · {fmtDate(generatedAt)}</Text>
      <Text>Hash {short}</Text>
      <Text>
        {pageNumber} / {totalPages}
      </Text>
    </View>
  )
}
