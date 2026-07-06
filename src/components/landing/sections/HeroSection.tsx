"use client"

import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { ChevronDown } from "lucide-react"
import Image from "next/image"

function markExplored() {
  localStorage.setItem("monzahaus-explored", "true")
}

function scrollToNextSection() {
  document.getElementById("landing-next-section")?.scrollIntoView({
    behavior: "smooth",
    block: "start",
  })
}

export function HeroSection() {
  const t = useTranslations("landing.hero")

  return (
    <section className="relative min-h-svh flex flex-col items-center justify-center px-5 md:px-8 overflow-hidden">
      {/* Noir bg base */}
      <div className="absolute inset-0 bg-[#0E0E0D]" />

      {/* 917 hero image — sits in the lower portion, fades into noir */}
      <div className="absolute inset-0">
        <Image
          src="/917-hero.png"
          alt=""
          fill
          priority
          className="object-contain object-bottom opacity-40 md:opacity-50"
          sizes="100vw"
        />
        {/* Top gradient — fades image into noir so text is readable */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#0E0E0D] via-[#0E0E0D]/80 to-transparent" />
        {/* Bottom gradient — fades the reflection */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0E0E0D] via-transparent to-transparent" />
      </div>

      {/* Lavender radial glow */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(70% 45% at 50% 0%, rgba(184, 159, 190, 0.14) 0%, transparent 70%)",
        }}
      />

      {/* Noise overlay */}
      <div className="absolute inset-0 opacity-[0.02] pointer-events-none">
        <svg className="w-full h-full">
          <filter id="landing-noise">
            <feTurbulence baseFrequency="0.9" numOctaves="4" stitchTiles="stitch" />
          </filter>
          <rect width="100%" height="100%" filter="url(#landing-noise)" />
        </svg>
      </div>

      {/* Content — positioned above center so it doesn't overlap the car */}
      <div className="relative z-[1] max-w-3xl mx-auto text-center mb-[12vh] md:mb-[8vh]">
        <p className="font-sans text-[11px] md:text-xs font-medium tracking-[0.25em] uppercase text-[#B89FBE] mb-6 md:mb-8">
          {t("eyebrow")}
        </p>
        <h1 className="font-serif font-light text-[2rem] leading-[1.1] md:text-[3.25rem] md:leading-[1.08] text-[#E8E2DE] tracking-[-0.02em] mb-5 md:mb-6">
          {t("headline")}
        </h1>
        <p className="font-sans text-base md:text-lg text-[#9A8E88] max-w-xl mx-auto leading-relaxed mb-8 md:mb-10">
          {t("subline")}
        </p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4">
          <Link
            href="/get-started"
            onClick={markExplored}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl bg-[#D6BEDC] text-[#3F2A47] font-sans font-semibold text-sm md:text-[0.9375rem] px-8 py-3.5 transition-all duration-250 hover:bg-[#E1CCE5] hover:scale-[1.02] active:scale-[0.98]"
          >
            {t("ctaSecondary")}
          </Link>
          <Link
            href="/browse"
            onClick={markExplored}
            className="w-full sm:w-auto inline-flex items-center justify-center rounded-xl border border-[#D6BEDC]/30 text-[#E8E2DE] font-sans font-medium text-sm md:text-[0.9375rem] px-8 py-3.5 transition-all duration-250 hover:border-[#D6BEDC]/60 hover:bg-white/[0.03]"
          >
            {t("cta")}
          </Link>
        </div>
      </div>

      {/* Scroll indicator */}
      <button
        type="button"
        aria-label="Scroll to next section"
        onClick={scrollToNextSection}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 z-[1] animate-bounce rounded-full p-2 text-[#6B6365]/60 transition-colors hover:text-[#E8E2DE] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#D6BEDC]/60"
      >
        <ChevronDown className="w-5 h-5 text-[#6B6365]/60" />
      </button>
    </section>
  )
}
