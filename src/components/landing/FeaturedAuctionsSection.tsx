"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { BadgeCheck, Clock, Gavel, ExternalLink, TrendingUp } from "lucide-react"
import { featuredAuctions, getPlatformDisplayName, type FeaturedAuction } from "@/lib/featuredAuctions"
import { useLocale, useTranslations } from "next-intl"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(amount: number, locale: string): string {
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(2)}M`
  }
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getGradeBadgeStyle(grade: FeaturedAuction["investmentGrade"]): string {
  switch (grade) {
    case "AAA":
      return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    case "AA":
      return "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border-[rgba(248,180,217,0.3)]"
    case "A":
      return "bg-amber-500/15 text-amber-400 border-amber-500/30"
    default:
      return "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
  }
}

// ---------------------------------------------------------------------------
// Featured Card Component
// ---------------------------------------------------------------------------

function FeaturedCard({
  auction,
  index,
  locale,
  labels,
}: {
  auction: FeaturedAuction
  index: number
  locale: string
  labels: {
    verified: string
    sold: string
    live: string
    endingSoon: string
    hammerPrice: string
    currentBid: string
    viewListing: string
  }
}) {
  const isHero = index === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.4, 0, 0.2, 1] }}
      className={`group relative overflow-hidden rounded-2xl border border-[rgba(248,180,217,0.1)] bg-[rgba(15,14,22,0.7)] backdrop-blur-sm ${
        isHero ? "lg:col-span-2 lg:row-span-2" : ""
      }`}
    >
      {/* Image */}
      <div className={`relative overflow-hidden ${isHero ? "aspect-[16/10]" : "aspect-[4/3]"}`}>
        <Image
          src={auction.images[0]}
          alt={auction.title}
          fill
          className="object-cover transition-transform duration-700 group-hover:scale-105"
          sizes={isHero ? "(max-width: 1024px) 100vw, 66vw" : "(max-width: 1024px) 100vw, 33vw"}
          priority={index < 2}
          referrerPolicy="no-referrer"
          unoptimized
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/40 to-transparent" />

        {/* Platform Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="rounded-full bg-[#0b0b10]/80 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-[#FFFCF7] border border-[rgba(255,255,255,0.1)]">
            {getPlatformDisplayName(auction.platform)}
          </span>
          {auction.verified && (
            <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 backdrop-blur-md px-2.5 py-1.5 border border-emerald-500/30">
              <BadgeCheck className="size-3 text-emerald-400" />
              <span className="text-[9px] font-semibold tracking-wider uppercase text-emerald-400">
                {labels.verified}
              </span>
            </span>
          )}
        </div>

        {/* Status Badge */}
        <div className="absolute top-4 right-4">
          <span
            className={`rounded-full px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase ${
              auction.status === "SOLD"
                ? "bg-[rgba(248,180,217,0.2)] text-[#F8B4D9] border border-[rgba(248,180,217,0.3)]"
                : auction.status === "ACTIVE"
                ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                : "bg-amber-500/20 text-amber-400 border border-amber-500/30"
            }`}
          >
            {auction.status === "SOLD"
              ? labels.sold
              : auction.status === "ACTIVE"
              ? labels.live
              : labels.endingSoon}
          </span>
        </div>

        {/* Content overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-5">
          {/* Investment Grade */}
          <div className="flex items-center gap-2 mb-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[9px] font-bold tracking-wider ${getGradeBadgeStyle(
                auction.investmentGrade
              )}`}
            >
              <TrendingUp className="size-2.5" />
              {auction.investmentGrade}
            </span>
            <span className="text-[10px] text-[rgba(255,252,247,0.5)]">
              {auction.mileage.toLocaleString()} {auction.mileageUnit}
            </span>
          </div>

          {/* Title */}
          <h3
            className={`font-bold text-[#FFFCF7] leading-tight ${
              isHero ? "text-2xl lg:text-3xl" : "text-lg"
            }`}
          >
            {auction.title}
          </h3>

          {/* Color & Engine */}
          <p className="text-[12px] text-[rgba(255,252,247,0.5)] mt-1">
            {auction.exteriorColor} · {auction.engine}
          </p>

          {/* Price */}
          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.4)]">
                {auction.status === "SOLD" ? labels.hammerPrice : labels.currentBid}
              </p>
              <p className={`font-bold font-mono text-[#F8B4D9] ${isHero ? "text-3xl" : "text-xl"}`}>
                {formatCurrency(auction.currentBid, locale)}
              </p>
            </div>

            {/* CTA */}
            <a
              href={auction.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-[rgba(248,180,217,0.1)] border border-[rgba(248,180,217,0.2)] px-3 py-2 text-[11px] font-medium text-[#F8B4D9] hover:bg-[rgba(248,180,217,0.2)] hover:border-[rgba(248,180,217,0.4)] transition-all"
            >
              <ExternalLink className="size-3" />
              {labels.viewListing}
            </a>
          </div>
        </div>
      </div>

      {/* Highlight text (Hero only) */}
      {isHero && (
        <div className="px-5 py-4 border-t border-[rgba(255,255,255,0.05)]">
          <p className="text-[13px] text-[rgba(255,252,247,0.6)] leading-relaxed">
            {auction.highlight}
          </p>
        </div>
      )}
    </motion.div>
  )
}

// ---------------------------------------------------------------------------
// Main Section
// ---------------------------------------------------------------------------

export function FeaturedAuctionsSection() {
  const locale = useLocale()
  const tFeatured = useTranslations("featuredAuctions")
  const tCommon = useTranslations("common")
  const tStatus = useTranslations("status")
  const tSections = useTranslations("sections")

  const labels = {
    verified: tCommon("verified"),
    sold: tStatus("sold"),
    live: tStatus("live"),
    endingSoon: tStatus("endingSoon"),
    hammerPrice: tFeatured("hammerPrice"),
    currentBid: tCommon("currentBid"),
    viewListing: tFeatured("viewListing"),
  }

  return (
    <section className="relative py-16 sm:py-20">
      {/* Section header */}
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-3">
            <Gavel className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
              {tFeatured("kicker")}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#FFFCF7] tracking-tight">
            {tSections("featuredAuctions")}
          </h2>
          <p className="mt-2 text-[14px] text-[rgba(255,252,247,0.5)] max-w-xl">
            {tFeatured("subtitle")}
          </p>
        </motion.div>

        {/* Bento Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-5">
          {featuredAuctions.filter(a => a.make !== "Ferrari").map((auction, i) => (
            <FeaturedCard
              key={auction.id}
              auction={auction}
              index={i}
              locale={locale}
              labels={labels}
            />
          ))}
        </div>

        {/* Data source note */}
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.5 }}
          className="mt-6 text-center text-[10px] text-[rgba(255,252,247,0.25)]"
        >
          {tFeatured("dataNote")}
        </motion.p>
      </div>
    </section>
  )
}
