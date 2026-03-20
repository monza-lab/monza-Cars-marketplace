"use client"

import { useState } from "react"
import { useTranslations } from "next-intl"
import { Link, useRouter } from "@/i18n/navigation"
import { motion } from "framer-motion"
import { Search, TrendingUp, Shield, Car } from "lucide-react"

const popularMakes = [
  { name: "Porsche", slug: "porsche" },
  { name: "BMW", slug: "bmw" },
  { name: "Ferrari", slug: "ferrari" },
  { name: "Mercedes", slug: "mercedes" },
  { name: "Toyota", slug: "toyota" },
  { name: "Ford", slug: "ford" },
]

interface HeroStats {
  totalAuctions: number
  totalAnalyses: number
  platformsActive: number
}

export function HeroSection({ stats }: { stats?: HeroStats }) {
  const [searchQuery, setSearchQuery] = useState("")
  const router = useRouter()
  const t = useTranslations("hero")

  const displayStats = [
    {
      label: t("stats.listingsTracked"),
      value: stats?.totalAuctions ? stats.totalAuctions.toLocaleString() : "0",
      icon: Car,
    },
    {
      label: t("stats.aiAnalyses"),
      value: stats?.totalAnalyses ? stats.totalAnalyses.toLocaleString() : "0",
      icon: Shield,
    },
    {
      label: t("stats.platformsActive"),
      value: stats?.platformsActive ? stats.platformsActive.toString() : "0",
      icon: TrendingUp,
    },
  ]

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (searchQuery.trim()) {
      router.push(`/auctions?search=${encodeURIComponent(searchQuery.trim())}`)
    }
  }

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 pt-28 pb-24">
      {/* === Monza Background Effects === */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Top radial glow */}
        <div
          className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(80% 50% at 50% 0%, rgba(var(--glow-color), 0.12) 0%, transparent 60%)",
          }}
        />

        {/* Bottom secondary glow */}
        <div
          className="absolute bottom-0 left-1/2 h-[400px] w-[1200px] -translate-x-1/2"
          style={{
            background:
              "radial-gradient(ellipse, rgba(var(--glow-color), 0.06) 0%, transparent 70%)",
          }}
        />

        {/* Grid pattern */}
        <div
          className="absolute inset-0 animate-grid-fade"
          style={{
            backgroundImage: `
              linear-gradient(rgba(var(--glow-color), 0.04) 1px, transparent 1px),
              linear-gradient(90deg, rgba(var(--glow-color), 0.04) 1px, transparent 1px)
            `,
            backgroundSize: "80px 80px",
          }}
        />

        {/* Subtle side glows */}
        <div
          className="absolute -left-32 top-1/3 h-[500px] w-[500px] rounded-full opacity-[0.04]"
          style={{
            background: "radial-gradient(circle, rgba(var(--glow-color), 1), transparent 70%)",
          }}
        />
        <div
          className="absolute -right-32 top-2/3 h-[400px] w-[400px] rounded-full opacity-[0.03]"
          style={{
            background: "radial-gradient(circle, rgba(var(--glow-color), 1), transparent 70%)",
          }}
        />
      </div>

      {/* === Content === */}
      <div className="relative z-10 mx-auto w-full max-w-4xl text-center">
        {/* Monza label badge */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
        >
          <span className="mb-8 inline-flex items-center gap-2.5 rounded-full border border-primary/15 bg-primary/4 px-5 py-2 text-[11px] font-medium tracking-[0.2em] text-primary uppercase">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            {t("badge")}
          </span>
        </motion.div>

        {/* Main headline — large editorial style */}
        <motion.h1
          className="mt-10 text-5xl font-light leading-[1.05] tracking-tight sm:text-6xl lg:text-8xl"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <span className="block text-foreground">{t("headline1")}</span>
          <span className="block text-gradient font-semibold">{t("headline2")}</span>
          <span className="block text-foreground">{t("headline3")}</span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          className="mx-auto mt-8 max-w-xl text-base leading-relaxed text-[rgba(232,226,222,0.5)] sm:text-lg font-light"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          {t("subheadline")}
        </motion.p>

        {/* Search bar — Monza glassmorphism */}
        <motion.form
          onSubmit={handleSearch}
          className="mx-auto mt-12 flex max-w-xl items-center gap-0 overflow-hidden rounded-full border border-primary/10 bg-card shadow-2xl shadow-black/20 backdrop-blur-xl transition-all focus-within:border-primary/25 focus-within:shadow-primary/5"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <div className="flex flex-1 items-center gap-3 px-6">
            <Search className="h-4 w-4 shrink-0 text-[rgba(232,226,222,0.3)]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("searchPlaceholder")}
              className="h-14 w-full bg-transparent text-sm text-foreground placeholder:text-[rgba(232,226,222,0.3)] focus:outline-none"
            />
          </div>
          <button
            type="submit"
            className="m-2 flex h-10 shrink-0 items-center gap-2 rounded-full bg-primary px-6 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground transition-all hover:bg-primary/80 hover:shadow-lg hover:shadow-primary/20"
          >
            {t("search")}
          </button>
        </motion.form>

        {/* Quick filter chips */}
        <motion.div
          className="mt-6 flex flex-wrap items-center justify-center gap-2"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.7 }}
        >
          <span className="mr-1 text-[11px] tracking-[0.15em] uppercase text-[rgba(232,226,222,0.3)]">
            {t("popular")}
          </span>
          {popularMakes.map((make) => (
            <Link
              key={make.slug}
              href={`/auctions?search=${make.slug}`}
              className="rounded-full border border-primary/8 bg-primary/3 px-3.5 py-1 text-[11px] font-medium tracking-[0.1em] text-[rgba(232,226,222,0.4)] transition-all hover:border-primary/20 hover:bg-primary/6 hover:text-primary"
            >
              {make.name}
            </Link>
          ))}
        </motion.div>

        {/* Stats row */}
        <motion.div
          className="mx-auto mt-20 grid max-w-md grid-cols-3 gap-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.9 }}
        >
          {displayStats.map((stat) => (
            <div key={stat.label} className="flex flex-col items-center gap-2">
              <span className="text-3xl font-light tracking-tight text-foreground sm:text-4xl">
                {stat.value}
              </span>
              <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[rgba(232,226,222,0.35)]">
                {stat.label}
              </span>
            </div>
          ))}
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.5, duration: 0.5 }}
      >
        <motion.div
          className="flex h-8 w-5 items-start justify-center rounded-full border border-primary/15 p-1"
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ repeat: Infinity, duration: 2 }}
        >
          <motion.div
            className="h-1.5 w-1 rounded-full bg-primary/50"
            animate={{ y: [0, 8, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          />
        </motion.div>
      </motion.div>
    </section>
  )
}
