"use client"

import { useTranslations } from "next-intl"
import { useScrollReveal } from "@/hooks/useScrollReveal"

const PROBLEMS = [
  { number: "01", key: "opacity" },
  { number: "02", key: "gut" },
  { number: "03", key: "knowledge" },
] as const

export function ProblemSection() {
  const t = useTranslations("landing.problem")
  const { ref, isVisible } = useScrollReveal()

  return (
    <section className="relative bg-[#FDFBF9] py-20 md:py-28 px-5 md:px-8">
      {/* Noise */}
      <div className="absolute inset-0 opacity-[0.012] pointer-events-none">
        <svg className="w-full h-full">
          <filter id="problem-noise">
            <feTurbulence baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#problem-noise)" />
        </svg>
      </div>

      <div
        ref={ref}
        className={`relative z-[1] max-w-5xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-10 md:gap-14 transition-all duration-700 ${
          isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
        }`}
      >
        {PROBLEMS.map(({ number, key }) => (
          <div key={key} className="text-center md:text-left">
            <span className="font-serif font-medium text-[2rem] md:text-[2.5rem] text-[#D6BEDC] leading-none block mb-4">
              {number}
            </span>
            <h3 className="font-sans font-semibold text-[0.9375rem] md:text-base text-[#141413] mb-2.5">
              {t(`${key}.title`)}
            </h3>
            <p className="font-sans text-sm text-[#6B6365] leading-relaxed">
              {t(`${key}.desc`)}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
