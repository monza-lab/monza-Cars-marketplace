"use client"

import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

export function AppFooter() {
  const t = useTranslations("footer")

  return (
    <footer className="hidden md:flex items-center justify-center gap-3 py-3 border-t border-border">
      <span className="text-[10px] text-muted-foreground tracking-wide">{t("copyright")}</span>
      <span className="text-border">·</span>
      <Link
        href="/legal/privacy"
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wide"
      >
        {t("privacy")}
      </Link>
      <span className="text-border">·</span>
      <Link
        href="/legal/terms"
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wide"
      >
        {t("terms")}
      </Link>
      <span className="text-border">·</span>
      <Link
        href="/legal/cookies"
        className="text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wide"
      >
        {t("cookies")}
      </Link>
      <span className="text-border">·</span>
      <a
        href="https://monzalab.com"
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors tracking-wide"
      >
        Powered by
        <svg viewBox="0 0 120 121" className="h-[10px] w-[10px]" aria-hidden="true">
          <path d="M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z" fill="var(--lavender-deep, #D6BEDC)"/>
          <path d="M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z" fill="var(--ink, #141413)"/>
          <path d="M26 90Q60 86 94 90" stroke="var(--ink, #141413)" strokeWidth="3" strokeLinecap="round" fill="none"/>
        </svg>
        Monza Lab
      </a>
    </footer>
  )
}
