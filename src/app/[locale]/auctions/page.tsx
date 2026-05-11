import type { Metadata } from "next"
import { Suspense } from "react"
import AuctionsClient from "./AuctionsClient"
import { getTranslations } from "next-intl/server"
import { useTranslations } from "next-intl"

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
      fallback={
        <div className="min-h-screen bg-background flex items-center justify-center">
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="h-10 w-10 rounded-full border-2 border-border" />
              <div className="absolute inset-0 h-10 w-10 rounded-full border-2 border-primary/40 border-t-transparent animate-spin" />
            </div>
            <p className="text-sm text-muted-foreground/80">{t("auctions.loading")}</p>
          </div>
        </div>
      }
    >
      <AuctionsClient />
    </Suspense>
  )
}
