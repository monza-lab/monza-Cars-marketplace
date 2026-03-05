"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

export function AppFooter() {
  const t = useTranslations("footer")

  return (
    <footer className="hidden md:flex items-center justify-center gap-3 py-3 border-t border-border">
      <span className="text-[10px] text-muted-foreground tracking-wide">{t("copyright")}</span>
      <span className="text-border">·</span>
      <Link href="/legal/privacy" className="text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors tracking-wide">
        {t("privacy")}
      </Link>
      <span className="text-border">·</span>
      <Link href="/legal/terms" className="text-[10px] text-muted-foreground hover:text-muted-foreground transition-colors tracking-wide">
        {t("terms")}
      </Link>
    </footer>
  )
}
