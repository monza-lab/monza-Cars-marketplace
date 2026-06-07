import type { Metadata } from "next"
import { Suspense } from "react"
import AuctionsClient from "./AuctionsClient"
import { getTranslations } from "next-intl/server"
import { useTranslations } from "next-intl"
import { MonzaInfinityLoader } from "@/components/shared/MonzaInfinityLoader"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: "pages" })

  return {
    title: t("auctions.meta.title"),
    description: t("auctions.meta.description"),
    openGraph: {
      title: t("auctions.meta.ogTitle"),
      description: t("auctions.meta.ogDescription"),
    },
  }
}

export default function AuctionsPage() {
  const t = useTranslations("pages")

  return (
    <Suspense
      fallback={<MonzaInfinityLoader variant="section" />}
    >
      <AuctionsClient />
    </Suspense>
  )
}
