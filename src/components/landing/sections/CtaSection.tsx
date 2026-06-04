"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { useScrollReveal } from "@/hooks/useScrollReveal"

function markExplored() {
  localStorage.setItem("monzahaus-explored", "true")
}

export function CtaSection() {
  const t = useTranslations("landing.cta")
  const { ref, isVisible } = useScrollReveal()

  return (
    <section className="relative bg-[#0E0E0D] py-20 md:py-28 px-5 md:px-8 overflow-hidden">
      {/* Glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 60% at 50% 30%, rgba(184, 159, 190, 0.14) 0%, transparent 70%)",
        }}
      />

      <div
        ref={ref}
        className={`relative z-[1] max-w-lg mx-auto text-center transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <h2 className="font-serif font-light text-[1.75rem] md:text-[2.25rem] text-[#E8E2DE] tracking-[-0.02em] mb-4 md:mb-5">
          {t("headline")}
        </h2>
        <p className="font-sans text-sm md:text-base text-[#6B6365] mb-8 md:mb-10">
          {t("subline")}
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/browse"
            onClick={markExplored}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#D6BEDC] text-[#3F2A47] font-sans font-semibold text-sm md:text-[0.9375rem] px-8 py-3.5 transition-all duration-250 hover:bg-[#E1CCE5] hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("primary")}
          </Link>
          <Link
            href="/get-started"
            onClick={markExplored}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#D6BEDC]/30 text-[#E8E2DE] font-sans font-medium text-sm md:text-[0.9375rem] px-8 py-3.5 transition-all duration-250 hover:border-[#D6BEDC]/60 hover:bg-white/[0.03]"
          >
            {t("secondary")}
          </Link>
        </div>

        <p className="font-sans text-xs text-[#6B6365]/60 mt-5">
          {t("reassurance")}
        </p>
      </div>
    </section>
  )
}
