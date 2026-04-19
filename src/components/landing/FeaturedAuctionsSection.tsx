"use client"

import Image from "next/image"
import { motion } from "framer-motion"
import { BadgeCheck, Gavel, ExternalLink } from "lucide-react"
import { featuredAuctions, getPlatformDisplayName, type FeaturedAuction } from "@/lib/featuredAuctions"
import { useCurrency } from "@/lib/CurrencyContext"
import { useTranslations } from "next-intl"
import { formatUsdValue } from "@/components/dashboard/utils/valuation"

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRelativeTime(when: string | Date): string {
  const end = typeof when === "string" ? new Date(when) : when
  const diffMs = end.getTime() - Date.now()
  if (diffMs <= 0) return "soon"
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  if (days >= 1) return `in ${days}d`
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  return `in ${hours}h`
}

// ---------------------------------------------------------------------------
// Featured Card Component
// ---------------------------------------------------------------------------

function FeaturedCard({
  auction,
  index,
  labels,
}: {
  auction: FeaturedAuction
  index: number
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
  const { formatPrice } = useCurrency()
  const isHero = index === 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.15, ease: [0.4, 0, 0.2, 1] }}
      className={`group relative overflow-hidden rounded-2xl border border-primary/10 bg-card backdrop-blur-sm ${
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
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent dark:from-background dark:via-background/40" />

        {/* Platform Badge */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <span className="rounded-full bg-background/80 backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold tracking-wider uppercase text-foreground border border-border">
            {getPlatformDisplayName(auction.platform)}
          </span>
          {auction.verified && (
            <span className="flex items-center gap-1 rounded-full bg-positive/20 backdrop-blur-md px-2.5 py-1.5 border border-positive/30">
              <BadgeCheck className="size-3 text-positive" />
              <span className="text-[9px] font-semibold tracking-wider uppercase text-positive">
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
                ? "bg-primary/20 text-primary border border-primary/30"
                : auction.status === "ACTIVE"
                ? "bg-positive/20 text-positive border border-positive/30"
                : "bg-amber-500/20 text-destructive border border-amber-500/30"
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
          {/* Listing Status */}
          <div className="flex items-center gap-2 mb-2">
            {auction.status === "SOLD" && auction.currentBid ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-positive/30 bg-positive/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-positive">
                Sold at {formatUsdValue(auction.currentBid)}
              </span>
            ) : auction.endTime ? (
              <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/15 px-2 py-0.5 text-[9px] font-bold tracking-wider text-primary">
                Ends {formatRelativeTime(auction.endTime)}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 rounded-full border border-muted-foreground/30 bg-foreground/10 px-2 py-0.5 text-[9px] font-bold tracking-wider text-muted-foreground">
                Upcoming
              </span>
            )}
            <span className="text-[10px] text-muted-foreground">
              {auction.mileage.toLocaleString()} {auction.mileageUnit}
            </span>
          </div>

          {/* Title */}
          <h3
            className={`font-bold text-foreground leading-tight ${
              isHero ? "text-2xl lg:text-3xl" : "text-lg"
            }`}
          >
            {auction.title}
          </h3>

          {/* Color & Engine */}
          <p className="text-[12px] text-muted-foreground mt-1">
            {auction.exteriorColor} · {auction.engine}
          </p>

          {/* Price */}
          <div className="flex items-end justify-between mt-3">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                {auction.status === "SOLD" ? labels.hammerPrice : labels.currentBid}
              </p>
              <p className={`font-display font-medium text-primary ${isHero ? "text-3xl" : "text-xl"}`}>
                {formatPrice(auction.currentBid ?? 0)}
              </p>
            </div>

            {/* CTA */}
            <a
              href={auction.platformUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/20 px-3 py-2 text-[11px] font-medium text-primary hover:bg-primary/20 hover:border-primary/40 transition-all"
            >
              <ExternalLink className="size-3" />
              {labels.viewListing}
            </a>
          </div>
        </div>
      </div>

      {/* Highlight text (Hero only) */}
      {isHero && (
        <div className="px-5 py-4 border-t border-border">
          <p className="text-[13px] text-foreground/70 leading-relaxed">
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
            <Gavel className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary">
              {tFeatured("kicker")}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-foreground tracking-tight">
            {tSections("featuredListings")}
          </h2>
          <p className="mt-2 text-[14px] text-muted-foreground max-w-xl">
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
          className="mt-6 text-center text-[10px] text-muted-foreground/60"
        >
          {tFeatured("dataNote")}
        </motion.p>
      </div>
    </section>
  )
}
