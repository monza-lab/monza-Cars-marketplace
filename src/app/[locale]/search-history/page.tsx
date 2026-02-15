import type { Metadata } from "next"
import { getTranslations } from "next-intl/server"
import SearchHistoryClient from "./SearchHistoryClient"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "searchHistory" })

  return {
    title: `${t("title")} | Monza Lab`,
  }
}

export default function SearchHistoryPage() {
  return <SearchHistoryClient />
}
