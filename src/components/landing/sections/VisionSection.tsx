"use client"

import { useTranslations } from "next-intl"
import { useScrollReveal } from "@/hooks/useScrollReveal"

export function VisionSection() {
  const t = useTranslations("landing.vision")
  const { ref, isVisible } = useScrollReveal()

  return (
    <section className="bg-[#FDFBF9] py-20 md:py-28 px-5 md:px-8">
      <div
        ref={ref}
        className={`max-w-xl mx-auto text-center transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        <h2 className="font-serif font-light text-[1.75rem] md:text-[2.25rem] text-[#141413] tracking-[-0.02em] mb-5 md:mb-6">
          {t("headline")}
        </h2>
        <p className="font-sans text-sm md:text-base text-[#6B6365] leading-relaxed">
          {t("body")}
        </p>
      </div>
    </section>
  )
}
