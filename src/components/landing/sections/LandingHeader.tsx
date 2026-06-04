"use client"

import { useEffect, useState } from "react"
import { MonzaHausWordmark } from "@/components/brand/MonzaHausWordmark"

export function LandingHeader() {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const container = document.getElementById("landing-scroll")
    if (!container) return
    const onScroll = () => setScrolled(container.scrollTop > 40)
    container.addEventListener("scroll", onScroll, { passive: true })
    return () => container.removeEventListener("scroll", onScroll)
  }, [])

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-10 transition-all duration-300 ${
        scrolled
          ? "bg-[#0E0E0D]/80 backdrop-blur-xl border-b border-white/5"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-5 md:px-8 h-14 md:h-16 flex items-center">
        <MonzaHausWordmark
          tone="lavender-on-noir"
          className="text-[15px] md:text-[18px] text-[#E8E2DE]"
        />
      </div>
    </header>
  )
}
