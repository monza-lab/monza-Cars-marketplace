"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import { Link } from "@/i18n/navigation"
import { motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, resolveRegion, convertFromUsd, REGION_CURRENCY } from "@/lib/regionPricing"
import {
  Clock,
  MapPin,
  Gauge,
  Cog,
  Gavel,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Scale,
  BarChart3,
  Calendar,
  Award,
  Globe,
  DollarSign,
  Wrench,
  Shield,
  Car,
  Search,
  SlidersHorizontal,
  Flame,
  ChevronDown,
} from "lucide-react"
import { getBrandImage, getModelImage } from "@/lib/modelImages"
import { extractSeries, getSeriesConfig, getSeriesThesis, getBrandConfig } from "@/lib/brandConfig"
import { filterAuctionsForRegion } from "./platformMapping"
import type { Brand, Auction, PorscheFamily, LiveRegionTotals } from "./types"
import { platformShort, mockWhyBuy, REGION_FLAGS, REGION_LABEL_KEYS } from "./constants"
import type { RegionalValuation } from "./utils/valuation"
import { computeRegionalValFromAuctions, formatRegionalVal, formatUsdEquiv } from "./utils/valuation"
import { aggregateBrands, aggregateFamilies } from "./utils/aggregation"
import { timeLeft } from "./utils/timeLeft"
import { SafeImage } from "./cards/SafeImage"
import { FamilyCard } from "./cards/FamilyCard"
import { MobileRegionPills } from "./mobile/MobileRegionPills"
import { MobileHeroBrand } from "./mobile/MobileHeroBrand"
import { MobileBrandRow } from "./mobile/MobileBrandRow"
import { MobileLiveAuctions } from "./mobile/MobileLiveAuctions"
import { DiscoverySidebar } from "./sidebar/DiscoverySidebar"
import { FamilyContextPanel } from "./context/FamilyContextPanel"
import { BrandContextPanel } from "./context/BrandContextPanel"
// FilterSidebar removed — filters now live only on brand detail pages

// ─── COLUMN B: BRAND CARD (NEW - replaces AssetCard on landing) ───
function BrandCard({ brand, index = 0 }: { brand: Brand; index?: number }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/${brand.slug}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          <SafeImage
            src={brand.representativeImage}
            alt={brand.name}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="50vw"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            unoptimized
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{brand.name}</span>
              </div>
            }
          />

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Car count badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {t("brandCard.carsCount", { count: brand.carCount })}
            </span>
          </div>

          {/* Grade badge */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              brand.topGrade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : brand.topGrade === "AA"
                ? "bg-primary/30 text-primary"
                : "bg-foreground/20 text-white"
            }`}>
              {brand.topGrade}
            </span>
          </div>
        </div>

        {/* BOTTOM: BRAND INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          {/* Brand name */}
          <div>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {brand.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {brand.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            {/* Price Range */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.priceRange")}</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">
                {formatPriceForRegion(brand.priceMin, selectedRegion)}–{formatPriceForRegion(brand.priceMax, selectedRegion)}
              </p>
            </div>

            {/* Trend */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <TrendingUp className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.trend")}</span>
              </div>
              <p className="text-[13px] font-semibold text-positive">{brand.avgTrend}</p>
            </div>

            {/* Collection */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-foreground">{t("brandCard.vehiclesCount", { count: brand.carCount })}</p>
            </div>
          </div>

          {/* Categories */}
          {brand.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {brand.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1 rounded-full bg-foreground/5 text-[10px] text-muted-foreground"
                >
                  {cat}
                </span>
              ))}
              {brand.categories.length > 3 && (
                <span className="px-3 py-1 rounded-full bg-foreground/5 text-[10px] text-muted-foreground">
                  {t("brandCard.more", { count: brand.categories.length - 3 })}
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              {t("brandCard.exploreCollection")}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── COLUMN A: BRAND NAVIGATION ───
function BrandNavigationPanel({
  brands,
  currentIndex,
  onSelect,
}: {
  brands: Brand[]
  currentIndex: number
  onSelect: (index: number) => void
}) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  return (
    <div className="h-full flex flex-col border-r border-border overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-border">
        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
          {t("brandNav.title")}
        </span>
        <p className="mt-1 text-[12px] text-muted-foreground">
          {t("brandNav.manufacturers", { count: brands.length })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="shrink-0 px-4 py-3 border-b border-border bg-primary/2">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
              {t("brandNav.totalCars")}
            </span>
            <p className="text-[14px] font-bold text-foreground mt-0.5">
              {brands.reduce((sum, b) => sum + b.carCount, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
              {t("brandNav.aaaBrands")}
            </span>
            <p className="text-[14px] font-bold text-positive mt-0.5">
              {brands.filter(b => b.topGrade === "AAA").length}
            </p>
          </div>
        </div>
      </div>

      {/* Brand List — Scrollable */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {brands.map((brand, index) => {
          const isActive = index === currentIndex

          return (
            <button
              key={brand.slug}
              onClick={() => onSelect(index)}
              className={`group relative w-full text-left px-4 py-3 transition-all duration-200 ${
                isActive ? "bg-primary/8" : "hover:bg-foreground/2"
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-0 bottom-0 w-[2px] bg-primary"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <div className="flex items-center gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold truncate transition-colors ${
                    isActive ? "text-foreground" : "text-muted-foreground group-hover:text-foreground"
                  }`}>
                    {brand.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[11px] font-mono ${
                      isActive ? "text-primary" : "text-primary/60"
                    }`}>
                      {t("brandNav.carsCount", { count: brand.carCount })}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {formatPriceForRegion(brand.priceMin, selectedRegion)}–{formatPriceForRegion(brand.priceMax, selectedRegion)}
                    </span>
                  </div>
                </div>

                {/* Grade badge */}
                <span className={`text-[10px] font-bold ${
                  brand.topGrade === "AAA" ? "text-positive" :
                  brand.topGrade === "AA" ? "text-primary" :
                  "text-muted-foreground"
                }`}>
                  {brand.topGrade}
                </span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}


// ─── COLUMN B: THE BTW-STYLE ASSET CARD (DESKTOP) ───
function AssetCard({ auction }: { auction: Auction }) {
  const t = useTranslations("dashboard")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")
  const { selectedRegion } = useRegion()

  const isLive = auction.status === "ACTIVE" || auction.status === "ENDING_SOON"
  const isEndingSoon = auction.status === "ENDING_SOON"

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <div className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border">
        {/* TOP: CINEMATIC IMAGE (wider aspect ratio to fit CTAs) */}
        <div className="relative aspect-[16/8] w-full shrink-0">
          <SafeImage
            src={auction.images[0]}
            alt={auction.title}
            fill
            className="object-cover object-center"
            sizes="50vw"
            loading="lazy"
            referrerPolicy="no-referrer"
            unoptimized
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{t("asset.noImage")}</span>
              </div>
            }
          />

          {/* Vignette gradient at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-card to-transparent pointer-events-none" />

          {/* Status pill overlay */}
          <div className="absolute top-4 left-4 flex items-center gap-2">
            {isLive && (
              <span className={`flex items-center gap-2 rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-semibold tracking-[0.1em] uppercase ${
                isEndingSoon
                  ? "bg-red-500/30 text-red-300"
                  : "bg-emerald-500/30 text-emerald-300"
              }`}>
                <span className={`size-2 rounded-full ${
                  isEndingSoon ? "bg-red-400" : "bg-emerald-400"
                } animate-pulse`} />
                {isEndingSoon ? tStatus("endingSoon") : tStatus("live")}
              </span>
            )}
          </div>

          {/* Platform badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {platformShort[auction.platform]}
            </span>
          </div>
        </div>

        {/* BOTTOM: DATA DECK (fills remaining space) */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-start overflow-hidden">
          {/* Title + Price row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-foreground tracking-tight truncate">
                {auction.make} {auction.model}
              </h2>
              {auction.trim && (
                <p className="text-[15px] text-muted-foreground mt-0.5">{auction.trim}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-foreground font-mono tabular-nums">
                {formatPriceForRegion(auction.currentBid, selectedRegion)}
              </p>
              <div className="flex items-center justify-end gap-3 mt-1 text-muted-foreground">
                <span className="text-[11px]">{tAuction("bids.count", { count: auction.bidCount })}</span>
                {isLive && (
                  <span className="flex items-center gap-1 text-[11px] font-mono">
                    <Clock className="size-3" />
                    {timeLeft(auction.endTime, {
                      ended: tAuction("time.ended"),
                      day: tAuction("time.units.day"),
                      hour: tAuction("time.units.hour"),
                      minute: tAuction("time.units.minute"),
                    })}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Investment Metrics Grid */}
          {(() => {
            const grade = auction.analysis?.investmentGrade || "B+"
            const trend = auction.analysis?.appreciationPotential === "APPRECIATING"
              ? (grade === "AAA" ? "Premium Demand" : grade === "AA" ? "Strong Demand" : "High Demand")
              : auction.analysis?.appreciationPotential === "DECLINING"
              ? "Low Demand"
              : (grade === "AAA" ? "Premium Demand" : grade === "AA" ? "Strong Demand" : "Growing Demand")
            const bidFallback = auction.currentBid || 50_000
            const lowRange = auction.analysis?.bidTargetLow || Math.round(bidFallback * 0.85)
            const highRange = auction.analysis?.bidTargetHigh || Math.round(bidFallback * 1.15)

            return (
              <div className="mt-auto grid grid-cols-4 gap-4 pt-4 border-t border-border">
                {/* Grade */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Award className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.grade")}</span>
                  </div>
                  <p className={`text-[15px] font-bold ${
                    grade === "AAA" || grade === "EXCELLENT" ? "text-positive" :
                    grade === "AA" || grade === "A" || grade === "GOOD" ? "text-primary" :
                    "text-foreground"
                  }`}>{grade}</p>
                </div>

                {/* Trend */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <TrendingUp className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.trend")}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-positive">{trend}</p>
                </div>

                {/* Fair Value */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <DollarSign className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.fairValue")}</span>
                  </div>
                  <p className="text-[13px] text-foreground font-mono">
                    {formatPriceForRegion(lowRange, selectedRegion)}–{formatPriceForRegion(highRange, selectedRegion)}
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Car className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.category")}</span>
                  </div>
                  <p className="text-[13px] text-foreground truncate">{auction.category || t("asset.metrics.collector")}</p>
                </div>
              </div>
            )
          })()}

          {/* CTA Row */}
          <div className="flex items-center gap-3 mt-4">
            {isLive && (
              <button className="flex-1 rounded-full bg-primary py-3 text-[12px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-colors">
                {tAuction("actions.placeBid")}
              </button>
            )}
            <Link
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex-1 rounded-full border border-border py-3 text-center text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground hover:text-foreground hover:border-primary/50 transition-all"
            >
              {t("asset.fullAnalysis")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── COLUMN C: THE CONTEXT PANEL ───
// Enhanced with price chart, ownership cost, and similar cars
function ContextPanel({ auction, allAuctions }: { auction: Auction; allAuctions: Auction[] }) {
  const t = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const { selectedRegion, effectiveRegion } = useRegion()

  const whyBuy = getBrandConfig(auction.make)?.defaultThesis || mockWhyBuy[auction.make] || mockWhyBuy["default"]
  const recentSales = useMemo(() => {
    return allAuctions
      .filter(a => a.make === auction.make && a.id !== auction.id && a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Auction",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [allAuctions, auction.make, auction.id])
  const ownershipCost = useMemo(() => {
    const config = getBrandConfig(auction.make)
    const base = config?.ownershipCosts ?? { insurance: 8000, storage: 5000, maintenance: 7000 }
    const price = auction.currentBid || 100_000
    const scale = price < 100_000 ? 0.7 : price < 250_000 ? 1.0 : price < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(base.insurance * scale),
      storage: Math.round(base.storage * scale),
      maintenance: Math.round(base.maintenance * scale),
    }
  }, [auction.make, auction.currentBid])
  // Fair value range — use analysis if available, otherwise derive from current bid
  const bidFallback = auction.currentBid || 50_000
  const lowRange = auction.analysis?.bidTargetLow || Math.round(bidFallback * 0.85)
  const highRange = auction.analysis?.bidTargetHigh || Math.round(bidFallback * 1.15)

  // Find similar cars (same category, different car)
  const similarCars = allAuctions
    .filter(a => a.category === auction.category && a.id !== auction.id)
    .slice(0, 5)

  const totalAnnualCost = ownershipCost.insurance + ownershipCost.storage + ownershipCost.maintenance

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* SECTION 1: Investment Thesis */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Scale className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("context.investmentThesis")}
          </span>
        </div>
        <p className="text-[11px] leading-snug text-muted-foreground line-clamp-4">
          {whyBuy}
        </p>
      </div>

      {/* SECTION 2: Fair Value by Region */}
      <div className="px-5 py-3 border-b border-border bg-primary/3">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("context.fairValueByRegion")}
          </span>
        </div>

        {auction.fairValueByRegion ? (
          <div className="space-y-1.5">
            {(["US", "EU", "UK", "JP"] as const).map(region => {
              const rp = auction.fairValueByRegion![region]
              const isSelected = region === effectiveRegion
              const flags: Record<string, string> = { US: "🇺🇸", EU: "🇪🇺", UK: "🇬🇧", JP: "🇯🇵" }
              return (
                <div key={region} className={`flex items-center justify-between ${isSelected ? "rounded bg-primary/4 -mx-1 px-1 py-0.5" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{flags[region]}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{region}</span>
                    {isSelected && <span className="text-[8px] font-bold text-primary tracking-wide">{t("brandContext.yourMarket")}</span>}
                  </div>
                  <span className={`text-[12px] font-bold font-mono ${isSelected ? "text-primary" : "text-foreground"}`}>
                    {fmtRegional(rp.low, rp.currency)} — {fmtRegional(rp.high, rp.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-display font-medium text-primary">
              {formatPriceForRegion(lowRange, selectedRegion)} — {formatPriceForRegion(highRange, selectedRegion)}
            </span>
          </div>
        )}
      </div>

      {/* SECTION 3: Ownership Cost */}
      <div className="px-5 py-3 border-b border-border">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="size-4 text-primary" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {t("context.annualOwnershipCost")}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <Shield className="size-3 text-muted-foreground mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t("context.insurance")}</p>
            <p className="text-[11px] font-mono font-semibold text-foreground">${(ownershipCost.insurance / 1000).toFixed(0)}K</p>
          </div>
          <div className="text-center">
            <MapPin className="size-3 text-muted-foreground mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t("context.storage")}</p>
            <p className="text-[11px] font-mono font-semibold text-foreground">${(ownershipCost.storage / 1000).toFixed(1)}K</p>
          </div>
          <div className="text-center">
            <Wrench className="size-3 text-muted-foreground mx-auto mb-1" />
            <p className="text-[10px] text-muted-foreground">{t("context.service")}</p>
            <p className="text-[11px] font-mono font-semibold text-foreground">${(ownershipCost.maintenance / 1000).toFixed(0)}K</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-border flex justify-between">
          <span className="text-[10px] text-muted-foreground">{t("context.totalAnnual")}</span>
          <span className="text-[12px] font-display font-medium text-primary">${(totalAnnualCost / 1000).toFixed(0)}K{t("context.perYear")}</span>
        </div>
      </div>

      {/* SECTION 4: Similar Cars (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3">
        {similarCars.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Car className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("context.alsoConsider")}
              </span>
            </div>
            <div className="space-y-2">
              {similarCars.map((car) => (
                <Link
                  key={car.id}
                  href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
                  className="flex items-center justify-between py-2 px-2 rounded-lg bg-foreground/2 hover:bg-foreground/4 transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-foreground truncate group-hover:text-primary transition-colors">
                      {car.make} {car.model}
                    </p>
                    <p className="text-[10px] text-muted-foreground">{car.category}</p>
                  </div>
                  <span className="text-[11px] font-display font-medium text-primary ml-2">
                    {formatPriceForRegion(car.currentBid, selectedRegion)}
                  </span>
                </Link>
              ))}
            </div>
          </>
        )}

        {/* Recent Comparables */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("context.recentSales")}
            </span>
          </div>
          <div className="space-y-1">
            {recentSales.map((sale, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-muted-foreground truncate">{sale.title}</p>
                  <p className="text-[9px] text-muted-foreground">{sale.date}</p>
                </div>
                <span className="text-[11px] font-mono font-semibold text-foreground ml-2">
                  {formatPriceForRegion(sale.price, selectedRegion)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ask Button */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <a
          href={`https://wa.me/573208492641?text=${encodeURIComponent(
            t("context.askWhatsAppMessage", { make: auction.make, model: auction.model })
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary/8 border border-primary/15 py-2.5 text-[10px] font-medium tracking-[0.1em] uppercase text-primary hover:bg-primary/15 hover:border-primary/30 transition-all"
        >
          <Scale className="size-3" />
          {t("context.askAboutThisCar")}
          <ChevronRight className="size-3" />
        </a>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───
export function DashboardClient({ auctions, liveRegionTotals, liveNowTotal, seriesCounts }: { auctions: Auction[]; liveRegionTotals?: LiveRegionTotals; liveNowTotal?: number; seriesCounts?: Record<string, number> }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { selectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const feedRef = useRef<HTMLDivElement>(null)

  // Filter auctions by region (maps to source platform), then aggregate
  const filteredAuctions = useMemo(() => {
    const regionFiltered = filterAuctionsForRegion(auctions, selectedRegion)
    // Hard requirement: only active listings are ever displayed.
    return regionFiltered.filter(
      a => a.status === "ACTIVE" || a.status === "ENDING_SOON"
    )
  }, [auctions, selectedRegion])

  const liveNowCount = useMemo(() => {
    if (!liveRegionTotals) {
      return filteredAuctions.filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status)).length
    }

    if (!selectedRegion) {
      return liveRegionTotals.all
    }

    return liveRegionTotals[selectedRegion as keyof LiveRegionTotals] ?? liveRegionTotals.all
  }, [filteredAuctions, liveRegionTotals, selectedRegion])

  // Aggregate filtered auctions into brands
  const brands = useMemo(() => aggregateBrands(filteredAuctions, liveNowCount), [filteredAuctions, liveNowCount])

  // Aggregate into Porsche families for the family-based landing scroll
  const porscheFamilies = useMemo(() => aggregateFamilies(filteredAuctions, seriesCounts), [filteredAuctions, seriesCounts])

  // Reset scroll position when region changes
  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0 })
  }, [selectedRegion])

  const safeCurrentIndex = currentIndex >= 0 && currentIndex < brands.length ? currentIndex : 0
  const selectedBrand = brands[safeCurrentIndex] || brands[0]
  // Family-level index for the scroll (bounded to porscheFamilies array)
  const safeFamilyIndex = currentIndex >= 0 && currentIndex < porscheFamilies.length ? currentIndex : 0
  const activeFamily = porscheFamilies[safeFamilyIndex]
  const activeFamilyName = activeFamily?.name

  // Card height = 100vh - 80px
  const getCardHeight = () => typeof window !== "undefined" ? window.innerHeight - 80 : 800

  // Handle scroll snap to update current index (Desktop) — synced with family cards
  useEffect(() => {
    const container = feedRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const slideHeight = getCardHeight()
      const newIndex = Math.round(scrollTop / slideHeight)
      if (newIndex !== safeFamilyIndex && newIndex >= 0 && newIndex < porscheFamilies.length) {
        setCurrentIndex(newIndex)
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [porscheFamilies.length, safeFamilyIndex])

  // Scroll to index when nav is clicked
  const scrollToIndex = (index: number) => {
    const container = feedRef.current
    if (!container) return
    const slideHeight = getCardHeight()
    container.scrollTo({ top: slideHeight * index, behavior: "smooth" })
    setCurrentIndex(index)
  }

  // Scroll to brand by slug (from quick access)
  const scrollToBrand = (brandSlug: string) => {
    const index = brands.findIndex(b => b.slug === brandSlug)
    if (index >= 0) {
      scrollToIndex(index)
    }
  }

  // Scroll to family by name (from sidebar family drill-down)
  // Sidebar uses raw keys like "718", but porscheFamilies uses display names like "718 Cayman/Boxster"
  // Match by slug (raw key, lowercased) or by name as fallback
  const scrollToFamily = (familyName: string) => {
    const slug = familyName.toLowerCase()
    const index = porscheFamilies.findIndex(f => f.slug === slug || f.name === familyName)
    if (index >= 0) {
      scrollToIndex(index)
    }
  }

  if (!selectedBrand) return null

  return (
    <>
      {/* ═══ MOBILE LAYOUT — Vertical Scrollable Feed ═══ */}
      <div className="md:hidden min-h-[100dvh] w-full bg-background pt-14">
        {/* Sticky region pills */}
        <MobileRegionPills />

        {/* Scrollable vertical feed */}
        <div className="pb-24">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60dvh] px-8 text-center">
              <Globe className="size-8 text-muted-foreground mb-3" />
              <p className="text-[14px] text-muted-foreground">{t("mobileFeed.noBrands")}</p>
            </div>
          ) : (
            <>
              {/* Hero: first brand */}
              <MobileHeroBrand brand={brands[0]} />

              {/* Section: All Brands */}
              {brands.length > 1 && (
                <div className="mt-2">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                      {t("mobileFeed.brands")}
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground">{brands.length}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {brands.slice(1).map((brand) => (
                      <MobileBrandRow key={brand.slug} brand={brand} />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Live Auctions */}
              <MobileLiveAuctions auctions={filteredAuctions} totalLiveCount={liveNowCount} />
            </>
          )}
        </div>
      </div>

      {/* ═══ DESKTOP LAYOUT (3-column) ═══ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-background overflow-hidden pt-[80px]">
        {/* 3-COLUMN LAYOUT */}
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">
          {/* COLUMN A: DISCOVERY SIDEBAR (22%) */}
            <DiscoverySidebar
              auctions={filteredAuctions}
              brands={brands}
              onSelectBrand={scrollToBrand}
              onSelectFamily={scrollToFamily}
              activeBrandSlug={selectedBrand?.slug}
              activeFamilyName={activeFamilyName}
              seriesCounts={seriesCounts}
              liveRegionTotals={liveRegionTotals}
            />

          {/* COLUMN B: FAMILY FEED (50%) — scroll through Porsche families */}
          <div
            ref={feedRef}
            className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
            {porscheFamilies.map((family, idx) => (
              <FamilyCard key={family.slug} family={family} index={idx} />
            ))}
          </div>

          {/* COLUMN C: CONTEXT PANEL (28%) — synced with active family in scroll */}
          <div className="h-full overflow-hidden border-l border-primary/8 bg-card">
            {activeFamily ? (
              <FamilyContextPanel
                key={activeFamily.slug}
                family={activeFamily}
                auctions={filteredAuctions}
                allFamilies={porscheFamilies}
              />
            ) : (
              <BrandContextPanel brand={selectedBrand} allBrands={brands} auctions={filteredAuctions} />
            )}
          </div>
        </div>
      </div>
    </>
  )
}
