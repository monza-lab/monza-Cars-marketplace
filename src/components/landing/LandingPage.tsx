"use client"

import { LandingHeader } from "./sections/LandingHeader"
import { HeroSection } from "./sections/HeroSection"
import { ProblemSection } from "./sections/ProblemSection"
import { EcosystemSection } from "./sections/EcosystemSection"
import { SocialProofSection } from "./sections/SocialProofSection"
import { VisionSection } from "./sections/VisionSection"
import { CtaSection } from "./sections/CtaSection"
import { MonzaHausWordmark } from "@/components/brand/MonzaHausWordmark"
import { MonzaHausHelmet } from "@/components/brand/MonzaHausHelmet"
import { Link } from "@/i18n/navigation"

function LandingFooter() {
  return (
    <footer className="bg-[#0E0E0D] border-t border-white/5 py-8 md:py-10 px-5 md:px-8">
      <div className="max-w-5xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
        <MonzaHausWordmark
          tone="lavender-on-noir"
          className="text-[14px] text-[#6B6365]"
        />
        <div className="flex items-center gap-4 text-[10px] text-[#6B6365] tracking-wide">
          <Link href="/legal/privacy" className="hover:text-[#E8E2DE] transition-colors">
            Privacy
          </Link>
          <span className="text-white/10">·</span>
          <Link href="/legal/terms" className="hover:text-[#E8E2DE] transition-colors">
            Terms
          </Link>
          <span className="text-white/10">·</span>
          <a
            href="https://monzalab.com"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 hover:text-[#E8E2DE] transition-colors"
          >
            Powered by
            <MonzaHausHelmet tone="lavender-on-noir" size={10} label="Monza Lab" />
            Monza Lab
          </a>
        </div>
      </div>
    </footer>
  )
}

export function LandingPage() {
  return (
    <div
      id="landing-scroll"
      className="fixed inset-0 z-[100] overflow-y-auto scroll-smooth bg-[#0E0E0D]"
    >
      <LandingHeader />
      <HeroSection />
      <ProblemSection />
      <EcosystemSection />
      <SocialProofSection />
      <VisionSection />
      <CtaSection />
      <LandingFooter />
    </div>
  )
}
