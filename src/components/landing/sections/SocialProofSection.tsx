"use client"

import { useTranslations } from "next-intl"
import { useScrollReveal } from "@/hooks/useScrollReveal"
export type LandingStats = {
  listings: number
  regions: number
  sources: number
  seriesTracked: number
}

export function SocialProofSection({ stats }: { stats: LandingStats }) {
  const t = useTranslations("landing.proof")
  const { ref, isVisible } = useScrollReveal()

  return (
    <section className="relative bg-[#0E0E0D] py-20 md:py-28 px-5 md:px-8 overflow-hidden">
      {/* Glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 50% 50%, rgba(225, 204, 229, 0.08) 0%, transparent 70%)",
        }}
      />

      <div
        ref={ref}
        className="relative z-[1] max-w-4xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12"
      >
        {(Object.entries(stats) as [keyof LandingStats, number][]).map(([key, value], i) => (
          <div
            key={key}
            className={`text-center transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isVisible ? `${i * 120}ms` : "0ms" }}
          >
            <span className="font-serif font-medium text-[2rem] md:text-[2.75rem] text-[#E1CCE5] leading-none block mb-2">
              {value.toLocaleString("en-US")}
              {t(`${key}.suffix`)}
            </span>
            <span className="font-sans text-xs md:text-sm text-[#6B6365] tracking-wide">
              {t(`${key}.label`)}
            </span>
          </div>
        ))}
      </div>
    </section>
  )
}
