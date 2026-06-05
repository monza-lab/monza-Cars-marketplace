"use client"

import { useTranslations } from "next-intl"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import { Globe, FileText, BookOpen, TrendingUp, MessageCircle } from "lucide-react"

const FEATURES = [
  { key: "intelligence", Icon: Globe },
  { key: "reports", Icon: FileText },
  { key: "knowledge", Icon: BookOpen },
  { key: "indices", Icon: TrendingUp },
  { key: "advisor", Icon: MessageCircle },
] as const

export function EcosystemSection() {
  const t = useTranslations("landing.ecosystem")
  const { ref, isVisible } = useScrollReveal()

  return (
    <section className="bg-[#F5F2EE] py-20 md:py-28 px-5 md:px-8">
      <div ref={ref} className="max-w-5xl mx-auto">
        <h2
          className={`font-serif font-normal text-center text-[1.75rem] md:text-[2.25rem] text-[#141413] tracking-[-0.02em] mb-4 transition-all duration-700 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {t("title")}
        </h2>
        <p
          className={`font-sans text-sm md:text-base text-[#6B6365] text-center max-w-lg mx-auto mb-12 md:mb-16 transition-all duration-700 delay-100 ${
            isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
          }`}
        >
          {t("subtitle")}
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
          {FEATURES.map(({ key, Icon }, i) => (
            <div
              key={key}
              className={`group bg-[#FDFBF9] border border-[#E8E2DC] rounded-xl p-6 md:p-8 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg ${
                i === FEATURES.length - 1 ? "md:col-span-2 md:max-w-[calc(50%-0.625rem)] md:mx-auto" : ""
              } ${
                isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-6"
              }`}
              style={{ transitionDelay: isVisible ? `${150 + i * 80}ms` : "0ms" }}
            >
              <div className="w-9 h-9 md:w-10 md:h-10 rounded-lg bg-[#D6BEDC]/15 flex items-center justify-center mb-4 transition-colors group-hover:bg-[#D6BEDC]/25">
                <Icon className="w-[18px] h-[18px] md:w-5 md:h-5 text-[#5D3F66]" strokeWidth={1.5} />
              </div>
              <h3 className="font-serif font-medium text-[1.125rem] md:text-xl text-[#141413] mb-2">
                {t(`${key}.title`)}
              </h3>
              <p className="font-sans text-sm text-[#6B6365] leading-relaxed">
                {t(`${key}.desc`)}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
