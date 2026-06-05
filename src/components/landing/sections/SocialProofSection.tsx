"use client"

import { useTranslations } from "next-intl"
import { useScrollReveal } from "@/hooks/useScrollReveal"
import { useEffect, useState } from "react"

const STATS = [
  { key: "listings", value: 12000 },
  { key: "regions", value: 4 },
  { key: "sources", value: 8 },
  { key: "reports", value: 2500 },
] as const

function AnimatedNumber({ target, active }: { target: number; active: boolean }) {
  const [current, setCurrent] = useState(0)

  useEffect(() => {
    if (!active) return
    const duration = 1600
    const steps = 40
    const increment = target / steps
    let step = 0
    const timer = setInterval(() => {
      step++
      if (step >= steps) {
        setCurrent(target)
        clearInterval(timer)
      } else {
        setCurrent(Math.floor(increment * step))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [active, target])

  return <>{active ? current.toLocaleString() : "0"}</>
}

export function SocialProofSection() {
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
        {STATS.map(({ key, value }, i) => (
          <div
            key={key}
            className={`text-center transition-all duration-700 ${
              isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
            }`}
            style={{ transitionDelay: isVisible ? `${i * 120}ms` : "0ms" }}
          >
            <span className="font-serif font-medium text-[2rem] md:text-[2.75rem] text-[#E1CCE5] leading-none block mb-2">
              <AnimatedNumber target={value} active={isVisible} />
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
