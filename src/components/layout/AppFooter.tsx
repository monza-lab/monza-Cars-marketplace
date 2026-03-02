"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

export function AppFooter() {
  const t = useTranslations("footer")

  return (
    <footer className="hidden md:flex items-center justify-center gap-3 py-3 border-t border-white/[0.03]">
      <span className="text-[10px] text-[#4B5563] tracking-wide">{t("copyright")}</span>
      <span className="text-white/10">·</span>
      <Link href="/legal/privacy" className="text-[10px] text-[#4B5563] hover:text-[#9CA3AF] transition-colors tracking-wide">
        {t("privacy")}
      </Link>
      <span className="text-white/10">·</span>
      <Link href="/legal/terms" className="text-[10px] text-[#4B5563] hover:text-[#9CA3AF] transition-colors tracking-wide">
        {t("terms")}
      </Link>
    </footer>
  )
}
