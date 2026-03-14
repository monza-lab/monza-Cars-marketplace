"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, resolveRegion, convertFromUsd, REGION_CURRENCY, REGIONAL_MARKET_PREMIUM } from "@/lib/regionPricing"
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
// FilterSidebar removed — filters now live only on brand detail pages

// ─── BRAND TYPE ───
type Brand = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  avgTrend: string
  topGrade: string
  representativeImage: string
  representativeCar: string
  categories: string[]
}

type RegionalPricing = {
  currency: "$" | "€" | "£" | "¥"
  low: number
  high: number
}

type FairValueByRegion = {
  US: RegionalPricing
  EU: RegionalPricing
  UK: RegionalPricing
  JP: RegionalPricing
}

type Auction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  currentBid: number
  bidCount: number
  viewCount: number
  watchCount: number
  status: string
  endTime: string
  platform: string
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  mileageUnit: string | null
  location: string | null
  region?: string | null
  description: string | null
  images: string[]
  analysis: {
    bidTargetLow: number | null
    bidTargetHigh: number | null
    confidence: string | null
    investmentGrade: string | null
    appreciationPotential: string | null
    keyStrengths: string[]
    redFlags: string[]
  } | null
  priceHistory: { price: number; timestamp: string }[]
  fairValueByRegion?: FairValueByRegion
  category?: string
}

// ─── PORSCHE FAMILY TYPE (for family-based landing scroll) ───
type PorscheFamily = {
  name: string
  slug: string
  carCount: number
  priceMin: number
  priceMax: number
  yearMin: number
  yearMax: number
  representativeImage: string
  representativeCar: string
  topGrade: string
}

type LiveRegionTotals = {
  all: number
  US: number
  UK: number
  EU: number
  JP: number
}

const platformShort: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "BON",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
}

// ─── UNIVERSAL MOCK DATA ───
// This ensures EVERY car shows rich data in the Context Panel

const mockMarketPulse: Record<string, { title: string; price: number; date: string; platform: string }[]> = {
  McLaren: [
    { title: "1995 McLaren F1", price: 19_800_000, date: "Nov 2025", platform: "RM Sotheby's" },
    { title: "1998 McLaren F1 GTR", price: 12_500_000, date: "Aug 2025", platform: "Gooding" },
    { title: "1994 McLaren F1", price: 18_200_000, date: "Mar 2025", platform: "Bonhams" },
    { title: "1997 McLaren F1", price: 20_500_000, date: "Jan 2025", platform: "RM Sotheby's" },
    { title: "1996 McLaren F1 LM", price: 23_100_000, date: "Oct 2024", platform: "Gooding" },
  ],
  Porsche: [
    { title: "1973 911 Carrera RS 2.7", price: 1_450_000, date: "Oct 2025", platform: "RM Sotheby's" },
    { title: "1973 911 Carrera RS", price: 1_320_000, date: "Jul 2025", platform: "Gooding" },
    { title: "1972 911 2.7 RS", price: 1_180_000, date: "Apr 2025", platform: "BaT" },
    { title: "1974 911 Carrera RS 3.0", price: 1_680_000, date: "Feb 2025", platform: "Bonhams" },
    { title: "1973 911 RS Touring", price: 1_250_000, date: "Dec 2024", platform: "RM Sotheby's" },
  ],
  Ferrari: [
    { title: "1967 275 GTB/4", price: 3_400_000, date: "Dec 2025", platform: "RM Sotheby's" },
    { title: "1966 275 GTB", price: 2_850_000, date: "Sep 2025", platform: "Gooding" },
    { title: "1967 275 GTB/4", price: 3_150_000, date: "Jun 2025", platform: "Bonhams" },
    { title: "1965 275 GTB Long Nose", price: 2_680_000, date: "Mar 2025", platform: "RM Sotheby's" },
    { title: "1968 275 GTB/4 NART", price: 4_200_000, date: "Jan 2025", platform: "Gooding" },
  ],
  Lamborghini: [
    { title: "1971 Miura SV", price: 2_650_000, date: "Nov 2025", platform: "RM Sotheby's" },
    { title: "1972 Miura P400 SV", price: 2_350_000, date: "Aug 2025", platform: "Gooding" },
    { title: "1969 Miura P400 S", price: 1_980_000, date: "May 2025", platform: "Bonhams" },
    { title: "1970 Miura P400 S", price: 2_100_000, date: "Feb 2025", platform: "RM Sotheby's" },
    { title: "1971 Miura SV Jota", price: 3_850_000, date: "Nov 2024", platform: "Gooding" },
  ],
  Nissan: [
    { title: "1999 Skyline GT-R V-Spec", price: 485_000, date: "Dec 2025", platform: "BaT" },
    { title: "2002 Skyline GT-R V-Spec II Nür", price: 520_000, date: "Oct 2025", platform: "C&B" },
    { title: "1999 Skyline GT-R", price: 425_000, date: "Aug 2025", platform: "BaT" },
    { title: "2001 Skyline GT-R M-Spec", price: 495_000, date: "May 2025", platform: "BaT" },
    { title: "2000 Skyline GT-R V-Spec", price: 465_000, date: "Mar 2025", platform: "C&B" },
  ],
  Toyota: [
    { title: "1998 Supra Turbo 6-Speed", price: 185_000, date: "Nov 2025", platform: "BaT" },
    { title: "1994 Supra Turbo", price: 165_000, date: "Sep 2025", platform: "C&B" },
    { title: "1997 Supra Turbo", price: 172_000, date: "Jul 2025", platform: "BaT" },
    { title: "1995 Supra RZ", price: 195_000, date: "Apr 2025", platform: "BaT" },
    { title: "1993 Supra Turbo", price: 158_000, date: "Feb 2025", platform: "C&B" },
  ],
  BMW: [
    { title: "1990 M3 Sport Evolution", price: 285_000, date: "Nov 2025", platform: "RM Sotheby's" },
    { title: "1988 M3", price: 145_000, date: "Sep 2025", platform: "BaT" },
    { title: "2003 M3 CSL", price: 225_000, date: "Jul 2025", platform: "C&B" },
    { title: "1989 M3 Cecotto", price: 195_000, date: "Apr 2025", platform: "Bonhams" },
    { title: "1991 M3", price: 125_000, date: "Feb 2025", platform: "BaT" },
  ],
  Mercedes: [
    { title: "1955 300SL Gullwing", price: 1_650_000, date: "Dec 2025", platform: "RM Sotheby's" },
    { title: "1957 300SL Roadster", price: 1_450_000, date: "Oct 2025", platform: "Gooding" },
    { title: "1971 280SE 3.5 Cabriolet", price: 425_000, date: "Aug 2025", platform: "BaT" },
    { title: "1956 300SL Gullwing", price: 1_580_000, date: "May 2025", platform: "Bonhams" },
    { title: "1963 300SL Roadster", price: 1_320_000, date: "Mar 2025", platform: "RM Sotheby's" },
  ],
  "Aston Martin": [
    { title: "1964 DB5", price: 1_150_000, date: "Dec 2025", platform: "RM Sotheby's" },
    { title: "1967 DB6 Volante", price: 980_000, date: "Oct 2025", platform: "Gooding" },
    { title: "1965 DB5", price: 1_080_000, date: "Jul 2025", platform: "Bonhams" },
    { title: "2011 One-77", price: 2_850_000, date: "Apr 2025", platform: "RM Sotheby's" },
    { title: "1963 DB4 GT", price: 3_200_000, date: "Feb 2025", platform: "Gooding" },
  ],
  Mazda: [
    { title: "1995 RX-7 Spirit R", price: 128_000, date: "Dec 2025", platform: "BaT" },
    { title: "1993 RX-7 R1", price: 85_000, date: "Oct 2025", platform: "C&B" },
    { title: "1994 RX-7 Touring", price: 72_000, date: "Aug 2025", platform: "BaT" },
    { title: "1995 RX-7 Type RZ", price: 145_000, date: "May 2025", platform: "BaT" },
    { title: "1992 RX-7", price: 58_000, date: "Mar 2025", platform: "C&B" },
  ],
  Honda: [
    { title: "2009 S2000 CR", price: 92_000, date: "Dec 2025", platform: "BaT" },
    { title: "2008 S2000 CR", price: 85_000, date: "Oct 2025", platform: "C&B" },
    { title: "2006 S2000", price: 48_000, date: "Aug 2025", platform: "BaT" },
    { title: "2009 S2000 CR", price: 98_000, date: "May 2025", platform: "BaT" },
    { title: "2004 S2000", price: 42_000, date: "Mar 2025", platform: "C&B" },
  ],
  Shelby: [
    { title: "1966 Cobra 427 S/C", price: 2_450_000, date: "Dec 2025", platform: "RM Sotheby's" },
    { title: "1965 Cobra 427", price: 2_150_000, date: "Sep 2025", platform: "Gooding" },
    { title: "1967 GT500", price: 285_000, date: "Jul 2025", platform: "BaT" },
    { title: "1966 Cobra 289", price: 1_250_000, date: "Apr 2025", platform: "Bonhams" },
    { title: "1965 Cobra 427", price: 2_350_000, date: "Feb 2025", platform: "RM Sotheby's" },
  ],
  Chevrolet: [
    { title: "1967 Corvette 427/435", price: 198_000, date: "Dec 2025", platform: "BaT" },
    { title: "1963 Corvette Split Window", price: 185_000, date: "Oct 2025", platform: "Gooding" },
    { title: "1967 Corvette L88", price: 3_200_000, date: "Aug 2025", platform: "RM Sotheby's" },
    { title: "1966 Corvette 427", price: 145_000, date: "May 2025", platform: "BaT" },
    { title: "1965 Corvette Fuelie", price: 165_000, date: "Mar 2025", platform: "Bonhams" },
  ],
  Bugatti: [
    { title: "1994 EB110 GT", price: 2_950_000, date: "Dec 2025", platform: "RM Sotheby's" },
    { title: "1993 EB110 GT", price: 2_650_000, date: "Sep 2025", platform: "Gooding" },
    { title: "1995 EB110 SS", price: 3_800_000, date: "Jun 2025", platform: "Bonhams" },
    { title: "1994 EB110 GT", price: 2_480_000, date: "Mar 2025", platform: "RM Sotheby's" },
    { title: "1992 EB110 GT Prototype", price: 4_200_000, date: "Jan 2025", platform: "Gooding" },
  ],
  Lancia: [
    { title: "1974 Stratos HF Stradale", price: 685_000, date: "Dec 2025", platform: "RM Sotheby's" },
    { title: "1975 Stratos HF", price: 620_000, date: "Sep 2025", platform: "Gooding" },
    { title: "1973 Stratos Stradale", price: 595_000, date: "Jun 2025", platform: "Bonhams" },
    { title: "1976 Stratos Group 4", price: 1_450_000, date: "Mar 2025", platform: "RM Sotheby's" },
    { title: "1974 Stratos HF", price: 650_000, date: "Jan 2025", platform: "Gooding" },
  ],
  "De Tomaso": [
    { title: "1970 Mangusta", price: 295_000, date: "Dec 2025", platform: "BaT" },
    { title: "1969 Mangusta", price: 275_000, date: "Oct 2025", platform: "Gooding" },
    { title: "1971 Pantera", price: 185_000, date: "Aug 2025", platform: "BaT" },
    { title: "1968 Mangusta", price: 265_000, date: "May 2025", platform: "Bonhams" },
    { title: "1972 Pantera GTS", price: 225_000, date: "Mar 2025", platform: "BaT" },
  ],
  Alpine: [
    { title: "1973 A110 1600S", price: 195_000, date: "Dec 2025", platform: "Bonhams" },
    { title: "1971 A110 1600S", price: 178_000, date: "Oct 2025", platform: "RM Sotheby's" },
    { title: "1974 A110 1600S", price: 168_000, date: "Aug 2025", platform: "Gooding" },
    { title: "1972 A110 Berlinette", price: 155_000, date: "May 2025", platform: "Bonhams" },
    { title: "1973 A110 1300", price: 125_000, date: "Mar 2025", platform: "BaT" },
  ],
  default: [
    { title: "Similar Model (Recent)", price: 125_000, date: "Nov 2025", platform: "BaT" },
    { title: "Similar Model (Mid-Year)", price: 118_000, date: "Jul 2025", platform: "C&B" },
    { title: "Similar Model (Earlier)", price: 112_000, date: "Mar 2025", platform: "BaT" },
    { title: "Comparable Vehicle", price: 108_000, date: "Jan 2025", platform: "BaT" },
    { title: "Market Reference", price: 105_000, date: "Nov 2024", platform: "C&B" },
  ],
}

const mockWhyBuy: Record<string, string> = {
  McLaren: "The McLaren F1 represents the pinnacle of analog supercar engineering. Extreme scarcity with only 64 road cars ensures lasting collector interest and consistent auction presence.",
  Porsche: "The 911 Carrera RS 2.7 is the foundation of Porsche's motorsport legacy. As the first homologation special, it carries historical significance that transcends typical collector car metrics. Strong club support and cross-generational appeal make this a cornerstone holding.",
  Ferrari: "Ferrari's timeless design combined with the legendary Colombo V12 creates an investment-grade asset. Classiche certification ensures authenticity. This model has demonstrated remarkable price stability even during market corrections.",
  Lamborghini: "Lamborghini's first true supercar remains the most desirable variant. Polo Storico certification adds provenance value. The mid-engine layout influenced every supercar that followed, cementing its historical importance.",
  Nissan: "The R34 GT-R represents the peak of Japanese engineering excellence. With 25-year import eligibility now active in the US, demand continues to grow as 25-year import eligibility expands the collector base. Low production numbers and strong enthusiast community support lasting value.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by pop culture prominence and bulletproof 2JZ reliability. Clean, stock examples are increasingly rare as many were modified. Turbo 6-speed variants command significant premiums.",
  BMW: "The E30 M3 is widely regarded as the quintessential driver's car. Motorsport heritage and timeless design ensure lasting desirability. Sport Evolution and lightweight variants show strongest collector demand.",
  Mercedes: "Mercedes-Benz classics combine engineering excellence with timeless elegance. Strong parts availability and active restoration community support long-term ownership. Coupe and Cabriolet variants show strongest appreciation.",
  "Aston Martin": "The quintessential British grand tourer. James Bond association ensures global recognition. Strong club support and active restoration community. DB-series cars show consistent appreciation and strong auction presence.",
  Jaguar: "British elegance meets Le Mans-winning pedigree. The XJ220 was underappreciated for decades but collector interest is growing as the market recognizes its engineering significance.",
  Mazda: "The RX-7 FD represents the pinnacle of rotary engine development. Spirit R editions are especially collectible. As the final true rotary sports car, scarcity supports strong collector value.",
  Honda: "Honda's engineering excellence shines in the S2000. The F20C/F22C engines are legendary for their 9,000 RPM redline. CR variants command significant premiums for their track-focused specification.",
  Shelby: "Carroll Shelby's Cobra is the ultimate American sports car legend. 427 examples represent the pinnacle of analog performance. CSX-documented cars command top dollar at auction.",
  Chevrolet: "The C2 Corvette Stingray is America's sports car at its most beautiful. Big block variants with manual transmissions are the collector's choice. Strong club support ensures lasting value.",
  Bugatti: "The EB110 represents Bugatti's modern renaissance. Quad-turbo V12, carbon chassis, and AWD were revolutionary for 1991. With only 139 built, scarcity drives strong appreciation.",
  Lancia: "The Stratos is the most successful rally car ever, dominating World Rally Championship from 1974-1976. Ferrari Dino V6 power and Bertone design ensure eternal collector appeal.",
  "De Tomaso": "Italian design meets American V8 power. The Mangusta's Giugiaro styling and rare production numbers make it an undervalued blue chip. Recognition is growing among serious collectors.",
  Alpine: "The A110 is France's answer to the Porsche 911. Lightweight, agile, and proven in competition. The 1600S is the ultimate road specification. Values rising as recognition spreads globally.",
  default: "This vehicle represents a compelling opportunity in the collector car market. Strong fundamentals, limited production, and growing collector interest suggest strong collector market presence.",
}

// Default analysis for cars without DB analysis
const mockAnalysis: Record<string, { grade: string; trend: string; lowRange: number; highRange: number }> = {
  McLaren: { grade: "AAA", trend: "Premium Demand", lowRange: 15_500_000, highRange: 18_000_000 },
  Porsche: { grade: "AA", trend: "Strong Demand", lowRange: 1_100_000, highRange: 1_400_000 },
  Ferrari: { grade: "AAA", trend: "Premium Demand", lowRange: 2_800_000, highRange: 3_400_000 },
  Lamborghini: { grade: "AA", trend: "Growing Demand", lowRange: 1_900_000, highRange: 2_500_000 },
  Nissan: { grade: "A", trend: "High Demand", lowRange: 380_000, highRange: 520_000 },
  Toyota: { grade: "A", trend: "Growing Demand", lowRange: 145_000, highRange: 190_000 },
  BMW: { grade: "AA", trend: "Strong Demand", lowRange: 550_000, highRange: 750_000 },
  Mercedes: { grade: "AA", trend: "Steady Demand", lowRange: 350_000, highRange: 500_000 },
  "Aston Martin": { grade: "AA", trend: "Steady Demand", lowRange: 400_000, highRange: 550_000 },
  Jaguar: { grade: "AA", trend: "Growing Demand", lowRange: 480_000, highRange: 650_000 },
  Mazda: { grade: "AA", trend: "High Demand", lowRange: 95_000, highRange: 140_000 },
  Honda: { grade: "A", trend: "Growing Demand", lowRange: 68_000, highRange: 95_000 },
  Shelby: { grade: "AAA", trend: "Premium Demand", lowRange: 1_900_000, highRange: 2_400_000 },
  Chevrolet: { grade: "AA", trend: "Steady Demand", lowRange: 165_000, highRange: 220_000 },
  Bugatti: { grade: "AAA", trend: "Premium Demand", lowRange: 2_500_000, highRange: 3_200_000 },
  Lancia: { grade: "AAA", trend: "Premium Demand", lowRange: 550_000, highRange: 700_000 },
  "De Tomaso": { grade: "A", trend: "Growing Demand", lowRange: 240_000, highRange: 310_000 },
  Alpine: { grade: "A", trend: "Growing Demand", lowRange: 155_000, highRange: 205_000 },
  default: { grade: "B+", trend: "Active Market", lowRange: 80_000, highRange: 150_000 },
}

// ─── PRICE RANGE FILTERS ───
const priceRanges = [
  { id: "all", label: "All", min: 0, max: Infinity },
  { id: "under200k", label: "< $200K", min: 0, max: 200_000 },
  { id: "200k-500k", label: "$200K–500K", min: 200_000, max: 500_000 },
  { id: "500k-1m", label: "$500K–1M", min: 500_000, max: 1_000_000 },
  { id: "1m-3m", label: "$1M–3M", min: 1_000_000, max: 3_000_000 },
  { id: "3m+", label: "$3M+", min: 3_000_000, max: Infinity },
]

// ─── TOP BRANDS ───
const topBrands = ["Ferrari", "Porsche", "Lamborghini", "McLaren", "Aston Martin"]

// ─── OWNERSHIP COST ESTIMATES (annual) ───
const mockOwnershipCost: Record<string, { insurance: number; storage: number; maintenance: number }> = {
  McLaren: { insurance: 45000, storage: 12000, maintenance: 25000 },
  Porsche: { insurance: 8500, storage: 6000, maintenance: 8000 },
  Ferrari: { insurance: 18000, storage: 8000, maintenance: 15000 },
  Lamborghini: { insurance: 15000, storage: 8000, maintenance: 12000 },
  Nissan: { insurance: 4500, storage: 3600, maintenance: 3500 },
  Toyota: { insurance: 3200, storage: 3600, maintenance: 2500 },
  BMW: { insurance: 3800, storage: 3600, maintenance: 4000 },
  Mercedes: { insurance: 6500, storage: 4800, maintenance: 6000 },
  "Aston Martin": { insurance: 8000, storage: 6000, maintenance: 10000 },
  Lexus: { insurance: 6000, storage: 4800, maintenance: 4500 },
  Ford: { insurance: 5500, storage: 4200, maintenance: 4000 },
  Acura: { insurance: 3000, storage: 3600, maintenance: 2800 },
  Jaguar: { insurance: 4500, storage: 4200, maintenance: 5000 },
  default: { insurance: 5000, storage: 4800, maintenance: 5000 },
}

// ─── REGIONAL VALUATION ───
type RegionalValuation = { start: number; current: number; symbol: string; usdCurrent: number }

const REGION_FLAGS: Record<string, string> = { US: "\u{1F1FA}\u{1F1F8}", UK: "\u{1F1EC}\u{1F1E7}", EU: "\u{1F1EA}\u{1F1FA}", JP: "\u{1F1EF}\u{1F1F5}" }

const REGION_LABEL_KEYS = {
  US: "brandContext.regionUS",
  UK: "brandContext.regionUK",
  EU: "brandContext.regionEU",
  JP: "brandContext.regionJP",
} as const

function formatRegionalVal(v: number, symbol: string) {
  if (symbol === "¥") return `¥${Math.round(v)}M`
  if (v >= 1) {
    const s = v.toFixed(1)
    return s.endsWith(".0") ? `${symbol}${v.toFixed(0)}M` : `${symbol}${s}M`
  }
  const k = Math.round(v * 1000)
  return `${symbol}${k.toLocaleString()}K`
}

function formatUsdEquiv(v: number) {
  if (v >= 1) {
    const s = v.toFixed(1)
    return s.endsWith(".0") ? `$${v.toFixed(0)}M` : `$${s}M`
  }
  return `$${Math.round(v * 1000).toLocaleString()}K`
}

// ─── TOP MODELS PER BRAND (mock) ───
type TopModel = { name: string; avgPrice: number; grade: string; trend: string }
const mockTopModels: Record<string, TopModel[]> = {
  Ferrari: [{ name: "250 GTO", avgPrice: 48_400_000, grade: "AAA", trend: "Premium" }, { name: "F40", avgPrice: 2_800_000, grade: "AAA", trend: "Premium" }, { name: "275 GTB/4", avgPrice: 3_200_000, grade: "AA", trend: "Strong" }, { name: "Testarossa", avgPrice: 380_000, grade: "A", trend: "High" }],
  Porsche: [{ name: "959", avgPrice: 2_100_000, grade: "AAA", trend: "Premium" }, { name: "911 RS 2.7", avgPrice: 1_450_000, grade: "AA", trend: "Strong" }, { name: "356 Speedster", avgPrice: 680_000, grade: "AA", trend: "Steady" }, { name: "911 GT1", avgPrice: 5_200_000, grade: "AAA", trend: "Premium" }],
  McLaren: [{ name: "F1", avgPrice: 19_800_000, grade: "AAA", trend: "Premium" }, { name: "F1 GTR", avgPrice: 12_500_000, grade: "AAA", trend: "Premium" }, { name: "F1 LM", avgPrice: 23_100_000, grade: "AAA", trend: "Premium" }],
  Lamborghini: [{ name: "Miura SV", avgPrice: 2_650_000, grade: "AAA", trend: "Premium" }, { name: "Countach LP400", avgPrice: 1_200_000, grade: "AA", trend: "Strong" }, { name: "Diablo GT", avgPrice: 850_000, grade: "A", trend: "High" }],
  BMW: [{ name: "M3 E30 Evo", avgPrice: 285_000, grade: "AA", trend: "Strong" }, { name: "M1", avgPrice: 680_000, grade: "AAA", trend: "Strong" }, { name: "M3 CSL E46", avgPrice: 225_000, grade: "AA", trend: "Strong" }],
  Mercedes: [{ name: "300SL Gullwing", avgPrice: 1_650_000, grade: "AAA", trend: "Steady" }, { name: "300SL Roadster", avgPrice: 1_320_000, grade: "AA", trend: "Steady" }, { name: "CLK GTR", avgPrice: 4_500_000, grade: "AAA", trend: "Premium" }],
  Nissan: [{ name: "R34 GT-R V-Spec", avgPrice: 485_000, grade: "AA", trend: "High" }, { name: "R34 GT-R Nur", avgPrice: 520_000, grade: "AA", trend: "High" }, { name: "R32 GT-R", avgPrice: 145_000, grade: "A", trend: "High" }],
  Toyota: [{ name: "Supra Turbo 6-Spd", avgPrice: 185_000, grade: "A", trend: "High" }, { name: "2000GT", avgPrice: 1_100_000, grade: "AAA", trend: "Strong" }, { name: "Supra RZ", avgPrice: 195_000, grade: "A", trend: "High" }],
  default: [{ name: "Top Variant", avgPrice: 150_000, grade: "A", trend: "Strong" }, { name: "Standard", avgPrice: 85_000, grade: "B+", trend: "Steady" }],
}

// ─── LIQUIDITY & MARKET DEPTH (mock) ───
type MarketDepth = { auctionsPerYear: number; avgDaysToSell: number; sellThroughRate: number; demandScore: number }
const mockMarketDepth: Record<string, MarketDepth> = {
  Ferrari: { auctionsPerYear: 48, avgDaysToSell: 14, sellThroughRate: 92, demandScore: 9 },
  Porsche: { auctionsPerYear: 62, avgDaysToSell: 12, sellThroughRate: 89, demandScore: 9 },
  McLaren: { auctionsPerYear: 8, avgDaysToSell: 28, sellThroughRate: 85, demandScore: 7 },
  Lamborghini: { auctionsPerYear: 24, avgDaysToSell: 18, sellThroughRate: 88, demandScore: 8 },
  Nissan: { auctionsPerYear: 35, avgDaysToSell: 10, sellThroughRate: 94, demandScore: 9 },
  Toyota: { auctionsPerYear: 28, avgDaysToSell: 8, sellThroughRate: 96, demandScore: 8 },
  BMW: { auctionsPerYear: 32, avgDaysToSell: 15, sellThroughRate: 87, demandScore: 7 },
  Mercedes: { auctionsPerYear: 22, avgDaysToSell: 22, sellThroughRate: 82, demandScore: 7 },
  "Aston Martin": { auctionsPerYear: 18, avgDaysToSell: 25, sellThroughRate: 80, demandScore: 6 },
  Shelby: { auctionsPerYear: 12, avgDaysToSell: 20, sellThroughRate: 90, demandScore: 8 },
  Bugatti: { auctionsPerYear: 6, avgDaysToSell: 35, sellThroughRate: 78, demandScore: 7 },
  default: { auctionsPerYear: 15, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 6 },
}

// ─── AGGREGATE AUCTIONS BY BRAND ───
function aggregateBrands(auctions: Auction[], dbTotalOverride?: number): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  // Group by make
  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
      const existing = brandMap.get(auction.make) || []
      existing.push(auction)
      brandMap.set(auction.make, existing)
    })

  // Convert to Brand array with stats
  const brands: Brand[] = []
  brandMap.forEach((cars, name) => {
    const prices = cars.map(c => c.currentBid)
    const grades = cars.map(c => c.analysis?.investmentGrade || "B+")
    const categories = [...new Set(cars.map(c => c.category).filter(Boolean))]

    // Find best grade
    const gradeOrder = ["AAA", "AA", "A", "B+", "B", "C"]
    const topGrade = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]

    // Get the MOST EXPENSIVE car for the representative image
    const mostExpensiveCar = cars.reduce((max, car) => 
      car.currentBid > max.currentBid ? car : max
    , cars[0])
    
    // Use the actual car's image from database, fall back to static brand image only if needed
    const carImage = mostExpensiveCar.images?.[0]
    const verifiedBrandImage = getBrandImage(name)
    const representativeImage = carImage || verifiedBrandImage || ""

    // Use DB aggregate count when available and there's a single brand (e.g. Porsche-only dashboard).
    // This shows the true DB total instead of the capped fetched sample.
    const count = (dbTotalOverride && brandMap.size === 1) ? dbTotalOverride : cars.length

    brands.push({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      carCount: count,
      priceMin: Math.min(...prices),
      priceMax: Math.max(...prices),
      avgTrend: mockAnalysis[name]?.trend || mockAnalysis["default"].trend,
      topGrade,
      representativeImage,
      representativeCar: `${mostExpensiveCar.year} ${mostExpensiveCar.make} ${mostExpensiveCar.model}`,
      categories: categories as string[],
    })
  })

  // Sort: Ferrari first (live data showcase), then by max price descending
  return brands.sort((a, b) => {
    if (a.name === "Ferrari" && b.name !== "Ferrari") return -1
    if (b.name === "Ferrari" && a.name !== "Ferrari") return 1
    return b.priceMax - a.priceMax
  })
}

// ─── AGGREGATE AUCTIONS BY PORSCHE FAMILY (for family-based landing) ───
function getFamilyPrestigeOrder(familyKey: string): number {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.order ?? 99
}

function getFamilyDisplayName(familyKey: string): string {
  const config = getSeriesConfig(familyKey.toLowerCase(), "Porsche")
  return config?.label || familyKey
}

function aggregateFamilies(auctions: Auction[], dbSeriesCounts?: Record<string, number>): PorscheFamily[] {
  const familyMap = new Map<string, Auction[]>()

  auctions
    .filter(a => a.status === "ACTIVE" || a.status === "ENDING_SOON")
    .forEach(auction => {
    const family = extractSeries(auction.model, auction.year, auction.make || "Porsche")
    const existing = familyMap.get(family) || []
    existing.push(auction)
    familyMap.set(family, existing)
  })

  const families: PorscheFamily[] = []
  familyMap.forEach((cars, familyKey) => {
    const prices = cars.map(c => c.currentBid).filter(p => p > 0)
    const years = cars.map(c => c.year)
    const grades = cars.map(c => c.analysis?.investmentGrade || "B+")
    const gradeOrder = ["AAA", "AA", "A", "B+", "B", "C"]
    const topGrade = grades.sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b))[0]

    const bestCar = cars.reduce((max, car) => car.currentBid > max.currentBid ? car : max, cars[0])
    const carImage = bestCar.images?.[0]
    const modelImage = getModelImage("Porsche", bestCar.model)
    const fallbackImage = getModelImage("Porsche", familyKey) || getBrandImage("Porsche") || ""

    // Use exact DB series count if available, otherwise fall back to sample count
    const carCount = dbSeriesCounts?.[familyKey] ?? cars.length

    families.push({
      name: getFamilyDisplayName(familyKey),
      slug: familyKey.toLowerCase(),
      carCount,
      priceMin: prices.length > 0 ? Math.min(...prices) : 0,
      priceMax: prices.length > 0 ? Math.max(...prices) : 0,
      yearMin: Math.min(...years),
      yearMax: Math.max(...years),
      representativeImage: carImage || modelImage || fallbackImage,
      representativeCar: `${bestCar.year} Porsche ${bestCar.model}`,
      topGrade,
    })
  })

  return families.sort((a, b) => {
    const orderA = getFamilyPrestigeOrder(a.slug)
    const orderB = getFamilyPrestigeOrder(b.slug)
    if (orderA !== orderB) return orderA - orderB
    return b.carCount - a.carCount
  })
}

function timeLeft(
  endTime: string,
  labels: { ended: string; day: string; hour: string; minute: string }
) {
  const diff = new Date(endTime).getTime() - Date.now()
  if (diff <= 0) return labels.ended
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}${labels.day} ${hrs}${labels.hour}`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}${labels.hour} ${mins}${labels.minute}`
}

// ─── SAFE IMAGE: renders fallback when the URL exists but fails to load ───
function SafeImage({
  src,
  alt,
  fallback,
  ...props
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode }) {
  const [hasError, setHasError] = useState(false)
  if (hasError || !src) return <>{fallback}</>
  return (
    <Image
      src={src}
      alt={alt}
      onError={() => setHasError(true)}
      {...props}
    />
  )
}

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

// ─── FAMILY CARD (full-screen scroll card for Porsche families) ───
function FamilyCard({ family, index = 0 }: { family: PorscheFamily; index?: number }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-card border border-border group cursor-pointer hover:border-primary/20 transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          <SafeImage
            src={family.representativeImage}
            alt={family.name}
            fill
            className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
            sizes="50vw"
            priority={index === 0}
            loading={index === 0 ? "eager" : "lazy"}
            referrerPolicy="no-referrer"
            unoptimized
            fallback={
              <div className="absolute inset-0 bg-card flex items-center justify-center">
                <span className="text-muted-foreground text-lg">{family.name}</span>
              </div>
            }
          />

          {/* Vignette */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent dark:from-card pointer-events-none" />

          {/* Car count badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-foreground">
              {family.carCount} {family.carCount === 1 ? "car" : "cars"}
            </span>
          </div>

          {/* Grade badge */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              family.topGrade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : family.topGrade === "AA"
                ? "bg-primary/30 text-primary"
                : "bg-foreground/20 text-white"
            }`}>
              {family.topGrade}
            </span>
          </div>
        </div>

        {/* BOTTOM: FAMILY INFO */}
        <div className="flex-1 w-full bg-card p-6 flex flex-col justify-between">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
              Porsche
            </p>
            <h2 className="text-3xl font-bold text-foreground tracking-tight group-hover:text-primary transition-colors">
              {family.name}
            </h2>
            <p className="text-[13px] text-muted-foreground mt-1">
              {family.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.priceRange")}</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">
                {formatPriceForRegion(family.priceMin, selectedRegion)}–{formatPriceForRegion(family.priceMax, selectedRegion)}
              </p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Calendar className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">Years</span>
              </div>
              <p className="text-[13px] font-mono text-foreground">{yearLabel}</p>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-muted-foreground">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-foreground">{family.carCount} listings</p>
            </div>
          </div>

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-muted-foreground group-hover:text-primary transition-colors">
              Explore {family.name}
            </span>
            <ChevronRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── MOBILE: REGION PILLS (sticky) ───
function MobileRegionPills() {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const REGIONS = [
    { id: "all", label: t("sidebar.allRegions"), flag: "\u{1F30D}" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-background/95 backdrop-blur-md border-b border-border px-4 py-2.5">
      <div className="flex items-center gap-1">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-primary/15 text-primary border border-primary/25"
                  : "text-muted-foreground hover:text-muted-foreground bg-foreground/3 border border-transparent"
              }`}
            >
              <span className="text-[12px]">{region.flag}</span>
              <span>{region.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ─── MOBILE: HERO BRAND (first brand) ───
function MobileHeroBrand({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  return (
    <Link href={`/cars/${brand.slug}`} className="block relative">
      {/* Hero image */}
      <div className="relative h-[45dvh] w-full overflow-hidden">
        <SafeImage
          src={brand.representativeImage}
          alt={brand.name}
          fill
          className="object-cover object-center"
          sizes="100vw"
          priority
          referrerPolicy="no-referrer"
          unoptimized
          fallback={
            <div className="absolute inset-0 bg-card flex items-center justify-center">
              <span className="text-muted-foreground text-2xl font-bold">{brand.name}</span>
            </div>
          }
        />

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/15 to-transparent dark:from-background dark:via-background/30 pointer-events-none" />

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

        {/* Car count */}
        <div className="absolute top-4 right-4">
          <span className="rounded-full bg-background/70 backdrop-blur-md px-3 py-1.5 text-[10px] font-medium text-foreground">
            {t("brandCard.carsCount", { count: brand.carCount })}
          </span>
        </div>

        {/* Overlaid info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <h2 className="text-3xl font-bold text-foreground tracking-tight">
            {brand.name}
          </h2>
          <p className="text-[13px] text-[rgba(232,226,222,0.5)] mt-0.5">
            {brand.representativeCar}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-display font-medium text-primary">
              {formatPriceForRegion(brand.priceMin, selectedRegion)} – {formatPriceForRegion(brand.priceMax, selectedRegion)}
            </span>
            <span className="text-[12px] text-positive font-medium">{brand.avgTrend}</span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {brand.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full bg-foreground/10 backdrop-blur-sm text-[10px] text-foreground/70"
              >
                {cat}
              </span>
            ))}
          </div>
          {/* Inline CTA */}
          <div className="flex items-center gap-1.5 mt-3 text-primary">
            <span className="text-[12px] font-semibold tracking-[0.1em] uppercase">
              {t("mobileFeed.viewCollection")}
            </span>
            <ChevronRight className="size-4" />
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── MOBILE: BRAND ROW (compact) ───
function MobileBrandRow({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  return (
    <Link
      href={`/cars/${brand.slug}`}
      className="flex items-center gap-4 px-4 py-3.5 active:bg-foreground/3 transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-card">
        <SafeImage
          src={brand.representativeImage}
          alt={brand.name}
          fill
          className="object-cover"
          sizes="80px"
          loading="lazy"
          referrerPolicy="no-referrer"
          unoptimized
          fallback={
            <div className="absolute inset-0 flex items-center justify-center">
              <Car className="size-5 text-muted-foreground" />
            </div>
          }
        />
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-foreground truncate">
          {brand.name}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          {t("mobileFeed.vehicles", { count: brand.carCount })}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-mono text-primary">
            {formatPriceForRegion(brand.priceMin, selectedRegion)} – {formatPriceForRegion(brand.priceMax, selectedRegion)}
          </span>
          <span className="text-[10px] text-positive font-medium">{brand.avgTrend}</span>
        </div>
      </div>

      {/* Right side */}
      <div className="flex flex-col items-end gap-1.5 shrink-0">
        <span className={`text-[10px] font-bold ${
          brand.topGrade === "AAA"
            ? "text-emerald-400"
            : brand.topGrade === "AA"
              ? "text-primary"
              : "text-muted-foreground"
        }`}>
          {brand.topGrade}
        </span>
        <ChevronRight className="size-4 text-muted-foreground" />
      </div>
    </Link>
  )
}

// ─── MOBILE: LIVE AUCTIONS SECTION ───
function MobileLiveAuctions({ auctions, totalLiveCount }: { auctions: Auction[]; totalLiveCount: number }) {
  const t = useTranslations("dashboard")
  const tAuction = useTranslations("auctionDetail")
  const { selectedRegion } = useRegion()

  const timeLabels = {
    ended: t("asset.ended"),
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }

  const liveAuctions = useMemo(() => {
    const now = Date.now()
    return auctions
      .filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status) && new Date(a.endTime).getTime() > now)
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 8)
  }, [auctions])

  if (liveAuctions.length === 0) return null

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
          {t("mobileFeed.liveAuctions")}
        </span>
        <span className="text-[10px] font-display font-medium text-primary">
          {totalLiveCount}
        </span>
      </div>

      {/* Auction rows */}
      <div className="divide-y divide-border">
        {liveAuctions.map((auction) => {
          const isEndingSoon = auction.status === "ENDING_SOON"
          const remaining = timeLeft(auction.endTime, timeLabels)

          return (
            <Link
              key={auction.id}
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-foreground/3 transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-card">
                <SafeImage
                  src={auction.images[0]}
                  alt={auction.title}
                  fill
                  className="object-cover"
                  sizes="64px"
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  unoptimized
                  fallback={
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Car className="size-3.5 text-muted-foreground" />
                    </div>
                  }
                />
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-foreground truncate">
                  {auction.year} {auction.make} {auction.model}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-display font-medium text-primary">
                    {formatPriceForRegion(auction.currentBid, selectedRegion)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    {tAuction("bids.count", { count: auction.bidCount })}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-1 shrink-0">
                <Clock className={`size-3 ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`} />
                <span className={`text-[10px] font-mono font-medium ${
                  isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"
                }`}>
                  {remaining}
                </span>
              </div>
            </Link>
          )
        })}
      </div>
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

// ─── COLUMN A: DISCOVERY SIDEBAR ───
function DiscoverySidebar({
  auctions,
  brands,
  onSelectBrand,
  onSelectFamily,
  activeBrandSlug,
  activeFamilyName,
  seriesCounts,
  liveRegionTotals,
}: {
  auctions: Auction[]
  brands: Brand[]
  onSelectBrand: (brandSlug: string) => void
  onSelectFamily?: (familyName: string) => void
  activeBrandSlug?: string
  activeFamilyName?: string
  seriesCounts?: Record<string, number>
  liveRegionTotals?: LiveRegionTotals
}) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  // Extract model families for the active brand (drill-down navigation)
  const activeBrandFamilies = useMemo(() => {
    if (!activeBrandSlug) return []
    const brandName = brands.find(b => b.slug === activeBrandSlug)?.name
    if (!brandName) return []

    const brandAuctions = auctions.filter(
      a => a.make === brandName &&
           (a.status === "ACTIVE" || a.status === "ENDING_SOON")
    )
    const familyMap = new Map<string, { count: number; years: number[] }>()

    brandAuctions.forEach(a => {
      const series = extractSeries(a.model, a.year, a.make || brandName)
      const existing = familyMap.get(series) || { count: 0, years: [] }
      existing.count++
      existing.years.push(a.year)
      familyMap.set(series, existing)
    })

    // Determine which DB total to use for scaling
    const dbTotal = selectedRegion && liveRegionTotals
      ? (liveRegionTotals[selectedRegion as keyof LiveRegionTotals] ?? liveRegionTotals.all)
      : liveRegionTotals?.all
    const sampleTotal = brandAuctions.length

    return Array.from(familyMap.entries())
      .map(([seriesId, data]) => {
        let count: number
        if (selectedRegion && dbTotal && sampleTotal > 0) {
          // Region selected: scale sample distribution by DB regional total
          count = Math.round(data.count / sampleTotal * dbTotal)
        } else {
          // All regions: use exact DB count from fetchSeriesCounts
          count = seriesCounts?.[seriesId] ?? data.count
        }
        return {
          name: getSeriesConfig(seriesId.toLowerCase(), brandName)?.label || seriesId,
          slug: seriesId.toLowerCase(),
          count,
          yearMin: Math.min(...data.years),
          yearMax: Math.max(...data.years),
        }
      })
      .sort((a, b) => {
        const orderA = getSeriesConfig(a.slug, brandName)?.order ?? 99
        const orderB = getSeriesConfig(b.slug, brandName)?.order ?? 99
        if (orderA !== orderB) return orderA - orderB
        return b.count - a.count
      })
  }, [auctions, activeBrandSlug, brands, seriesCounts, selectedRegion, liveRegionTotals])

  // Live auctions sorted by ending soonest — filtered by active family when scrolling
  const liveAuctions = useMemo(() => {
    const now = Date.now()
    let filtered = auctions.filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status) && new Date(a.endTime).getTime() > now)
    if (activeFamilyName) {
      const familySlug = activeFamilyName.toLowerCase()
      filtered = filtered.filter(a => {
        const series = extractSeries(a.model, a.year, a.make || "Porsche").toLowerCase()
        return series === familySlug
      })
    }
    return filtered.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
  }, [auctions, activeFamilyName])

  // Grade badge color
  const gradeColor = (grade: string) => {
    switch (grade) {
      case "AAA": case "EXCELLENT": return "text-emerald-400"
      case "AA": case "GOOD": return "text-blue-400"
      case "A": case "FAIR": return "text-amber-400"
      default: return "text-muted-foreground"
    }
  }

  const timeLabels = {
    ended: t("asset.ended"),
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }

  return (
    <div className="h-full flex flex-col border-r border-border overflow-hidden">

      {/* ═══ TOP HALF: FIND YOUR CAR ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* Section header */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1.5">
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            {t("sidebar.popular")}
          </span>
          <span className="text-[9px] font-mono text-muted-foreground">
            {t("sidebar.brandsCount", { count: brands.length })}
          </span>
        </div>

        {/* Brands list with inline families (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noResults")}</p>
            </div>
          ) : (
            brands.map((brand) => {
              const isActive = activeBrandSlug === brand.slug
              return (
                <div key={brand.slug}>
                  <button
                    onClick={() => onSelectBrand(brand.slug)}
                    className={`w-full text-left px-4 py-2.5 border-b border-border/50 transition-all group ${
                      isActive
                        ? "bg-primary/6 border-l-2 border-l-primary"
                        : "hover:bg-foreground/2 border-l-2 border-l-transparent"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[12px] font-semibold transition-colors ${
                        isActive ? "text-primary" : "text-foreground group-hover:text-primary"
                      }`}>
                        {brand.name}
                      </span>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-bold ${gradeColor(brand.topGrade)}`}>
                          {brand.topGrade}
                        </span>
                        <span className="text-[10px] text-muted-foreground font-mono">
                          {brand.carCount}
                        </span>
                        <ChevronRight className={`size-3 transition-all ${
                          isActive ? "text-primary rotate-90" : "text-muted-foreground group-hover:text-muted-foreground"
                        }`} />
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5">
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {formatPriceForRegion(brand.priceMin, selectedRegion)} – {formatPriceForRegion(brand.priceMax, selectedRegion)}
                      </span>
                      <span className="text-[9px] text-positive font-medium">
                        {brand.avgTrend}
                      </span>
                    </div>
                  </button>

                  {/* Families drill-down (shown when brand is active) */}
                  {isActive && activeBrandFamilies.length > 0 && (
                    <div className="bg-foreground/2 border-b border-border/50">
                      <div className="px-4 pl-6 py-1.5">
                        <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                          {t("sidebar.families")}
                        </span>
                      </div>
                      {activeBrandFamilies.map((family) => {
                        const familySlug = family.name.toLowerCase()
                        const isFamilyActive = activeFamilyName === family.name || activeFamilyName?.toLowerCase().startsWith(familySlug)
                        return (
                        <button
                          key={family.name}
                          onClick={() => onSelectFamily?.(family.name)}
                          className={`w-full flex items-center justify-between px-4 pl-7 py-2 transition-colors group/fam ${
                            isFamilyActive
                              ? "bg-primary/8 border-l-2 border-l-primary"
                              : "hover:bg-foreground/3 border-l-2 border-l-transparent"
                          }`}
                        >
                          <span className={`text-[11px] font-medium transition-colors ${
                            isFamilyActive ? "text-primary" : "text-muted-foreground group-hover/fam:text-primary"
                          }`}>
                            {family.name}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="text-[9px] font-mono text-primary">
                              {family.count}
                            </span>
                            <span className="text-[8px] text-muted-foreground">
                              {family.yearMin === family.yearMax
                                ? `${family.yearMin}`
                                : `${family.yearMin}–${family.yearMax}`}
                            </span>
                          </div>
                        </button>
                        )
                      })}
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ BOTTOM HALF: LIVE BIDS ═══ */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-border">

        {/* Live header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-card">
          <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-muted-foreground">
            {t("sidebar.liveNow")}
          </span>
          <span className="text-[10px] font-display font-medium text-primary">
            {liveAuctions.length}
          </span>
        </div>

        {/* Live auctions list (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {liveAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-muted-foreground">{t("sidebar.noLiveAuctions")}</p>
            </div>
          ) : (
            liveAuctions.map((auction) => {
              const isEndingSoon = auction.status === "ENDING_SOON"
              const remaining = timeLeft(auction.endTime, timeLabels)

              return (
                <Link
                  key={auction.id}
                  href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
                  className="group relative block px-4 py-2.5 border-b border-border/50 hover:bg-foreground/2 transition-all"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                      <SafeImage
                        src={auction.images[0]}
                        alt={auction.title}
                        fill
                        className="object-cover"
                        sizes="56px"
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        unoptimized
                        fallback={
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Car className="size-3.5 text-muted-foreground" />
                          </div>
                        }
                      />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                        {auction.year} {auction.make} {auction.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12px] font-display font-medium text-primary">
                          {formatPriceForRegion(auction.currentBid, selectedRegion)}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className={`size-2.5 ${isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"}`} />
                          <span className={`text-[9px] font-mono font-medium ${
                            isEndingSoon ? "text-[#FB923C]" : "text-muted-foreground"
                          }`}>
                            {remaining}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-muted-foreground">
                          {platformShort[auction.platform] || auction.platform}
                        </span>
                        {auction.analysis?.investmentGrade && (
                          <span className={`text-[8px] font-bold ${gradeColor(auction.analysis.investmentGrade)}`}>
                            {auction.analysis.investmentGrade}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </Link>
              )
            })
          )}
        </div>
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
            const fallbackAnalysis = mockAnalysis[auction.make] || mockAnalysis["default"]
            const grade = auction.analysis?.investmentGrade || fallbackAnalysis.grade
            const trend = auction.analysis?.appreciationPotential === "APPRECIATING"
              ? fallbackAnalysis.trend
              : auction.analysis?.appreciationPotential === "DECLINING"
              ? "Low Demand"
              : fallbackAnalysis.trend
            const lowRange = auction.analysis?.bidTargetLow || fallbackAnalysis.lowRange
            const highRange = auction.analysis?.bidTargetHigh || fallbackAnalysis.highRange

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
  const fallbackAnalysis = mockAnalysis[auction.make] || mockAnalysis["default"]

  // Fair value range for fallback display
  const lowRange = auction.analysis?.bidTargetLow || fallbackAnalysis.lowRange
  const highRange = auction.analysis?.bidTargetHigh || fallbackAnalysis.highRange

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

// ─── FAMILY CONTEXT PANEL (for Porsche family-based landing) ───
function FamilyContextPanel({ family, auctions, allFamilies }: { family: PorscheFamily; auctions: Auction[]; allFamilies: PorscheFamily[] }) {
  const t = useTranslations("dashboard")
  const { selectedRegion, effectiveRegion } = useRegion()

  const thesis = getSeriesThesis(family.slug, "Porsche") || "A compelling Porsche family with strong collector appeal."

  // Get auctions for this family — all derived data depends on this
  const familyAuctions = useMemo(() => {
    const familyKey = family.slug
    return auctions.filter(a => {
      const series = extractSeries(a.model, a.year, a.make || "Porsche").toLowerCase()
      return series === familyKey
    })
  }, [auctions, family.slug])

  // ─── DYNAMIC: Valuation by Market from real fairValueByRegion data ───
  const regionalVal = useMemo(() => {
    const regions = ["US", "UK", "EU", "JP"] as const
    const result: Record<string, RegionalValuation> = {}
    const symbolMap: Record<string, string> = { US: "$", UK: "£", EU: "€", JP: "¥" }

    // Get average USD price from all family auctions with bids
    const withBids = familyAuctions.filter(a => a.currentBid > 0)
    if (withBids.length === 0) {
      // Return empty fallback when no auction data available
      for (const region of regions) {
        result[region] = { start: 0, current: 0, symbol: symbolMap[region], usdCurrent: 0 }
      }
      return result
    }
    const avgUsd = withBids.reduce((sum, a) => sum + a.currentBid, 0) / withBids.length
    const baseMillions = avgUsd / 1_000_000

    for (const region of regions) {
      const premium = REGIONAL_MARKET_PREMIUM[region] || 1
      const usdWithPremium = baseMillions * premium
      const fxRate = region === "JP" ? (1 / 0.0067) : region === "UK" ? (1 / 1.27) : region === "EU" ? (1 / 1.08) : 1
      result[region] = {
        start: 0,  // No historical data available
        current: usdWithPremium * fxRate,
        symbol: symbolMap[region],
        usdCurrent: usdWithPremium,
      }
    }
    return result
  }, [familyAuctions])

  // ─── DYNAMIC: Market Depth from real auction counts ───
  const depth = useMemo(() => {
    const count = familyAuctions.length
    const withBids = familyAuctions.filter(a => a.currentBid > 0)
    const ended = familyAuctions.filter(a => new Date(a.endTime).getTime() < Date.now())
    const sold = ended.filter(a => a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000) // estimate listing duration
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withBids.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12), // annualize from current listings
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [familyAuctions])

  // ─── DYNAMIC: Ownership Cost scaled by family avg price ───
  const ownershipCost = useMemo(() => {
    const withBids = familyAuctions.filter(a => a.currentBid > 0)
    const avgPrice = withBids.length > 0
      ? withBids.reduce((sum, a) => sum + a.currentBid, 0) / withBids.length
      : (family.priceMin + family.priceMax) / 2
    // Scale: base Porsche costs, adjusted by price tier
    // Under $100K = 0.7x, $100-250K = 1x, $250-500K = 1.3x, $500K+ = 1.6x
    const scale = avgPrice < 100_000 ? 0.7 : avgPrice < 250_000 ? 1.0 : avgPrice < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(8500 * scale),
      storage: Math.round(6000 * scale),
      maintenance: Math.round(8000 * scale),
    }
  }, [familyAuctions, family.priceMin, family.priceMax])

  const totalAnnualCost = ownershipCost.insurance + ownershipCost.storage + ownershipCost.maintenance

  // Top variants: group by model variant name, sorted by avg price
  const topVariants = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[]; grade: string }>()
    familyAuctions.forEach(a => {
      const variant = a.model
      const existing = variantMap.get(variant) || { count: 0, prices: [], grade: "B" }
      existing.count++
      if (a.currentBid > 0) existing.prices.push(a.currentBid)
      const g = a.analysis?.investmentGrade || "B"
      if (["AAA", "AA", "A"].indexOf(g) < ["AAA", "AA", "A"].indexOf(existing.grade)) {
        existing.grade = g
      }
      variantMap.set(variant, existing)
    })

    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => ({
        name,
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
        count: data.count,
        grade: data.grade,
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 5)
  }, [familyAuctions])

  // Recent sales from this family
  const recentSales = useMemo(() => {
    return familyAuctions
      .filter(a => a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: `${a.year} ${a.model}`,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Auction",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [familyAuctions])

  // Similar families (nearby in prestige order)
  const similarFamilies = allFamilies
    .filter(f => f.slug !== family.slug)
    .slice(0, 3)

  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": case "EXCELLENT": return "text-emerald-400"
      case "AA": case "GOOD": return "text-blue-400"
      case "A": case "FAIR": return "text-amber-400"
      default: return "text-muted-foreground"
    }
  }

  const yearLabel = family.yearMin === family.yearMax
    ? `${family.yearMin}`
    : `${family.yearMin}–${family.yearMax}`

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      <div>
        {/* 1. FAMILY OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-primary mb-1">
            Porsche
          </p>
          <h3 className="text-[18px] font-bold text-foreground tracking-tight mb-2">
            {family.name}
          </h3>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {thesis}
          </p>
        </div>

        {/* 2. KEY METRICS */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.grade")}</span>
              <p className={`text-[16px] font-bold ${
                family.topGrade === "AAA" ? "text-positive" : "text-primary"
              }`}>{family.topGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(family.priceMin, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(family.priceMax, selectedRegion)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — all values in user's currency, USD equiv below */}
        <div className="px-5 py-4 border-b border-border">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.valuationByMarket")}
              </span>
            </div>
            <p className="text-[8px] text-muted-foreground mt-1 ml-6">Fair Value by Market</p>
          </div>
          <div className="space-y-1">
            {(["US", "UK", "EU", "JP"] as const).map((region) => {
              const val = regionalVal[region]
              if (!val) return null
              const userCurrency = REGION_CURRENCY[effectiveRegion] || "$"
              const localCurrent = convertFromUsd(val.usdCurrent * 1_000_000, userCurrency) / 1_000_000
              const maxUsdCurrent = Math.max(...Object.values(regionalVal).map(v => v.usdCurrent))
              const barWidth = maxUsdCurrent > 0 ? (val.usdCurrent / maxUsdCurrent) * 100 : 0
              const isSelected = region === effectiveRegion
              return (
                <div key={region} className={`rounded-xl py-2.5 px-3 transition-all ${isSelected ? "bg-primary/6 border border-primary/10" : "border border-transparent"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px]">{REGION_FLAGS[region]}</span>
                    <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{t(REGION_LABEL_KEYS[region])}</span>
                    {isSelected && (
                      <span className="text-[7px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                        {t("brandContext.yourMarket")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className={`text-[13px] font-mono font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {formatRegionalVal(localCurrent, userCurrency)}
                    </span>
                  </div>
                  <div className="h-[4px] rounded-full bg-foreground/4 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${isSelected ? "bg-gradient-to-r from-primary/50 to-primary/80" : "bg-gradient-to-r from-primary/20 to-primary/45"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {formatUsdEquiv(val.usdCurrent)} USD
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. TOP VARIANTS */}
        {topVariants.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <Car className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.topModels")}
              </span>
            </div>
            <div className="space-y-2">
              {topVariants.map((variant) => (
                <div key={variant.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-medium text-foreground truncate block">{variant.name}</span>
                    <span className="text-[9px] text-muted-foreground">{variant.count} listings</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-[11px] font-display font-medium text-primary">
                      {formatPriceForRegion(variant.avgPrice, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${gradeColor(variant.grade)}`}>
                      {variant.grade}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 5. RECENT SALES */}
        {recentSales.length > 0 && (
          <div className="px-5 py-4 border-b border-border">
            <div className="flex items-center gap-2 mb-3">
              <DollarSign className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.recentSales")}
              </span>
            </div>
            <div className="space-y-2">
              {recentSales.map((sale, i) => (
                <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{sale.platform} · {sale.date}</p>
                  </div>
                  <span className="text-[12px] font-mono font-semibold text-foreground shrink-0">
                    {formatPriceForRegion(sale.price, selectedRegion)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.liquidityDepth")}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.auctionsPerYear")}</span>
              <span className="text-[12px] font-mono font-semibold text-foreground">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.avgDaysToSell")}</span>
              <span className="text-[12px] font-mono font-semibold text-foreground">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.sellThroughRate")}</span>
              <span className="text-[12px] font-mono font-semibold text-positive">{depth.sellThroughRate}%</span>
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">{t("brandContext.demandScore")}</span>
                <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${
                      i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.annualOwnership")}
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: t("brandContext.insurance"), value: ownershipCost.insurance },
              { label: t("brandContext.storage"), value: ownershipCost.storage },
              { label: t("brandContext.maintenance"), value: ownershipCost.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
              <span className="text-[11px] font-medium text-foreground">{t("brandContext.total")}</span>
              <span className="text-[12px] font-display font-medium text-primary">{formatPriceForRegion(totalAnnualCost, selectedRegion)}{t("brandContext.perYear")}</span>
            </div>
          </div>
        </div>

        {/* 8. OTHER FAMILIES */}
        {similarFamilies.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                Other Families
              </span>
            </div>
            <div className="space-y-1.5">
              {similarFamilies.map((f) => (
                <Link
                  key={f.slug}
                  href={`/cars/porsche?family=${encodeURIComponent(f.name)}`}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-foreground/3 transition-colors px-1 -mx-1 group"
                >
                  <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {f.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatPriceForRegion(f.priceMin, selectedRegion)}–{formatPriceForRegion(f.priceMax, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${
                      f.topGrade === "AAA" ? "text-positive" : "text-primary"
                    }`}>{f.topGrade}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <Link
          href={`/cars/porsche?family=${encodeURIComponent(family.slug)}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          Explore {family.name} Collection
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── BRAND CONTEXT PANEL ───
function BrandContextPanel({ brand, allBrands, auctions }: { brand: Brand; allBrands: Brand[]; auctions: Auction[] }) {
  const t = useTranslations("dashboard")
  const { selectedRegion, effectiveRegion } = useRegion()
  const brandAuctions = useMemo(() =>
    auctions.filter(a => a.make === brand.name),
    [auctions, brand.name]
  )

  const whyBuy = getBrandConfig(brand.name)?.defaultThesis || mockWhyBuy[brand.name] || mockWhyBuy["default"]
  // Compute regional fair values from brand avg price
  const regionalVal = useMemo(() => {
    const avgUsd = (brand.priceMin + brand.priceMax) / 2
    const baseMillions = avgUsd / 1_000_000
    const symbolMap: Record<string, string> = { US: "$", UK: "£", EU: "€", JP: "¥" }
    const result: Record<string, RegionalValuation> = {}
    for (const region of ["US", "UK", "EU", "JP"] as const) {
      const premium = REGIONAL_MARKET_PREMIUM[region] || 1
      const usdWithPremium = baseMillions * premium
      const fxRate = region === "JP" ? (1 / 0.0067) : region === "UK" ? (1 / 1.27) : region === "EU" ? (1 / 1.08) : 1
      result[region] = {
        start: 0,
        current: usdWithPremium * fxRate,
        symbol: symbolMap[region],
        usdCurrent: usdWithPremium,
      }
    }
    return result
  }, [brand.priceMin, brand.priceMax])
  const recentSales = useMemo(() => {
    return brandAuctions
      .filter(a => a.currentBid > 0)
      .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())
      .slice(0, 5)
      .map(a => ({
        title: \,
        price: a.currentBid,
        platform: a.platform?.replace(/_/g, " ") || "Auction",
        date: new Date(a.endTime).toLocaleDateString("en-US", { month: "short", year: "numeric" }),
      }))
  }, [brandAuctions])
  const ownershipCost = useMemo(() => {
    const config = getBrandConfig(brand.name)
    const base = config?.ownershipCosts ?? { insurance: 8000, storage: 5000, maintenance: 7000 }
    const withBids = brandAuctions.filter(a => a.currentBid > 0)
    const avgPrice = withBids.length > 0
      ? withBids.reduce((sum, a) => sum + a.currentBid, 0) / withBids.length
      : (brand.priceMin + brand.priceMax) / 2
    const scale = avgPrice < 100_000 ? 0.7 : avgPrice < 250_000 ? 1.0 : avgPrice < 500_000 ? 1.3 : 1.6
    return {
      insurance: Math.round(base.insurance * scale),
      storage: Math.round(base.storage * scale),
      maintenance: Math.round(base.maintenance * scale),
    }
  }, [brandAuctions, brand.name, brand.priceMin, brand.priceMax])
  const topModels = useMemo(() => {
    const variantMap = new Map<string, { count: number; prices: number[]; grade: string }>()
    brandAuctions.forEach(a => {
      const variant = a.model
      const existing = variantMap.get(variant) || { count: 0, prices: [], grade: "B" }
      existing.count++
      if (a.currentBid > 0) existing.prices.push(a.currentBid)
      const g = a.analysis?.investmentGrade || "B"
      if (["AAA", "AA", "A"].indexOf(g) < ["AAA", "AA", "A"].indexOf(existing.grade)) {
        existing.grade = g
      }
      variantMap.set(variant, existing)
    })

    return Array.from(variantMap.entries())
      .filter(([, data]) => data.prices.length > 0)
      .map(([name, data]) => ({
        name,
        avgPrice: Math.round(data.prices.reduce((s, p) => s + p, 0) / data.prices.length),
        count: data.count,
        grade: data.grade,
        trend: data.grade === "AAA" ? "Premium" : data.grade === "AA" ? "Strong" : "Stable",
      }))
      .sort((a, b) => b.avgPrice - a.avgPrice)
      .slice(0, 5)
  }, [brandAuctions])
  const depth = useMemo(() => {
    const count = brandAuctions.length
    if (count === 0) {
      const config = getBrandConfig(brand.name)
      return config?.marketDepth ?? { auctionsPerYear: 15, avgDaysToSell: 20, sellThroughRate: 80, demandScore: 6 }
    }
    const withBids = brandAuctions.filter(a => a.currentBid > 0)
    const ended = brandAuctions.filter(a => new Date(a.endTime).getTime() < Date.now())
    const sold = ended.filter(a => a.currentBid > 0)
    const sellThrough = ended.length > 0 ? Math.round((sold.length / ended.length) * 100) : 85
    const avgDays = ended.length > 0
      ? Math.round(ended.reduce((sum, a) => {
          const created = new Date(a.endTime).getTime() - (7 * 86400000)
          return sum + (new Date(a.endTime).getTime() - created) / 86400000
        }, 0) / ended.length)
      : 14
    const demandScore = Math.min(10, Math.max(1, Math.round(
      (count >= 20 ? 3 : count >= 10 ? 2 : 1) +
      (withBids.length / Math.max(count, 1)) * 4 +
      (sellThrough / 100) * 3
    )))
    return {
      auctionsPerYear: Math.max(count * 4, 12),
      avgDaysToSell: avgDays,
      sellThroughRate: sellThrough,
      demandScore,
    }
  }, [brandAuctions, brand.name])

  const totalAnnualCost = ownershipCost.insurance + ownershipCost.storage + ownershipCost.maintenance

  // Similar brands (same grade tier)
  const similarBrands = allBrands
    .filter(b => b.topGrade === brand.topGrade && b.slug !== brand.slug)
    .slice(0, 3)

  // Grade color helper
  const gradeColor = (g: string) => {
    switch (g) {
      case "AAA": case "EXCELLENT": return "text-emerald-400"
      case "AA": case "GOOD": return "text-blue-400"
      case "A": case "FAIR": return "text-amber-400"
      default: return "text-muted-foreground"
    }
  }

  return (
    <div className="h-full flex flex-col overflow-y-auto no-scrollbar">
      {/* BRAND CONTEXT — starts directly with brand overview */}
      <div>
        {/* 1. BRAND OVERVIEW */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {whyBuy}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-border bg-primary/3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.grade")}</span>
              <p className={`text-[16px] font-bold ${
                brand.topGrade === "AAA" ? "text-positive" : "text-primary"
              }`}>{brand.topGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(brand.priceMin, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-muted-foreground uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-foreground">{formatPriceForRegion(brand.priceMax, selectedRegion)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — all values in user's currency, USD equiv below */}
        <div className="px-5 py-4 border-b border-border">
          <div className="mb-4">
            <div className="flex items-center gap-2">
              <Globe className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.valuationByMarket")}
              </span>
            </div>
            <p className="text-[8px] text-muted-foreground mt-1 ml-6">Fair Value by Market</p>
          </div>
          <div className="space-y-1">
            {(["US", "UK", "EU", "JP"] as const).map((region) => {
              const val = regionalVal[region]
              if (!val) return null
              const userCurrency = REGION_CURRENCY[effectiveRegion] || "$"
              const localCurrent = convertFromUsd(val.usdCurrent * 1_000_000, userCurrency) / 1_000_000
              const maxUsdCurrent = Math.max(...Object.values(regionalVal).map(v => v.usdCurrent))
              const barWidth = maxUsdCurrent > 0 ? (val.usdCurrent / maxUsdCurrent) * 100 : 0
              const isSelected = region === effectiveRegion
              return (
                <div key={region} className={`rounded-xl py-2.5 px-3 transition-all ${isSelected ? "bg-primary/6 border border-primary/10" : "border border-transparent"}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-[13px]">{REGION_FLAGS[region]}</span>
                    <span className={`text-[11px] font-semibold ${isSelected ? "text-primary" : "text-muted-foreground"}`}>{t(REGION_LABEL_KEYS[region])}</span>
                    {isSelected && (
                      <span className="text-[7px] font-bold text-primary bg-primary/10 px-1.5 py-0.5 rounded-full tracking-wider uppercase">
                        {t("brandContext.yourMarket")}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline justify-between mb-1.5">
                    <span className={`text-[13px] font-mono font-bold ${isSelected ? "text-primary" : "text-foreground"}`}>
                      {formatRegionalVal(localCurrent, userCurrency)}
                    </span>
                  </div>
                  <div className="h-[4px] rounded-full bg-foreground/4 overflow-hidden mb-1.5">
                    <div
                      className={`h-full rounded-full transition-all ${isSelected ? "bg-gradient-to-r from-primary/50 to-primary/80" : "bg-gradient-to-r from-primary/20 to-primary/45"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                  <div className="flex justify-end">
                    <span className="text-[8px] font-mono text-muted-foreground">
                      {formatUsdEquiv(val.usdCurrent)} USD
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. TOP MODELS */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Car className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.topModels")}
            </span>
          </div>
          <div className="space-y-2">
            {topModels.map((model) => (
              <div key={model.name} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium text-foreground">{model.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-display font-medium text-primary">
                    {formatPriceForRegion(model.avgPrice, selectedRegion)}
                  </span>
                  <span className={`text-[9px] font-bold ${gradeColor(model.grade)}`}>
                    {model.grade}
                  </span>
                  <span className="text-[9px] font-medium text-positive text-right">
                    {model.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. RECENT SALES */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.recentSales")}
            </span>
          </div>
          <div className="space-y-2">
            {recentSales.map((sale, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-border/50 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-muted-foreground truncate">{sale.title}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">{sale.platform} · {sale.date}</p>
                </div>
                <span className="text-[12px] font-mono font-semibold text-foreground shrink-0">
                  {formatPriceForRegion(sale.price, selectedRegion)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 6. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-border bg-primary/3">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.liquidityDepth")}
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.auctionsPerYear")}</span>
              <span className="text-[12px] font-mono font-semibold text-foreground">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.avgDaysToSell")}</span>
              <span className="text-[12px] font-mono font-semibold text-foreground">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-muted-foreground">{t("brandContext.sellThroughRate")}</span>
              <span className="text-[12px] font-mono font-semibold text-positive">{depth.sellThroughRate}%</span>
            </div>
            {/* Demand score visual */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-muted-foreground">{t("brandContext.demandScore")}</span>
                <span className="text-[12px] font-display font-medium text-primary">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${
                      i < depth.demandScore ? "bg-primary/50" : "bg-foreground/4"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 7. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-primary" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
              {t("brandContext.annualOwnership")}
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: t("brandContext.insurance"), value: ownershipCost.insurance },
              { label: t("brandContext.storage"), value: ownershipCost.storage },
              { label: t("brandContext.maintenance"), value: ownershipCost.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{item.label}</span>
                <span className="text-[11px] font-mono text-muted-foreground">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-border">
              <span className="text-[11px] font-medium text-foreground">{t("brandContext.total")}</span>
              <span className="text-[12px] font-display font-medium text-primary">{formatPriceForRegion(totalAnnualCost, selectedRegion)}{t("brandContext.perYear")}</span>
            </div>
          </div>
        </div>

        {/* 8. SIMILAR BRANDS */}
        {similarBrands.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-primary" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                {t("brandContext.similarBrands")}
              </span>
            </div>
            <div className="space-y-1.5">
              {similarBrands.map((b) => (
                <Link
                  key={b.slug}
                  href={`/cars/${b.slug}`}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-foreground/3 transition-colors px-1 -mx-1 group"
                >
                  <span className="text-[11px] font-medium text-foreground group-hover:text-primary transition-colors">
                    {b.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-muted-foreground">
                      {formatPriceForRegion(b.priceMin, selectedRegion)}–{formatPriceForRegion(b.priceMax, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${
                      b.topGrade === "AAA" ? "text-positive" : "text-primary"
                    }`}>{b.topGrade}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-border">
        <Link
          href={`/cars/${brand.slug}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-all"
        >
          {t("brandContext.explore", { brand: brand.name })}
          <ChevronRight className="size-4" />
        </Link>
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
