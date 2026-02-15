"use client"

import { useState, useRef, useEffect, useMemo } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion } from "framer-motion"
import { useLocale, useTranslations } from "next-intl"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, resolveRegion } from "@/lib/regionPricing"
import {
  Clock,
  MapPin,
  Gauge,
  Cog,
  TrendingUp,
  TrendingDown,
  Minus,
  ChevronRight,
  Sparkles,
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
import { getBrandImage } from "@/lib/modelImages"

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

const platformShort: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "BON",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
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
  McLaren: "The McLaren F1 represents the pinnacle of analog supercar engineering. With only 64 road cars produced, scarcity is absolute. Recent auction results show consistent 8-12% annual appreciation, outperforming traditional asset classes.",
  Porsche: "The 911 Carrera RS 2.7 is the foundation of Porsche's motorsport legacy. As the first homologation special, it carries historical significance that transcends typical collector car metrics. Strong club support and cross-generational appeal make this a cornerstone holding.",
  Ferrari: "Ferrari's timeless design combined with the legendary Colombo V12 creates an investment-grade asset. Classiche certification ensures authenticity. This model has demonstrated remarkable price stability even during market corrections.",
  Lamborghini: "Lamborghini's first true supercar remains the most desirable variant. Polo Storico certification adds provenance value. The mid-engine layout influenced every supercar that followed, cementing its historical importance.",
  Nissan: "The R34 GT-R represents the peak of Japanese engineering excellence. With 25-year import eligibility now active in the US, demand has surged 40% year-over-year. Low production numbers and strong enthusiast community support continued appreciation.",
  Toyota: "The A80 Supra has achieved icon status, bolstered by pop culture prominence and bulletproof 2JZ reliability. Clean, stock examples are increasingly rare as many were modified. Turbo 6-speed variants command significant premiums.",
  BMW: "The E30 M3 is widely regarded as the quintessential driver's car. Motorsport heritage and timeless design ensure lasting desirability. Sport Evolution and lightweight variants show strongest appreciation potential.",
  Mercedes: "Mercedes-Benz classics combine engineering excellence with timeless elegance. Strong parts availability and active restoration community support long-term ownership. Coupe and Cabriolet variants show strongest appreciation.",
  "Aston Martin": "The quintessential British grand tourer. James Bond association ensures global recognition. Strong club support and active restoration community. DB-series cars show consistent appreciation and strong auction presence.",
  Jaguar: "British elegance meets Le Mans-winning pedigree. The XJ220 was underappreciated for decades but values are now rebounding strongly. Early investors are seeing significant returns as the market corrects.",
  Mazda: "The RX-7 FD represents the pinnacle of rotary engine development. Spirit R editions are especially collectible. As the final true rotary sports car, scarcity ensures continued appreciation.",
  Honda: "Honda's engineering excellence shines in the S2000. The F20C/F22C engines are legendary for their 9,000 RPM redline. CR variants command significant premiums for their track-focused specification.",
  Shelby: "Carroll Shelby's Cobra is the ultimate American sports car legend. 427 examples represent the pinnacle of analog performance. CSX-documented cars command top dollar at auction.",
  Chevrolet: "The C2 Corvette Stingray is America's sports car at its most beautiful. Big block variants with manual transmissions are the collector's choice. Strong club support ensures lasting value.",
  Bugatti: "The EB110 represents Bugatti's modern renaissance. Quad-turbo V12, carbon chassis, and AWD were revolutionary for 1991. With only 139 built, scarcity drives strong appreciation.",
  Lancia: "The Stratos is the most successful rally car ever, dominating World Rally Championship from 1974-1976. Ferrari Dino V6 power and Bertone design ensure eternal collector appeal.",
  "De Tomaso": "Italian design meets American V8 power. The Mangusta's Giugiaro styling and rare production numbers make it an undervalued blue chip. Recognition is growing among serious collectors.",
  Alpine: "The A110 is France's answer to the Porsche 911. Lightweight, agile, and proven in competition. The 1600S is the ultimate road specification. Values rising as recognition spreads globally.",
  default: "This vehicle represents a compelling opportunity in the collector car market. Strong fundamentals, limited production, and growing collector interest suggest positive long-term value potential.",
}

// Default analysis for cars without DB analysis
const mockAnalysis: Record<string, { grade: string; trend: string; lowRange: number; highRange: number }> = {
  McLaren: { grade: "AAA", trend: "+12% Annually", lowRange: 15_500_000, highRange: 18_000_000 },
  Porsche: { grade: "AA", trend: "+8% Annually", lowRange: 1_100_000, highRange: 1_400_000 },
  Ferrari: { grade: "AAA", trend: "+10% Annually", lowRange: 2_800_000, highRange: 3_400_000 },
  Lamborghini: { grade: "AA", trend: "+9% Annually", lowRange: 1_900_000, highRange: 2_500_000 },
  Nissan: { grade: "A", trend: "+15% Annually", lowRange: 380_000, highRange: 520_000 },
  Toyota: { grade: "A", trend: "+12% Annually", lowRange: 145_000, highRange: 190_000 },
  BMW: { grade: "AA", trend: "+8% Annually", lowRange: 550_000, highRange: 750_000 },
  Mercedes: { grade: "AA", trend: "+6% Annually", lowRange: 350_000, highRange: 500_000 },
  "Aston Martin": { grade: "AA", trend: "+6% Annually", lowRange: 400_000, highRange: 550_000 },
  Jaguar: { grade: "AA", trend: "+9% Annually", lowRange: 480_000, highRange: 650_000 },
  Mazda: { grade: "AA", trend: "+14% Annually", lowRange: 95_000, highRange: 140_000 },
  Honda: { grade: "A", trend: "+12% Annually", lowRange: 68_000, highRange: 95_000 },
  Shelby: { grade: "AAA", trend: "+7% Annually", lowRange: 1_900_000, highRange: 2_400_000 },
  Chevrolet: { grade: "AA", trend: "+6% Annually", lowRange: 165_000, highRange: 220_000 },
  Bugatti: { grade: "AAA", trend: "+12% Annually", lowRange: 2_500_000, highRange: 3_200_000 },
  Lancia: { grade: "AAA", trend: "+9% Annually", lowRange: 550_000, highRange: 700_000 },
  "De Tomaso": { grade: "A", trend: "+8% Annually", lowRange: 240_000, highRange: 310_000 },
  Alpine: { grade: "A", trend: "+10% Annually", lowRange: 155_000, highRange: 205_000 },
  default: { grade: "B+", trend: "+5% Annually", lowRange: 80_000, highRange: 150_000 },
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

// ─── REGIONAL VALUATION DATA (5-year start → current, in local currency millions + USD equiv) ───
type RegionalValuation = { start: number; current: number; symbol: string; usdCurrent: number }
const mockRegionalValuation: Record<string, Record<string, RegionalValuation>> = {
  Ferrari:      { US: { start: 2.2, current: 3.4, symbol: "$", usdCurrent: 3.4 }, UK: { start: 1.7, current: 2.6, symbol: "£", usdCurrent: 3.3 }, EU: { start: 2.0, current: 3.1, symbol: "€", usdCurrent: 3.4 }, JP: { start: 250, current: 385, symbol: "¥", usdCurrent: 2.6 } },
  Porsche:      { US: { start: 0.95, current: 1.45, symbol: "$", usdCurrent: 1.45 }, UK: { start: 0.75, current: 1.1, symbol: "£", usdCurrent: 1.4 }, EU: { start: 0.88, current: 1.35, symbol: "€", usdCurrent: 1.48 }, JP: { start: 105, current: 165, symbol: "¥", usdCurrent: 1.1 } },
  McLaren:      { US: { start: 14.2, current: 21.0, symbol: "$", usdCurrent: 21.0 }, UK: { start: 11.5, current: 17.0, symbol: "£", usdCurrent: 21.5 }, EU: { start: 13.0, current: 19.5, symbol: "€", usdCurrent: 21.4 }, JP: { start: 1600, current: 2400, symbol: "¥", usdCurrent: 16.0 } },
  Lamborghini:  { US: { start: 2.1, current: 3.2, symbol: "$", usdCurrent: 3.2 }, UK: { start: 1.7, current: 2.5, symbol: "£", usdCurrent: 3.2 }, EU: { start: 1.9, current: 2.9, symbol: "€", usdCurrent: 3.2 }, JP: { start: 240, current: 365, symbol: "¥", usdCurrent: 2.4 } },
  Nissan:       { US: { start: 0.22, current: 0.48, symbol: "$", usdCurrent: 0.48 }, UK: { start: 0.18, current: 0.38, symbol: "£", usdCurrent: 0.48 }, EU: { start: 0.20, current: 0.42, symbol: "€", usdCurrent: 0.46 }, JP: { start: 25, current: 52, symbol: "¥", usdCurrent: 0.35 } },
  Toyota:       { US: { start: 0.095, current: 0.185, symbol: "$", usdCurrent: 0.185 }, UK: { start: 0.075, current: 0.15, symbol: "£", usdCurrent: 0.19 }, EU: { start: 0.088, current: 0.17, symbol: "€", usdCurrent: 0.186 }, JP: { start: 10, current: 21, symbol: "¥", usdCurrent: 0.14 } },
  BMW:          { US: { start: 1.5, current: 2.35, symbol: "$", usdCurrent: 2.35 }, UK: { start: 1.2, current: 1.9, symbol: "£", usdCurrent: 2.4 }, EU: { start: 1.4, current: 2.2, symbol: "€", usdCurrent: 2.4 }, JP: { start: 170, current: 270, symbol: "¥", usdCurrent: 1.8 } },
  Mercedes:     { US: { start: 1.2, current: 1.65, symbol: "$", usdCurrent: 1.65 }, UK: { start: 0.95, current: 1.3, symbol: "£", usdCurrent: 1.64 }, EU: { start: 1.1, current: 1.55, symbol: "€", usdCurrent: 1.7 }, JP: { start: 135, current: 190, symbol: "¥", usdCurrent: 1.27 } },
  "Aston Martin": { US: { start: 0.72, current: 0.99, symbol: "$", usdCurrent: 0.99 }, UK: { start: 0.58, current: 0.82, symbol: "£", usdCurrent: 1.04 }, EU: { start: 0.65, current: 0.92, symbol: "€", usdCurrent: 1.01 }, JP: { start: 82, current: 115, symbol: "¥", usdCurrent: 0.77 } },
  Shelby:       { US: { start: 1.6, current: 2.35, symbol: "$", usdCurrent: 2.35 }, UK: { start: 1.3, current: 1.9, symbol: "£", usdCurrent: 2.4 }, EU: { start: 1.5, current: 2.2, symbol: "€", usdCurrent: 2.4 }, JP: { start: 185, current: 270, symbol: "¥", usdCurrent: 1.8 } },
  Bugatti:      { US: { start: 2.2, current: 3.2, symbol: "$", usdCurrent: 3.2 }, UK: { start: 1.8, current: 2.6, symbol: "£", usdCurrent: 3.3 }, EU: { start: 2.0, current: 2.9, symbol: "€", usdCurrent: 3.2 }, JP: { start: 250, current: 370, symbol: "¥", usdCurrent: 2.5 } },
  default:      { US: { start: 0.1, current: 0.14, symbol: "$", usdCurrent: 0.14 }, UK: { start: 0.08, current: 0.11, symbol: "£", usdCurrent: 0.14 }, EU: { start: 0.09, current: 0.13, symbol: "€", usdCurrent: 0.14 }, JP: { start: 11, current: 16, symbol: "¥", usdCurrent: 0.11 } },
}

const REGION_FLAGS: Record<string, string> = { US: "\u{1F1FA}\u{1F1F8}", UK: "\u{1F1EC}\u{1F1E7}", EU: "\u{1F1EA}\u{1F1FA}", JP: "\u{1F1EF}\u{1F1F5}" }
const REGION_LABELS: Record<string, string> = { US: "US Market", UK: "UK Market", EU: "EU Market", JP: "Japan" }

function formatRegionalVal(v: number, symbol: string) {
  if (symbol === "¥") return `¥${v.toFixed(0)}M`
  return v >= 1 ? `${symbol}${v.toFixed(1)}M` : `${symbol}${Math.round(v * 1000)}K`
}

function formatUsdEquiv(v: number) {
  return v >= 1 ? `~$${v.toFixed(1)}M` : `~$${Math.round(v * 1000)}K`
}

// ─── BENCHMARK RETURNS (5-year, mock) ───
const BENCHMARKS = [
  { label: "S&P 500", return5y: 42 },
  { label: "Gold", return5y: 38 },
  { label: "Real Estate", return5y: 28 },
]

// ─── TOP MODELS PER BRAND (mock) ───
type TopModel = { name: string; avgPrice: number; grade: string; trend: string }
const mockTopModels: Record<string, TopModel[]> = {
  Ferrari: [{ name: "250 GTO", avgPrice: 48_400_000, grade: "AAA", trend: "+12%" }, { name: "F40", avgPrice: 2_800_000, grade: "AAA", trend: "+10%" }, { name: "275 GTB/4", avgPrice: 3_200_000, grade: "AA", trend: "+8%" }, { name: "Testarossa", avgPrice: 380_000, grade: "A", trend: "+15%" }],
  Porsche: [{ name: "959", avgPrice: 2_100_000, grade: "AAA", trend: "+9%" }, { name: "911 RS 2.7", avgPrice: 1_450_000, grade: "AA", trend: "+8%" }, { name: "356 Speedster", avgPrice: 680_000, grade: "AA", trend: "+6%" }, { name: "911 GT1", avgPrice: 5_200_000, grade: "AAA", trend: "+11%" }],
  McLaren: [{ name: "F1", avgPrice: 19_800_000, grade: "AAA", trend: "+12%" }, { name: "F1 GTR", avgPrice: 12_500_000, grade: "AAA", trend: "+10%" }, { name: "F1 LM", avgPrice: 23_100_000, grade: "AAA", trend: "+14%" }],
  Lamborghini: [{ name: "Miura SV", avgPrice: 2_650_000, grade: "AAA", trend: "+9%" }, { name: "Countach LP400", avgPrice: 1_200_000, grade: "AA", trend: "+11%" }, { name: "Diablo GT", avgPrice: 850_000, grade: "A", trend: "+14%" }],
  BMW: [{ name: "M3 E30 Evo", avgPrice: 285_000, grade: "AA", trend: "+12%" }, { name: "M1", avgPrice: 680_000, grade: "AAA", trend: "+8%" }, { name: "M3 CSL E46", avgPrice: 225_000, grade: "AA", trend: "+10%" }],
  Mercedes: [{ name: "300SL Gullwing", avgPrice: 1_650_000, grade: "AAA", trend: "+6%" }, { name: "300SL Roadster", avgPrice: 1_320_000, grade: "AA", trend: "+5%" }, { name: "CLK GTR", avgPrice: 4_500_000, grade: "AAA", trend: "+9%" }],
  Nissan: [{ name: "R34 GT-R V-Spec", avgPrice: 485_000, grade: "AA", trend: "+18%" }, { name: "R34 GT-R Nur", avgPrice: 520_000, grade: "AA", trend: "+20%" }, { name: "R32 GT-R", avgPrice: 145_000, grade: "A", trend: "+15%" }],
  Toyota: [{ name: "Supra Turbo 6-Spd", avgPrice: 185_000, grade: "A", trend: "+14%" }, { name: "2000GT", avgPrice: 1_100_000, grade: "AAA", trend: "+8%" }, { name: "Supra RZ", avgPrice: 195_000, grade: "A", trend: "+16%" }],
  default: [{ name: "Top Variant", avgPrice: 150_000, grade: "A", trend: "+8%" }, { name: "Standard", avgPrice: 85_000, grade: "B+", trend: "+5%" }],
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

// ─── 6-YEAR PRICE HISTORY (year-by-year, in millions) ───
const PRICE_YEARS = ["2021", "2022", "2023", "2024", "2025", "2026"]
const mockPriceHistory: Record<string, number[]> = {
  McLaren: [14.2, 15.8, 17.5, 19.2, 20.1, 21.0],
  Porsche: [0.95, 1.05, 1.18, 1.32, 1.38, 1.45],
  Ferrari: [2.2, 2.5, 2.8, 3.1, 3.25, 3.4],
  Lamborghini: [2.1, 2.4, 2.7, 2.9, 3.05, 3.2],
  Nissan: [0.22, 0.28, 0.35, 0.42, 0.45, 0.48],
  Toyota: [0.095, 0.12, 0.14, 0.165, 0.175, 0.185],
  BMW: [1.5, 1.7, 1.9, 2.1, 2.22, 2.35],
  Mercedes: [1.2, 1.35, 1.45, 1.55, 1.6, 1.65],
  "Aston Martin": [0.72, 0.78, 0.85, 0.92, 0.95, 0.99],
  Lexus: [0.55, 0.62, 0.72, 0.82, 0.85, 0.89],
  Ford: [0.35, 0.40, 0.45, 0.49, 0.51, 0.52],
  Acura: [0.085, 0.095, 0.11, 0.125, 0.135, 0.145],
  Jaguar: [0.18, 0.21, 0.24, 0.26, 0.27, 0.285],
  Mazda: [0.065, 0.078, 0.092, 0.105, 0.118, 0.132],
  Honda: [0.048, 0.055, 0.064, 0.072, 0.082, 0.09],
  Shelby: [1.6, 1.75, 1.88, 2.02, 2.18, 2.35],
  Chevrolet: [0.14, 0.155, 0.168, 0.18, 0.195, 0.21],
  Bugatti: [2.2, 2.45, 2.65, 2.85, 3.0, 3.2],
  Lancia: [0.42, 0.48, 0.53, 0.58, 0.64, 0.7],
  "De Tomaso": [0.19, 0.21, 0.23, 0.25, 0.27, 0.3],
  Alpine: [0.12, 0.135, 0.15, 0.165, 0.18, 0.2],
  default: [0.1, 0.11, 0.12, 0.13, 0.135, 0.14],
}

// ─── AGGREGATE AUCTIONS BY BRAND ───
function aggregateBrands(auctions: Auction[]): Brand[] {
  const brandMap = new Map<string, Auction[]>()

  // Group by make
  auctions.forEach(auction => {
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

    brands.push({
      name,
      slug: name.toLowerCase().replace(/\s+/g, "-"),
      carCount: cars.length,
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

// ─── COLUMN B: BRAND CARD (NEW - replaces AssetCard on landing) ───
function BrandCard({ brand }: { brand: Brand }) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  return (
    <div className="h-[calc(100dvh-80px)] w-full flex flex-col snap-start p-4">
      <Link
        href={`/cars/${brand.slug}`}
        className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-[#0F1012] border border-white/5 group cursor-pointer hover:border-[rgba(248,180,217,0.2)] transition-all duration-300"
      >
        {/* TOP: CINEMATIC IMAGE */}
        <div className="relative aspect-[16/9] w-full shrink-0 overflow-hidden">
          {brand.representativeImage ? (
            <Image
              src={brand.representativeImage}
              alt={brand.name}
              fill
              className="object-cover object-center group-hover:scale-105 transition-transform duration-500"
              sizes="50vw"
              priority
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-[#0F1012] flex items-center justify-center">
              <span className="text-[#6B7280] text-lg">{brand.name}</span>
            </div>
          )}

          {/* Vignette gradient */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0F1012] via-transparent to-transparent pointer-events-none" />

          {/* Car count badge */}
          <div className="absolute top-4 right-4">
            <span className="rounded-full bg-[rgba(11,11,16,0.7)] backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-[#FFFCF7]">
              {t("brandCard.carsCount", { count: brand.carCount })}
            </span>
          </div>

          {/* Grade badge */}
          <div className="absolute top-4 left-4">
            <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
              brand.topGrade === "AAA"
                ? "bg-emerald-500/30 text-emerald-300"
                : brand.topGrade === "AA"
                ? "bg-[rgba(248,180,217,0.3)] text-[#F8B4D9]"
                : "bg-white/20 text-white"
            }`}>
              {brand.topGrade}
            </span>
          </div>
        </div>

        {/* BOTTOM: BRAND INFO */}
        <div className="flex-1 w-full bg-[#0F1012] p-6 flex flex-col justify-between">
          {/* Brand name */}
          <div>
            <h2 className="text-3xl font-bold text-[#FFFCF7] tracking-tight group-hover:text-[#F8B4D9] transition-colors">
              {brand.name}
            </h2>
            <p className="text-[13px] text-[#6B7280] mt-1">
              {brand.representativeCar}
            </p>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-4 border-t border-white/5">
            {/* Price Range */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <DollarSign className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.priceRange")}</span>
              </div>
              <p className="text-[13px] font-mono text-[#FFFCF7]">
                {formatPriceForRegion(brand.priceMin, selectedRegion)}–{formatPriceForRegion(brand.priceMax, selectedRegion)}
              </p>
            </div>

            {/* Trend */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <TrendingUp className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.trend")}</span>
              </div>
              <p className="text-[13px] font-semibold text-positive">{brand.avgTrend}</p>
            </div>

            {/* Collection */}
            <div className="space-y-1">
              <div className="flex items-center gap-1.5 text-[#6B7280]">
                <Car className="size-3" />
                <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("brandCard.collection")}</span>
              </div>
              <p className="text-[13px] text-[#FFFCF7]">{t("brandCard.vehiclesCount", { count: brand.carCount })}</p>
            </div>
          </div>

          {/* Categories */}
          {brand.categories.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {brand.categories.slice(0, 3).map((cat) => (
                <span
                  key={cat}
                  className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-[#9CA3AF]"
                >
                  {cat}
                </span>
              ))}
              {brand.categories.length > 3 && (
                <span className="px-3 py-1 rounded-full bg-white/5 text-[10px] text-[#6B7280]">
                  {t("brandCard.more", { count: brand.categories.length - 3 })}
                </span>
              )}
            </div>
          )}

          {/* CTA */}
          <div className="mt-6 flex items-center justify-between">
            <span className="text-[12px] font-medium tracking-[0.1em] uppercase text-[#9CA3AF] group-hover:text-[#F8B4D9] transition-colors">
              {t("brandCard.exploreCollection")}
            </span>
            <ChevronRight className="size-5 text-[#9CA3AF] group-hover:text-[#F8B4D9] group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>
    </div>
  )
}

// ─── MOBILE: REGION PILLS (sticky) ───
function MobileRegionPills() {
  const { selectedRegion, setSelectedRegion } = useRegion()
  const REGIONS = [
    { id: "all", label: "All", flag: "\u{1F30D}" },
    { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
    { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
    { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}" },
    { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
  ]
  return (
    <div className="sticky top-0 z-20 bg-[#0b0b10]/95 backdrop-blur-md border-b border-white/5 px-4 py-2.5">
      <div className="flex items-center gap-1">
        {REGIONS.map((region) => {
          const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
          return (
            <button
              key={region.id}
              onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all ${
                isActive
                  ? "bg-[#F8B4D9]/15 text-[#F8B4D9] border border-[#F8B4D9]/25"
                  : "text-[#6B7280] hover:text-[#9CA3AF] bg-white/[0.03] border border-transparent"
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
        {brand.representativeImage ? (
          <Image
            src={brand.representativeImage}
            alt={brand.name}
            fill
            className="object-cover object-center"
            sizes="100vw"
            priority
            referrerPolicy="no-referrer"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 bg-[#0F1012] flex items-center justify-center">
            <span className="text-[#6B7280] text-2xl font-bold">{brand.name}</span>
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/30 to-transparent pointer-events-none" />

        {/* Grade badge */}
        <div className="absolute top-4 left-4">
          <span className={`rounded-full backdrop-blur-md px-3 py-1.5 text-[10px] font-bold tracking-[0.1em] uppercase ${
            brand.topGrade === "AAA"
              ? "bg-emerald-500/30 text-emerald-300"
              : brand.topGrade === "AA"
                ? "bg-[rgba(248,180,217,0.3)] text-[#F8B4D9]"
                : "bg-white/20 text-white"
          }`}>
            {brand.topGrade}
          </span>
        </div>

        {/* Car count */}
        <div className="absolute top-4 right-4">
          <span className="rounded-full bg-[rgba(11,11,16,0.7)] backdrop-blur-md px-3 py-1.5 text-[10px] font-medium text-[#FFFCF7]">
            {t("brandCard.carsCount", { count: brand.carCount })}
          </span>
        </div>

        {/* Overlaid info at bottom */}
        <div className="absolute bottom-0 left-0 right-0 px-5 pb-5">
          <h2 className="text-3xl font-bold text-[#FFFCF7] tracking-tight">
            {brand.name}
          </h2>
          <p className="text-[13px] text-[rgba(255,252,247,0.5)] mt-0.5">
            {brand.representativeCar}
          </p>
          <div className="flex items-center gap-3 mt-2">
            <span className="text-[16px] font-bold font-mono text-[#F8B4D9]">
              {formatPriceForRegion(brand.priceMin, selectedRegion)} – {formatPriceForRegion(brand.priceMax, selectedRegion)}
            </span>
            <span className="text-[12px] text-positive font-medium">{brand.avgTrend}</span>
          </div>
          {/* Categories */}
          <div className="flex flex-wrap gap-1.5 mt-3">
            {brand.categories.slice(0, 3).map((cat) => (
              <span
                key={cat}
                className="px-2.5 py-1 rounded-full bg-white/10 backdrop-blur-sm text-[10px] text-[#FFFCF7]/70"
              >
                {cat}
              </span>
            ))}
          </div>
          {/* Inline CTA */}
          <div className="flex items-center gap-1.5 mt-3 text-[#F8B4D9]">
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
      className="flex items-center gap-4 px-4 py-3.5 active:bg-white/[0.03] transition-colors"
    >
      {/* Thumbnail */}
      <div className="relative w-20 h-14 rounded-xl overflow-hidden shrink-0 bg-[#0F1012]">
        {brand.representativeImage ? (
          <Image
            src={brand.representativeImage}
            alt={brand.name}
            fill
            className="object-cover"
            sizes="80px"
            referrerPolicy="no-referrer"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Car className="size-5 text-[#6B7280]" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <p className="text-[14px] font-semibold text-[#FFFCF7] truncate">
          {brand.name}
        </p>
        <p className="text-[11px] text-[#6B7280] mt-0.5">
          {t("mobileFeed.vehicles", { count: brand.carCount })}
        </p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-[12px] font-mono text-[#F8B4D9]">
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
              ? "text-[#F8B4D9]"
              : "text-[#6B7280]"
        }`}>
          {brand.topGrade}
        </span>
        <ChevronRight className="size-4 text-[#4B5563]" />
      </div>
    </Link>
  )
}

// ─── MOBILE: LIVE AUCTIONS SECTION ───
function MobileLiveAuctions({ auctions }: { auctions: Auction[] }) {
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
    return auctions
      .filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status))
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
      .slice(0, 8)
  }, [auctions])

  if (liveAuctions.length === 0) return null

  return (
    <div className="mt-6">
      {/* Section header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
          {t("mobileFeed.liveAuctions")}
        </span>
        <span className="text-[10px] font-mono font-semibold text-[#F8B4D9]">
          {liveAuctions.length}
        </span>
      </div>

      {/* Auction rows */}
      <div className="divide-y divide-white/5">
        {liveAuctions.map((auction) => {
          const isEndingSoon = auction.status === "ENDING_SOON"
          const remaining = timeLeft(auction.endTime, timeLabels)

          return (
            <Link
              key={auction.id}
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex items-center gap-3 px-4 py-3 active:bg-white/[0.03] transition-colors"
            >
              {/* Thumbnail */}
              <div className="relative w-16 h-12 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                {auction.images[0] ? (
                  <Image
                    src={auction.images[0]}
                    alt={auction.title}
                    fill
                    className="object-cover"
                    sizes="64px"
                    referrerPolicy="no-referrer"
                    unoptimized
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Car className="size-3.5 text-[#6B7280]" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-[#FFFCF7] truncate">
                  {auction.year} {auction.make} {auction.model}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">
                    {formatPriceForRegion(auction.currentBid, selectedRegion)}
                  </span>
                  <span className="text-[10px] text-[#6B7280]">
                    {tAuction("bids.count", { count: auction.bidCount })}
                  </span>
                </div>
              </div>

              {/* Time */}
              <div className="flex items-center gap-1 shrink-0">
                <Clock className={`size-3 ${isEndingSoon ? "text-[#FB923C]" : "text-[#6B7280]"}`} />
                <span className={`text-[10px] font-mono font-medium ${
                  isEndingSoon ? "text-[#FB923C]" : "text-[#6B7280]"
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
    <div className="h-full flex flex-col border-r border-white/5 overflow-hidden">
      {/* Header */}
      <div className="shrink-0 px-4 py-4 border-b border-white/5">
        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#9CA3AF]">
          {t("brandNav.title")}
        </span>
        <p className="mt-1 text-[12px] text-[#6B7280]">
          {t("brandNav.manufacturers", { count: brands.length })}
        </p>
      </div>

      {/* Quick Stats */}
      <div className="shrink-0 px-4 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.02)]">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">
              {t("brandNav.totalCars")}
            </span>
            <p className="text-[14px] font-bold text-[#FFFCF7] mt-0.5">
              {brands.reduce((sum, b) => sum + b.carCount, 0).toLocaleString()}
            </p>
          </div>
          <div>
            <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">
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
                isActive ? "bg-[rgba(248,180,217,0.08)]" : "hover:bg-white/[0.02]"
              }`}
            >
              {/* Active indicator */}
              {isActive && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute left-0 top-0 bottom-0 w-[2px] bg-[#F8B4D9]"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}

              <div className="flex items-center gap-3">
                {/* Content */}
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-semibold truncate transition-colors ${
                    isActive ? "text-[#FFFCF7]" : "text-[#9CA3AF] group-hover:text-[#FFFCF7]"
                  }`}>
                    {brand.name}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-[11px] font-mono ${
                      isActive ? "text-[#F8B4D9]" : "text-[rgba(248,180,217,0.6)]"
                    }`}>
                      {t("brandNav.carsCount", { count: brand.carCount })}
                    </span>
                    <span className="text-[9px] text-[#6B7280]">
                      {formatPriceForRegion(brand.priceMin, selectedRegion)}–{formatPriceForRegion(brand.priceMax, selectedRegion)}
                    </span>
                  </div>
                </div>

                {/* Grade badge */}
                <span className={`text-[10px] font-bold ${
                  brand.topGrade === "AAA" ? "text-positive" :
                  brand.topGrade === "AA" ? "text-[#F8B4D9]" :
                  "text-[#9CA3AF]"
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
  activeBrandSlug,
}: {
  auctions: Auction[]
  brands: Brand[]
  onSelectBrand: (brandSlug: string) => void
  activeBrandSlug?: string
}) {
  const t = useTranslations("dashboard")
  const { selectedRegion } = useRegion()

  const [brandSearch, setBrandSearch] = useState("")

  // Filter brands by search
  const filteredBrands = useMemo(() => {
    if (!brandSearch.trim()) return brands
    const q = brandSearch.toLowerCase()
    return brands.filter(b => b.name.toLowerCase().includes(q))
  }, [brands, brandSearch])

  // Live auctions sorted by ending soonest
  const liveAuctions = useMemo(() => {
    return auctions
      .filter(a => ["ACTIVE", "ENDING_SOON", "LIVE"].includes(a.status))
      .sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
  }, [auctions])

  // Grade badge color
  const gradeColor = (grade: string) => {
    switch (grade) {
      case "AAA": case "EXCELLENT": return "text-emerald-400"
      case "AA": case "GOOD": return "text-blue-400"
      case "A": case "FAIR": return "text-amber-400"
      default: return "text-[#6B7280]"
    }
  }

  const timeLabels = {
    ended: t("asset.ended"),
    day: t("asset.timeDay"),
    hour: t("asset.timeHour"),
    minute: t("asset.timeMin"),
  }

  return (
    <div className="h-full flex flex-col border-r border-white/5 overflow-hidden">

      {/* ═══ TOP HALF: FIND YOUR CAR ═══ */}
      <div className="flex-1 min-h-0 flex flex-col">

        {/* Search brands */}
        <div className="shrink-0 px-4 pt-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-[#6B7280]" />
            <input
              type="text"
              value={brandSearch}
              onChange={(e) => setBrandSearch(e.target.value)}
              placeholder={t("sidebar.findYourCar")}
              className="w-full bg-white/[0.03] border border-white/5 rounded-lg pl-9 pr-3 py-2 text-[12px] text-[#FFFCF7] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(248,180,217,0.3)] transition-colors"
            />
          </div>
        </div>

        {/* Section header */}
        <div className="shrink-0 flex items-center justify-between px-4 py-1.5">
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-[#6B7280]">
            {t("sidebar.popular")}
          </span>
          <span className="text-[9px] font-mono text-[#6B7280]">
            {filteredBrands.length} {filteredBrands.length === 1 ? "brand" : "brands"}
          </span>
        </div>

        {/* Brands list (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {filteredBrands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-[#6B7280]">{t("sidebar.noResults")}</p>
            </div>
          ) : (
            filteredBrands.map((brand) => {
              const isActive = activeBrandSlug === brand.slug
              return (
                <button
                  key={brand.slug}
                  onClick={() => onSelectBrand(brand.slug)}
                  className={`w-full text-left px-4 py-2.5 border-b border-white/[0.03] transition-all group ${
                    isActive
                      ? "bg-[rgba(248,180,217,0.06)] border-l-2 border-l-[#F8B4D9]"
                      : "hover:bg-white/[0.02] border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[12px] font-semibold transition-colors ${
                      isActive ? "text-[#F8B4D9]" : "text-[#FFFCF7] group-hover:text-[#F8B4D9]"
                    }`}>
                      {brand.name}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-bold ${gradeColor(brand.topGrade)}`}>
                        {brand.topGrade}
                      </span>
                      <span className="text-[10px] text-[#6B7280] font-mono">
                        {brand.carCount}
                      </span>
                      <ChevronRight className={`size-3 transition-colors ${
                        isActive ? "text-[#F8B4D9]" : "text-[#4B5563] group-hover:text-[#6B7280]"
                      }`} />
                    </div>
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] font-mono text-[#6B7280]">
                      {formatPriceForRegion(brand.priceMin, selectedRegion)} – {formatPriceForRegion(brand.priceMax, selectedRegion)}
                    </span>
                    <span className="text-[9px] text-positive font-medium">
                      {brand.avgTrend}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* ═══ BOTTOM HALF: LIVE BIDS ═══ */}
      <div className="flex-1 min-h-0 flex flex-col border-t border-white/5">

        {/* Live header */}
        <div className="shrink-0 flex items-center gap-2 px-4 py-2.5 bg-[rgba(15,14,22,0.5)]">
          <div className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-[9px] font-semibold tracking-[0.25em] uppercase text-[#9CA3AF]">
            {t("sidebar.liveNow")}
          </span>
          <span className="text-[10px] font-mono font-semibold text-[#F8B4D9]">
            {liveAuctions.length}
          </span>
        </div>

        {/* Live auctions list (scrollable) */}
        <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
          {liveAuctions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-20 text-center px-4">
              <p className="text-[11px] text-[#6B7280]">No live auctions right now</p>
            </div>
          ) : (
            liveAuctions.map((auction) => {
              const isEndingSoon = auction.status === "ENDING_SOON"
              const remaining = timeLeft(auction.endTime, timeLabels)

              return (
                <Link
                  key={auction.id}
                  href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
                  className="group relative block px-4 py-2.5 border-b border-white/[0.03] hover:bg-white/[0.02] transition-all"
                >
                  <div className="flex gap-3">
                    {/* Thumbnail */}
                    <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-[#0F1012]">
                      {auction.images[0] ? (
                        <Image
                          src={auction.images[0]}
                          alt={auction.title}
                          fill
                          className="object-cover"
                          sizes="56px"
                          referrerPolicy="no-referrer"
                          unoptimized
                        />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Car className="size-3.5 text-[#6B7280]" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">
                        {auction.year} {auction.make} {auction.model}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">
                          {formatPriceForRegion(auction.currentBid, selectedRegion)}
                        </span>
                        <div className="flex items-center gap-1 ml-auto">
                          <Clock className={`size-2.5 ${isEndingSoon ? "text-[#FB923C]" : "text-[#6B7280]"}`} />
                          <span className={`text-[9px] font-mono font-medium ${
                            isEndingSoon ? "text-[#FB923C]" : "text-[#6B7280]"
                          }`}>
                            {remaining}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[8px] text-[#6B7280]">
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
      <div className="flex-1 flex flex-col rounded-[32px] overflow-hidden bg-[#0F1012] border border-white/5">
        {/* TOP: CINEMATIC IMAGE (wider aspect ratio to fit CTAs) */}
        <div className="relative aspect-[16/8] w-full shrink-0">
          {auction.images[0] ? (
            <Image
              src={auction.images[0]}
              alt={auction.title}
              fill
              className="object-cover object-center"
              sizes="50vw"
              priority
              referrerPolicy="no-referrer"
              unoptimized
            />
          ) : (
            <div className="absolute inset-0 bg-[#0F1012] flex items-center justify-center">
              <span className="text-[#6B7280] text-lg">{t("asset.noImage")}</span>
            </div>
          )}

          {/* Vignette gradient at bottom */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0F1012] to-transparent pointer-events-none" />

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
            <span className="rounded-full bg-[rgba(11,11,16,0.7)] backdrop-blur-md px-3 py-1.5 text-[10px] font-medium tracking-[0.1em] uppercase text-[#FFFCF7]">
              {platformShort[auction.platform]}
            </span>
          </div>
        </div>

        {/* BOTTOM: DATA DECK (fills remaining space) */}
        <div className="flex-1 w-full bg-[#0F1012] p-6 flex flex-col justify-start overflow-hidden">
          {/* Title + Price row */}
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h2 className="text-2xl font-bold text-[#FFFCF7] tracking-tight truncate">
                {auction.make} {auction.model}
              </h2>
              {auction.trim && (
                <p className="text-[15px] text-[#9CA3AF] mt-0.5">{auction.trim}</p>
              )}
            </div>
            <div className="text-right shrink-0">
              <p className="text-3xl font-bold text-[#FFFCF7] font-mono tabular-nums">
                {formatPriceForRegion(auction.currentBid, selectedRegion)}
              </p>
              <div className="flex items-center justify-end gap-3 mt-1 text-[#9CA3AF]">
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
              ? "-3% Annually"
              : fallbackAnalysis.trend
            const lowRange = auction.analysis?.bidTargetLow || fallbackAnalysis.lowRange
            const highRange = auction.analysis?.bidTargetHigh || fallbackAnalysis.highRange

            return (
              <div className="mt-auto grid grid-cols-4 gap-4 pt-4 border-t border-white/5">
                {/* Grade */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[#6B7280]">
                    <Award className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.grade")}</span>
                  </div>
                  <p className={`text-[15px] font-bold ${
                    grade === "AAA" || grade === "EXCELLENT" ? "text-positive" :
                    grade === "AA" || grade === "A" || grade === "GOOD" ? "text-[#F8B4D9]" :
                    "text-[#FFFCF7]"
                  }`}>{grade}</p>
                </div>

                {/* Trend */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[#6B7280]">
                    <TrendingUp className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.trend")}</span>
                  </div>
                  <p className="text-[13px] font-semibold text-positive">{trend}</p>
                </div>

                {/* Fair Value */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[#6B7280]">
                    <DollarSign className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.fairValue")}</span>
                  </div>
                  <p className="text-[13px] text-[#FFFCF7] font-mono">
                    {formatPriceForRegion(lowRange, selectedRegion)}–{formatPriceForRegion(highRange, selectedRegion)}
                  </p>
                </div>

                {/* Category */}
                <div className="space-y-1">
                  <div className="flex items-center gap-1.5 text-[#6B7280]">
                    <Car className="size-3" />
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase">{t("asset.metrics.category")}</span>
                  </div>
                  <p className="text-[13px] text-[#FFFCF7] truncate">{auction.category || t("asset.metrics.collector")}</p>
                </div>
              </div>
            )
          })()}

          {/* CTA Row */}
          <div className="flex items-center gap-3 mt-4">
            {isLive && (
              <button className="flex-1 rounded-full bg-[#F8B4D9] py-3 text-[12px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-colors">
                {tAuction("actions.placeBid")}
              </button>
            )}
            <Link
              href={`/cars/${auction.make.toLowerCase().replace(/\s+/g, "-")}/${auction.id}`}
              className="flex-1 rounded-full border border-white/10 py-3 text-center text-[12px] font-medium tracking-[0.1em] uppercase text-[#9CA3AF] hover:text-[#FFFCF7] hover:border-[rgba(248,180,217,0.5)] transition-all"
            >
              {t("asset.fullAnalysis")}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── YEAR-BY-YEAR CHART COMPONENT ───
function YearByYearChart({ data, years = PRICE_YEARS }: { data: number[]; years?: string[] }) {
  const max = Math.max(...data)
  const { selectedRegion } = useRegion()

  return (
    <div className="space-y-1.5">
      {data.map((value, i) => {
        const barWidth = max > 0 ? (value / max) * 100 : 0
        const yoy = i > 0 ? ((value - data[i - 1]) / data[i - 1]) * 100 : null
        const isLast = i === data.length - 1

        return (
          <div key={years[i]} className="flex items-center gap-2">
            {/* Year label */}
            <span className={`text-[10px] font-mono w-8 shrink-0 ${isLast ? "text-[#FFFCF7] font-semibold" : "text-[#6B7280]"}`}>
              {years[i].slice(2)}
            </span>

            {/* Bar */}
            <div className="flex-1 h-[14px] rounded-sm bg-white/[0.03] overflow-hidden relative">
              <div
                className={`h-full rounded-sm transition-all ${isLast ? "bg-[#F8B4D9]/40" : "bg-[#F8B4D9]/15"}`}
                style={{ width: `${barWidth}%` }}
              />
            </div>

            {/* Value */}
            <span className={`text-[10px] font-mono w-14 text-right shrink-0 ${isLast ? "text-[#FFFCF7] font-semibold" : "text-[#9CA3AF]"}`}>
              {formatPriceForRegion(value * 1_000_000, selectedRegion)}
            </span>

            {/* YoY change */}
            <span className={`text-[9px] font-mono w-10 text-right shrink-0 ${
              yoy !== null && yoy > 0 ? "text-positive" : yoy !== null && yoy < 0 ? "text-red-400" : "text-transparent"
            }`}>
              {yoy !== null ? `+${yoy.toFixed(0)}%` : "—"}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── COLUMN C: THE CONTEXT PANEL ───
// Enhanced with price chart, ownership cost, and similar cars
function ContextPanel({ auction, allAuctions }: { auction: Auction; allAuctions: Auction[] }) {
  const t = useTranslations("dashboard")
  const tCommon = useTranslations("common")
  const { selectedRegion, effectiveRegion } = useRegion()

  const whyBuy = mockWhyBuy[auction.make] || mockWhyBuy["default"]
  const marketPulse = mockMarketPulse[auction.make] || mockMarketPulse["default"]
  const ownershipCost = mockOwnershipCost[auction.make] || mockOwnershipCost["default"]
  const priceHistory = mockPriceHistory[auction.make] || mockPriceHistory["default"]
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
      <div className="px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Sparkles className="size-4 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
            {t("context.investmentThesis")}
          </span>
        </div>
        <p className="text-[11px] leading-snug text-[#9CA3AF] line-clamp-4">
          {whyBuy}
        </p>
      </div>

      {/* SECTION 2: Year-by-Year Price History */}
      <div className="px-5 py-3 border-b border-white/5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              {t("context.fiveYearAppreciation")}
            </span>
          </div>
          <span className="text-[11px] font-mono font-semibold text-positive">
            +{Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)}%
          </span>
        </div>
        <YearByYearChart data={priceHistory} />
      </div>

      {/* SECTION 3: Fair Value by Region */}
      <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
        <div className="flex items-center gap-2 mb-2">
          <Globe className="size-4 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
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
                <div key={region} className={`flex items-center justify-between ${isSelected ? "rounded bg-[rgba(248,180,217,0.04)] -mx-1 px-1 py-0.5" : ""}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{flags[region]}</span>
                    <span className={`text-[10px] font-medium ${isSelected ? "text-[#F8B4D9]" : "text-[#9CA3AF]"}`}>{region}</span>
                    {isSelected && <span className="text-[8px] font-bold text-[#F8B4D9] tracking-wide">YOUR MARKET</span>}
                  </div>
                  <span className={`text-[12px] font-bold font-mono ${isSelected ? "text-[#F8B4D9]" : "text-[#FFFCF7]"}`}>
                    {fmtRegional(rp.low, rp.currency)} — {fmtRegional(rp.high, rp.currency)}
                  </span>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold font-mono text-[#F8B4D9]">
              {formatPriceForRegion(lowRange, selectedRegion)} — {formatPriceForRegion(highRange, selectedRegion)}
            </span>
          </div>
        )}
      </div>

      {/* SECTION 4: Ownership Cost */}
      <div className="px-5 py-3 border-b border-white/5">
        <div className="flex items-center gap-2 mb-2">
          <Wrench className="size-4 text-[#F8B4D9]" />
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
            {t("context.annualOwnershipCost")}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center">
            <Shield className="size-3 text-[#6B7280] mx-auto mb-1" />
            <p className="text-[10px] text-[#6B7280]">{t("context.insurance")}</p>
            <p className="text-[11px] font-mono font-semibold text-[#FFFCF7]">${(ownershipCost.insurance / 1000).toFixed(0)}K</p>
          </div>
          <div className="text-center">
            <MapPin className="size-3 text-[#6B7280] mx-auto mb-1" />
            <p className="text-[10px] text-[#6B7280]">{t("context.storage")}</p>
            <p className="text-[11px] font-mono font-semibold text-[#FFFCF7]">${(ownershipCost.storage / 1000).toFixed(1)}K</p>
          </div>
          <div className="text-center">
            <Wrench className="size-3 text-[#6B7280] mx-auto mb-1" />
            <p className="text-[10px] text-[#6B7280]">{t("context.service")}</p>
            <p className="text-[11px] font-mono font-semibold text-[#FFFCF7]">${(ownershipCost.maintenance / 1000).toFixed(0)}K</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/5 flex justify-between">
          <span className="text-[10px] text-[#6B7280]">{t("context.totalAnnual")}</span>
          <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">${(totalAnnualCost / 1000).toFixed(0)}K{t("context.perYear")}</span>
        </div>
      </div>

      {/* SECTION 5: Similar Cars (Scrollable) */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar px-5 py-3">
        {similarCars.length > 0 && (
          <>
            <div className="flex items-center gap-2 mb-2">
              <Car className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                {t("context.alsoConsider")}
              </span>
            </div>
            <div className="space-y-2">
              {similarCars.map((car) => (
                <Link
                  key={car.id}
                  href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
                  className="flex items-center justify-between py-2 px-2 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors cursor-pointer group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[11px] font-medium text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">
                      {car.make} {car.model}
                    </p>
                    <p className="text-[10px] text-[#6B7280]">{car.category}</p>
                  </div>
                  <span className="text-[11px] font-mono font-semibold text-[#F8B4D9] ml-2">
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
            <Calendar className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              {t("context.recentSales")}
            </span>
          </div>
          <div className="space-y-1">
            {marketPulse.slice(0, 5).map((sale, i) => (
              <div key={i} className="flex items-center justify-between py-1.5">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] text-[#9CA3AF] truncate">{sale.title}</p>
                  <p className="text-[9px] text-[#6B7280]">{sale.date}</p>
                </div>
                <span className="text-[11px] font-mono font-semibold text-[#FFFCF7] ml-2">
                  {formatPriceForRegion(sale.price, selectedRegion)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Ask Button */}
      <div className="shrink-0 px-5 py-3 border-t border-white/5">
        <a
          href={`https://wa.me/573208492641?text=${encodeURIComponent(
            `Hola, estoy viendo el ${auction.make} ${auction.model} en Monza Lab. Me gustaría conocer el potencial de inversión y valoración actual de este vehículo.`
          )}`}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[rgba(248,180,217,0.08)] border border-[rgba(248,180,217,0.15)] py-2.5 text-[10px] font-medium tracking-[0.1em] uppercase text-[#F8B4D9] hover:bg-[rgba(248,180,217,0.15)] hover:border-[rgba(248,180,217,0.3)] transition-all"
        >
          <Sparkles className="size-3" />
          {t("context.askAboutThisCar")}
          <ChevronRight className="size-3" />
        </a>
      </div>
    </div>
  )
}

// ─── BRAND CONTEXT PANEL ───
function BrandContextPanel({ brand, allBrands }: { brand: Brand; allBrands: Brand[] }) {
  const t = useTranslations("dashboard")
  const { selectedRegion, effectiveRegion } = useRegion()

  const whyBuy = mockWhyBuy[brand.name] || mockWhyBuy["default"]
  const priceHistory = mockPriceHistory[brand.name] || mockPriceHistory["default"]
  const regionalVal = mockRegionalValuation[brand.name] || mockRegionalValuation["default"]
  const marketPulse = mockMarketPulse[brand.name] || mockMarketPulse["default"]
  const ownershipCost = mockOwnershipCost[brand.name] || mockOwnershipCost["default"]
  const topModels = mockTopModels[brand.name] || mockTopModels["default"]
  const depth = mockMarketDepth[brand.name] || mockMarketDepth["default"]

  const totalAnnualCost = ownershipCost.insurance + ownershipCost.storage + ownershipCost.maintenance
  const brand5yReturn = Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)

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
      default: return "text-[#6B7280]"
    }
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">

        {/* 1. BRAND OVERVIEW */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-2">
            <Shield className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              {t("brandContext.overview")}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed text-[#9CA3AF]">
            {whyBuy}
          </p>
        </div>

        {/* 2. PRICE SUMMARY */}
        <div className="px-5 py-3 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">Grade</span>
              <p className={`text-[16px] font-bold ${
                brand.topGrade === "AAA" ? "text-positive" : "text-[#F8B4D9]"
              }`}>{brand.topGrade}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">{t("brandContext.minPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(brand.priceMin, selectedRegion)}</p>
            </div>
            <div>
              <span className="text-[8px] text-[#6B7280] uppercase tracking-wider">{t("brandContext.maxPrice")}</span>
              <p className="text-[13px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(brand.priceMax, selectedRegion)}</p>
            </div>
          </div>
        </div>

        {/* 3. VALUATION BY MARKET — improved readability */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-4">
            <Globe className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Valuation by Market
            </span>
          </div>
          <div className="space-y-2.5">
            {(["US", "UK", "EU", "JP"] as const).map((region) => {
              const val = regionalVal[region]
              if (!val) return null
              const pctChange = Math.round(((val.current - val.start) / val.start) * 100)
              const maxCurrent = Math.max(...Object.values(regionalVal).map(v => v.current))
              const barWidth = (val.current / maxCurrent) * 100
              const isSelected = region === effectiveRegion
              return (
                <div key={region} className={isSelected ? "rounded-lg bg-[rgba(248,180,217,0.04)] -mx-2 px-2 py-1.5" : ""}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[12px]">{REGION_FLAGS[region]}</span>
                      <span className={`text-[11px] font-medium ${isSelected ? "text-[#F8B4D9]" : "text-[#D1D5DB]"}`}>{REGION_LABELS[region]}</span>
                      {isSelected && <span className="text-[8px] font-bold text-[#F8B4D9] tracking-wide">YOUR MARKET</span>}
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-[11px] font-mono font-semibold text-[#FFFCF7]">
                        {formatRegionalVal(val.start, val.symbol)}
                      </span>
                      <span className="text-[9px] text-[#6B7280]">→</span>
                      <span className="text-[11px] font-mono font-semibold text-[#F8B4D9]">
                        {formatRegionalVal(val.current, val.symbol)}
                      </span>
                      <span className="text-[10px] font-mono font-bold text-positive">+{pctChange}%</span>
                    </div>
                  </div>
                  {region !== effectiveRegion && (
                    <div className="flex justify-end mb-1">
                      <span className="text-[9px] font-mono text-[#6B7280]">
                        {formatUsdEquiv(val.usdCurrent)} USD
                      </span>
                    </div>
                  )}
                  <div className="h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isSelected ? "bg-gradient-to-r from-[#F8B4D9]/40 to-[#F8B4D9]/70" : "bg-gradient-to-r from-[#F8B4D9]/25 to-[#F8B4D9]/50"}`}
                      style={{ width: `${barWidth}%` }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* 4. PERFORMANCE VS BENCHMARKS */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              5-Year Return Comparison
            </span>
          </div>
          <div className="space-y-2.5">
            {/* Brand itself */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <span className="text-[11px] font-semibold text-[#F8B4D9]">{brand.name}</span>
                <span className="text-[11px] font-mono font-bold text-positive">+{brand5yReturn}%</span>
              </div>
              <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                <div className="h-full rounded-full bg-[#F8B4D9]/50" style={{ width: `${Math.min((brand5yReturn / Math.max(brand5yReturn, 50)) * 100, 100)}%` }} />
              </div>
            </div>
            {/* Benchmarks */}
            {BENCHMARKS.map((b) => (
              <div key={b.label}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] text-[#9CA3AF]">{b.label}</span>
                  <span className="text-[11px] font-mono text-[#6B7280]">+{b.return5y}%</span>
                </div>
                <div className="h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                  <div className="h-full rounded-full bg-white/10" style={{ width: `${Math.min((b.return5y / Math.max(brand5yReturn, 50)) * 100, 100)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 5. TOP MODELS */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Car className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Top Models
            </span>
          </div>
          <div className="space-y-2">
            {topModels.map((model) => (
              <div key={model.name} className="flex items-center justify-between py-1.5 border-b border-white/[0.03] last:border-0">
                <div className="flex-1 min-w-0">
                  <span className="text-[11px] font-medium text-[#FFFCF7]">{model.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-[11px] font-mono font-semibold text-[#F8B4D9]">
                    {formatPriceForRegion(model.avgPrice, selectedRegion)}
                  </span>
                  <span className={`text-[9px] font-bold ${gradeColor(model.grade)}`}>
                    {model.grade}
                  </span>
                  <span className="text-[9px] font-mono text-positive w-8 text-right">
                    {model.trend}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 6. YEAR-BY-YEAR TREND */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                {t("brandContext.fiveYearTrend")}
              </span>
            </div>
            <span className="text-[10px] font-mono font-semibold text-positive">
              {brand.avgTrend}
            </span>
          </div>
          <YearByYearChart data={priceHistory} />
        </div>

        {/* 7. RECENT SALES */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <DollarSign className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Recent Sales
            </span>
          </div>
          <div className="space-y-2">
            {marketPulse.map((sale, i) => (
              <div key={i} className="flex items-center gap-3 py-1.5 border-b border-white/[0.03] last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-[#D1D5DB] truncate">{sale.title}</p>
                  <p className="text-[9px] text-[#6B7280] mt-0.5">{sale.platform} · {sale.date}</p>
                </div>
                <span className="text-[12px] font-mono font-semibold text-[#FFFCF7] shrink-0">
                  {formatPriceForRegion(sale.price, selectedRegion)}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* 8. LIQUIDITY & MARKET DEPTH */}
        <div className="px-5 py-4 border-b border-white/5 bg-[rgba(248,180,217,0.03)]">
          <div className="flex items-center gap-2 mb-3">
            <Gauge className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Liquidity & Market Depth
            </span>
          </div>
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Auctions / Year</span>
              <span className="text-[12px] font-mono font-semibold text-[#FFFCF7]">{depth.auctionsPerYear}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Avg Days to Sell</span>
              <span className="text-[12px] font-mono font-semibold text-[#FFFCF7]">{depth.avgDaysToSell}d</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-[#9CA3AF]">Sell-Through Rate</span>
              <span className="text-[12px] font-mono font-semibold text-positive">{depth.sellThroughRate}%</span>
            </div>
            {/* Demand score visual */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-[11px] text-[#9CA3AF]">Demand Score</span>
                <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{depth.demandScore}/10</span>
              </div>
              <div className="flex gap-1">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div
                    key={i}
                    className={`h-[6px] flex-1 rounded-sm ${
                      i < depth.demandScore ? "bg-[#F8B4D9]/50" : "bg-white/[0.04]"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 9. OWNERSHIP COST */}
        <div className="px-5 py-4 border-b border-white/5">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="size-4 text-[#F8B4D9]" />
            <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
              Annual Ownership Cost
            </span>
          </div>
          <div className="space-y-2">
            {[
              { label: "Insurance", value: ownershipCost.insurance },
              { label: "Storage", value: ownershipCost.storage },
              { label: "Maintenance", value: ownershipCost.maintenance },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between">
                <span className="text-[11px] text-[#9CA3AF]">{item.label}</span>
                <span className="text-[11px] font-mono text-[#D1D5DB]">{formatPriceForRegion(item.value, selectedRegion)}</span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-white/5">
              <span className="text-[11px] font-medium text-[#FFFCF7]">Total</span>
              <span className="text-[12px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(totalAnnualCost, selectedRegion)}/yr</span>
            </div>
          </div>
        </div>

        {/* 10. SIMILAR BRANDS */}
        {similarBrands.length > 0 && (
          <div className="px-5 py-4">
            <div className="flex items-center gap-2 mb-2">
              <Award className="size-4 text-[#F8B4D9]" />
              <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                {t("brandContext.similarBrands")}
              </span>
            </div>
            <div className="space-y-1.5">
              {similarBrands.map((b) => (
                <Link
                  key={b.slug}
                  href={`/cars/${b.slug}`}
                  className="flex items-center justify-between py-1.5 rounded-lg hover:bg-white/[0.03] transition-colors px-1 -mx-1 group"
                >
                  <span className="text-[11px] font-medium text-[#FFFCF7] group-hover:text-[#F8B4D9] transition-colors">
                    {b.name}
                  </span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-mono text-[#6B7280]">
                      {formatPriceForRegion(b.priceMin, selectedRegion)}–{formatPriceForRegion(b.priceMax, selectedRegion)}
                    </span>
                    <span className={`text-[9px] font-bold ${
                      b.topGrade === "AAA" ? "text-positive" : "text-[#F8B4D9]"
                    }`}>{b.topGrade}</span>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* CTA — pinned bottom */}
      <div className="shrink-0 px-5 py-3 border-t border-white/5">
        <Link
          href={`/cars/${brand.slug}`}
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-all"
        >
          {t("brandContext.explore", { brand: brand.name })}
          <ChevronRight className="size-4" />
        </Link>
      </div>
    </div>
  )
}

// ─── MAIN COMPONENT ───
export function DashboardClient({ auctions }: { auctions: Auction[] }) {
  const [currentIndex, setCurrentIndex] = useState(0)
  const { selectedRegion } = useRegion()
  const t = useTranslations("dashboard")
  const feedRef = useRef<HTMLDivElement>(null)

  // Filter auctions by region FIRST, then aggregate
  const filteredAuctions = useMemo(() => {
    if (!selectedRegion) return auctions
    return auctions.filter(a => a.region === selectedRegion)
  }, [auctions, selectedRegion])

  // Aggregate filtered auctions into brands
  const brands = useMemo(() => aggregateBrands(filteredAuctions), [filteredAuctions])

  // Reset index when region changes
  useEffect(() => {
    setCurrentIndex(0)
    feedRef.current?.scrollTo({ top: 0 })
  }, [selectedRegion])

  const selectedBrand = brands[currentIndex] || brands[0]

  // Card height = 100vh - 80px
  const getCardHeight = () => typeof window !== "undefined" ? window.innerHeight - 80 : 800

  // Handle scroll snap to update current index (Desktop)
  useEffect(() => {
    const container = feedRef.current
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      const slideHeight = getCardHeight()
      const newIndex = Math.round(scrollTop / slideHeight)
      if (newIndex !== currentIndex && newIndex >= 0 && newIndex < brands.length) {
        setCurrentIndex(newIndex)
      }
    }

    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [currentIndex, brands.length])

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

  if (!selectedBrand) return null

  return (
    <>
      {/* ═══ MOBILE LAYOUT — Vertical Scrollable Feed ═══ */}
      <div className="md:hidden min-h-[100dvh] w-full bg-[#0b0b10] pt-14">
        {/* Sticky region pills */}
        <MobileRegionPills />

        {/* Scrollable vertical feed */}
        <div className="pb-24">
          {brands.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-[60dvh] px-8 text-center">
              <Globe className="size-8 text-[#4B5563] mb-3" />
              <p className="text-[14px] text-[#6B7280]">{t("mobileFeed.noBrands")}</p>
            </div>
          ) : (
            <>
              {/* Hero: first brand */}
              <MobileHeroBrand brand={brands[0]} />

              {/* Section: All Brands */}
              {brands.length > 1 && (
                <div className="mt-2">
                  <div className="px-4 py-3 flex items-center justify-between">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#6B7280]">
                      {t("mobileFeed.brands")}
                    </span>
                    <span className="text-[10px] font-mono text-[#6B7280]">{brands.length}</span>
                  </div>
                  <div className="divide-y divide-white/5">
                    {brands.slice(1).map((brand) => (
                      <MobileBrandRow key={brand.slug} brand={brand} />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Live Auctions */}
              <MobileLiveAuctions auctions={filteredAuctions} />
            </>
          )}
        </div>
      </div>

      {/* ═══ DESKTOP LAYOUT (3-column) ═══ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-[#0b0b10] overflow-hidden pt-[80px]">
        {/* 3-COLUMN LAYOUT */}
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">
          {/* COLUMN A: DISCOVERY SIDEBAR (22%) */}
          <DiscoverySidebar
            auctions={filteredAuctions}
            brands={brands}
            onSelectBrand={scrollToBrand}
            activeBrandSlug={selectedBrand?.slug}
          />

          {/* COLUMN B: BRAND FEED (50%) */}
          <div
            ref={feedRef}
            className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar scroll-smooth"
          >
            {brands.map((brand) => (
              <BrandCard key={brand.slug} brand={brand} />
            ))}
          </div>

          {/* COLUMN C: CONTEXT PANEL (28%) */}
          <div className="h-full overflow-hidden border-l border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.5)]">
            <BrandContextPanel brand={selectedBrand} allBrands={brands} />
          </div>
        </div>
      </div>
    </>
  )
}
