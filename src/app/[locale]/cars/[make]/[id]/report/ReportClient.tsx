"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import Image from "next/image"
import { Link } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { useTranslations } from "next-intl"
import {
  ArrowLeft,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Shield,
  Wrench,
  MapPin,
  Car,
  Gauge,
  Cog,
  AlertTriangle,
  HelpCircle,
  FileText,
  Users,
  Truck,
  CheckCircle2,
  Lock,
  Coins,
  BarChart3,
  DollarSign,
  Copy,
  Check,
  Target,
  Eye,
  Award,
  Globe,
  History,
  Clock,
  Download,
  Factory,
  Settings,
  Search,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import type { DbMarketDataRow, DbComparableRow, DbAnalysisRow, DbSoldRecord } from "@/lib/db/queries"
import { useRegion } from "@/lib/RegionContext"
import { formatPriceForRegion, formatRegionalPrice as fmtRegional, toUsd, formatUsd, getFairValueForRegion, convertFromUsd } from "@/lib/regionPricing"
import { useTokens } from "@/hooks/useTokens"

// ─── MOCK DATA (same as CarDetailClient) ───
const redFlags: Record<string, string[]> = {
  McLaren: [
    "Central driving position requires specialist knowledge",
    "BMW V12 servicing limited to certified facilities",
    "Gold foil heat shielding integrity critical",
    "Monocoque carbon fiber inspection mandatory",
  ],
  Porsche: [
    "Chain tensioner failure risk on early models",
    "Heat exchanger condition critical; rust inspection required",
    "Galvanized vs non-galvanized body impacts value",
    "Verify matching numbers engine and transmission",
  ],
  Ferrari: [
    "Cam belt service history critical ($5,000+ if overdue)",
    "Sticky interior switches common; verify all electronics",
    "Classiche rejection significantly impacts resale",
    "Exhaust manifold cracks require specialist repair",
  ],
  Lamborghini: [
    "Carburetors require specialized tuning",
    "Clutch replacement labor-intensive (~$8,000+)",
    "Cooling system prone to issues in traffic",
    "Frame susceptible to stress cracks",
  ],
  Nissan: [
    "ATTESA E-TS pump failure common",
    "RB26 head gasket issues if previously tuned",
    "Rust in rear quarters common on JDM imports",
    "Verify legal import status and compliance",
  ],
  default: [
    "Request comprehensive service history",
    "Verify VIN matches title and body panels",
    "Check for evidence of previous accident damage",
    "Confirm mileage with service records",
  ],
}

const sellerQuestions: Record<string, string[]> = {
  McLaren: [
    "Is the original tool kit and owner's documentation complete?",
    "When was the last McLaren Special Operations service?",
    "Has the monocoque been inspected for stress fractures?",
    "What is the history of the BMW engine servicing?",
  ],
  Porsche: [
    "When was the last valve adjustment performed?",
    "Has the vehicle been used in motorsport?",
    "Are the date codes correct on all glass?",
    "Has the transmission been rebuilt?",
  ],
  Ferrari: [
    "Is Classiche certification obtainable?",
    "When was the last cam belt service?",
    "Are all tools and books present?",
    "Has the car ever been repainted?",
  ],
  default: [
    "Is a pre-purchase inspection permitted?",
    "What is the complete service history?",
    "Are there any known mechanical issues?",
    "What is included in the sale?",
  ],
}

const ownershipCosts: Record<string, { insurance: number; storage: number; maintenance: number }> = {
  McLaren: { insurance: 45000, storage: 12000, maintenance: 25000 },
  Porsche: { insurance: 8500, storage: 6000, maintenance: 8000 },
  Ferrari: { insurance: 18000, storage: 8000, maintenance: 15000 },
  Lamborghini: { insurance: 15000, storage: 8000, maintenance: 12000 },
  Nissan: { insurance: 4500, storage: 3600, maintenance: 3500 },
  Toyota: { insurance: 3200, storage: 3600, maintenance: 2500 },
  BMW: { insurance: 3800, storage: 3600, maintenance: 4000 },
  "Mercedes-Benz": { insurance: 6500, storage: 4800, maintenance: 6000 },
  "Aston Martin": { insurance: 8000, storage: 6000, maintenance: 10000 },
  Lexus: { insurance: 6000, storage: 4800, maintenance: 4500 },
  Ford: { insurance: 5500, storage: 4200, maintenance: 4000 },
  Acura: { insurance: 3000, storage: 3600, maintenance: 2800 },
  Jaguar: { insurance: 4500, storage: 4200, maintenance: 5000 },
  default: { insurance: 5000, storage: 4800, maintenance: 5000 },
}

const comparableSales: Record<string, { title: string; price: number; date: string; platform: string; delta: number }[]> = {
  McLaren: [
    { title: "1994 McLaren F1", price: 20_500_000, date: "Aug 2025", platform: "RM Sotheby's", delta: 8 },
    { title: "1995 McLaren F1", price: 19_800_000, date: "May 2025", platform: "Gooding", delta: 5 },
    { title: "1996 McLaren F1", price: 18_200_000, date: "Jan 2025", platform: "Bonhams", delta: -3 },
  ],
  Porsche: [
    { title: "1973 911 Carrera RS 2.7", price: 1_450_000, date: "Oct 2025", platform: "RM Sotheby's", delta: 12 },
    { title: "1973 911 Carrera RS", price: 1_320_000, date: "Jul 2025", platform: "Gooding", delta: 8 },
    { title: "1972 911 2.7 RS", price: 1_180_000, date: "Apr 2025", platform: "BaT", delta: 5 },
  ],
  Ferrari: [
    { title: "1990 Ferrari F40", price: 2_850_000, date: "Nov 2025", platform: "RM Sotheby's", delta: 10 },
    { title: "1989 Ferrari F40", price: 2_650_000, date: "Aug 2025", platform: "Gooding", delta: 7 },
    { title: "1991 Ferrari F40", price: 2_450_000, date: "May 2025", platform: "Bonhams", delta: 3 },
  ],
  default: [
    { title: "Similar Model (Recent)", price: 125_000, date: "Nov 2025", platform: "BaT", delta: 5 },
    { title: "Similar Model (Mid-Year)", price: 118_000, date: "Jul 2025", platform: "C&B", delta: 3 },
  ],
}

const eventsData: Record<string, { name: string; type: string; impact: "positive" | "neutral" | "negative" }[]> = {
  McLaren: [
    { name: "Pebble Beach Concours", type: "Show", impact: "positive" },
    { name: "Gordon Murray Documentary Release", type: "Media", impact: "positive" },
    { name: "McLaren F1 Owners Club Annual Meet", type: "Community", impact: "positive" },
  ],
  Porsche: [
    { name: "Rennsport Reunion", type: "Event", impact: "positive" },
    { name: "Luftgekühlt", type: "Show", impact: "positive" },
    { name: "911 60th Anniversary", type: "Milestone", impact: "positive" },
  ],
  Ferrari: [
    { name: "Ferrari Cavalcade", type: "Event", impact: "positive" },
    { name: "Maranello Factory Tour Program", type: "Experience", impact: "neutral" },
    { name: "Classiche Certification Backlog", type: "Service", impact: "negative" },
  ],
  default: [
    { name: "Monterey Car Week", type: "Event", impact: "positive" },
    { name: "Barrett-Jackson Scottsdale", type: "Auction", impact: "neutral" },
  ],
}

const shippingCosts: Record<string, { domestic: number; euImport: number; ukImport: number }> = {
  McLaren: { domestic: 3500, euImport: 18000, ukImport: 15000 },
  Porsche: { domestic: 1800, euImport: 8500, ukImport: 7000 },
  Ferrari: { domestic: 2500, euImport: 12000, ukImport: 10000 },
  default: { domestic: 1500, euImport: 6000, ukImport: 5000 },
}

const BENCHMARKS = [
  { label: "S&P 500", return5y: 42 },
  { label: "Gold", return5y: 28 },
  { label: "Real Estate", return5y: 18 },
]

// ─── PRODUCTION & HERITAGE DATA ───
const productionData: Record<string, { yearsProduced: string; totalBuilt: number; variants: { name: string; units: number; priceRange: string }[]; lhd: number; rhd: number; keyStat: string }> = {
  McLaren: {
    yearsProduced: "1992–1998",
    totalBuilt: 106,
    variants: [
      { name: "Standard", units: 64, priceRange: "$18M–$22M" },
      { name: "LM", units: 5, priceRange: "$25M+" },
      { name: "GTR", units: 28, priceRange: "$8M–$12M" },
      { name: "S / High Downforce", units: 9, priceRange: "$20M+" },
    ],
    lhd: 72,
    rhd: 34,
    keyStat: "Only 64 road cars built — the ultimate driver's hypercar",
  },
  Porsche: {
    yearsProduced: "1963–Present (911)",
    totalBuilt: 1500000,
    variants: [
      { name: "Carrera RS 2.7", units: 1580, priceRange: "$900K–$1.5M" },
      { name: "930 Turbo", units: 21589, priceRange: "$120K–$250K" },
      { name: "993 GT2", units: 194, priceRange: "$1.2M–$2M" },
      { name: "997 GT3 RS 4.0", units: 600, priceRange: "$450K–$650K" },
    ],
    lhd: 0,
    rhd: 0,
    keyStat: "Air-cooled models (pre-1998) command the strongest premiums",
  },
  Ferrari: {
    yearsProduced: "1987–1992 (F40)",
    totalBuilt: 1315,
    variants: [
      { name: "F40 Standard", units: 1274, priceRange: "$2.2M–$3.5M" },
      { name: "F40 LM", units: 19, priceRange: "$5M–$8M" },
      { name: "F40 GTE", units: 10, priceRange: "$6M+" },
      { name: "F40 Competizione", units: 12, priceRange: "$4M–$6M" },
    ],
    lhd: 1150,
    rhd: 165,
    keyStat: "Last Ferrari signed off by Enzo himself",
  },
  Lamborghini: {
    yearsProduced: "1966–1973 (Miura)",
    totalBuilt: 764,
    variants: [
      { name: "P400", units: 275, priceRange: "$1.2M–$1.8M" },
      { name: "P400 S", units: 140, priceRange: "$1.5M–$2.2M" },
      { name: "P400 SV", units: 150, priceRange: "$2.5M–$4M" },
      { name: "P400 SVJ", units: 5, priceRange: "$5M+" },
    ],
    lhd: 700,
    rhd: 64,
    keyStat: "The car that invented the supercar category",
  },
  Nissan: {
    yearsProduced: "1989–2002 (R32/R33/R34)",
    totalBuilt: 58532,
    variants: [
      { name: "R32 GT-R", units: 43934, priceRange: "$80K–$180K" },
      { name: "R33 GT-R", units: 8136, priceRange: "$70K–$150K" },
      { name: "R34 GT-R", units: 6462, priceRange: "$200K–$500K" },
      { name: "R34 V-Spec II Nür", units: 750, priceRange: "$400K–$800K" },
    ],
    lhd: 2000,
    rhd: 56532,
    keyStat: "R34 became legal in the US (25-year rule) driving prices 3x",
  },
  BMW: {
    yearsProduced: "1978–Present (M-cars)",
    totalBuilt: 500000,
    variants: [
      { name: "E30 M3", units: 17970, priceRange: "$60K–$150K" },
      { name: "E30 M3 Sport Evo", units: 600, priceRange: "$200K–$350K" },
      { name: "E28 M5", units: 2241, priceRange: "$50K–$100K" },
      { name: "E46 M3 CSL", units: 1383, priceRange: "$100K–$180K" },
    ],
    lhd: 0,
    rhd: 0,
    keyStat: "E30 M3 Sport Evolution is the holy grail of BMW collecting",
  },
  default: {
    yearsProduced: "Varies",
    totalBuilt: 5000,
    variants: [
      { name: "Standard", units: 4000, priceRange: "Varies" },
      { name: "Special Edition", units: 800, priceRange: "Varies" },
      { name: "Limited", units: 200, priceRange: "Premium" },
    ],
    lhd: 0,
    rhd: 0,
    keyStat: "Limited production numbers support long-term value",
  },
}

// ─── TECHNICAL DEEP-DIVE DATA ───
const technicalData: Record<string, { engineDetails: { spec: string; value: string }[]; knownIssues: { issue: string; severity: "critical" | "moderate" | "minor"; repairCost: string }[]; serviceIntervals: { item: string; interval: string; cost: string }[] }> = {
  McLaren: {
    engineDetails: [
      { spec: "Configuration", value: "BMW S70/2 60° V12" },
      { spec: "Displacement", value: "6,064 cc" },
      { spec: "Power", value: "618 bhp @ 7,400 rpm" },
      { spec: "Torque", value: "480 lb-ft @ 5,600 rpm" },
      { spec: "Compression", value: "10.5:1" },
      { spec: "Redline", value: "7,500 rpm" },
    ],
    knownIssues: [
      { issue: "Gold foil heat shielding delamination", severity: "critical", repairCost: "$50,000+" },
      { issue: "Main bearing wear at high mileage", severity: "critical", repairCost: "$30,000+" },
      { issue: "A/C compressor failure (Nippondenso)", severity: "moderate", repairCost: "$8,000" },
      { issue: "Window regulator cable stretch", severity: "minor", repairCost: "$2,500" },
    ],
    serviceIntervals: [
      { item: "Engine oil & filter", interval: "Every 6,000 mi", cost: "$2,500" },
      { item: "Major service (belts, fluids)", interval: "Every 12,000 mi", cost: "$15,000" },
      { item: "Full engine-out service", interval: "Every 6 years", cost: "$45,000" },
    ],
  },
  Porsche: {
    engineDetails: [
      { spec: "Configuration", value: "Air-Cooled Flat-6" },
      { spec: "Displacement", value: "2,687–3,600 cc" },
      { spec: "Power", value: "210–450 bhp (model dependent)" },
      { spec: "Torque", value: "188–369 lb-ft" },
      { spec: "Cooling", value: "Air-cooled (pre-1998)" },
      { spec: "Fuel System", value: "Mechanical/CIS Injection" },
    ],
    knownIssues: [
      { issue: "Chain tensioner failure (Mezger engines)", severity: "critical", repairCost: "$12,000" },
      { issue: "IMS bearing failure (M96/M97)", severity: "critical", repairCost: "$8,000" },
      { issue: "Heat exchanger rust-through", severity: "moderate", repairCost: "$3,500" },
      { issue: "Valve guide wear (high-mileage)", severity: "moderate", repairCost: "$6,000" },
    ],
    serviceIntervals: [
      { item: "Oil change & filter", interval: "Every 6,000 mi", cost: "$500" },
      { item: "Valve adjustment", interval: "Every 15,000 mi", cost: "$1,800" },
      { item: "Major service (belts, hoses)", interval: "Every 30,000 mi", cost: "$4,500" },
    ],
  },
  Ferrari: {
    engineDetails: [
      { spec: "Configuration", value: "Twin-Turbo V8 (F40)" },
      { spec: "Displacement", value: "2,936 cc" },
      { spec: "Power", value: "478 bhp @ 7,000 rpm" },
      { spec: "Torque", value: "425 lb-ft @ 4,000 rpm" },
      { spec: "Boost Pressure", value: "1.1 bar" },
      { spec: "Construction", value: "Tubular steel, Kevlar/carbon body" },
    ],
    knownIssues: [
      { issue: "Cam belt failure (catastrophic if overdue)", severity: "critical", repairCost: "$5,000" },
      { issue: "Sticky interior switch syndrome", severity: "moderate", repairCost: "$3,000" },
      { issue: "Exhaust manifold cracking", severity: "moderate", repairCost: "$8,000" },
      { issue: "Turbo wastegate actuator wear", severity: "minor", repairCost: "$4,000" },
    ],
    serviceIntervals: [
      { item: "Engine oil & filter", interval: "Every 6,000 mi", cost: "$800" },
      { item: "Cam belt replacement", interval: "Every 3 years / 18,000 mi", cost: "$5,000" },
      { item: "Major engine service", interval: "Every 5 years", cost: "$12,000" },
    ],
  },
  default: {
    engineDetails: [
      { spec: "Configuration", value: "Inline / V-type" },
      { spec: "Displacement", value: "Model specific" },
      { spec: "Power", value: "Model specific" },
      { spec: "Torque", value: "Model specific" },
    ],
    knownIssues: [
      { issue: "Age-related seal and gasket degradation", severity: "moderate", repairCost: "$2,000–$5,000" },
      { issue: "Electrical system aging (relays, grounds)", severity: "moderate", repairCost: "$1,000–$3,000" },
      { issue: "Cooling system component fatigue", severity: "minor", repairCost: "$800–$2,000" },
    ],
    serviceIntervals: [
      { item: "Oil change & filter", interval: "Every 5,000 mi", cost: "$300–$800" },
      { item: "Major service", interval: "Every 30,000 mi", cost: "$2,000–$5,000" },
    ],
  },
}

// ─── CONDITION GUIDE DATA (Bodywork / Interior / Inspection) ───
const conditionData: Record<string, { rustAreas: { area: string; severity: "high" | "medium" | "low" }[]; interiorIssues: { item: string; commonProblem: string; partAvailability: "easy" | "moderate" | "rare" }[]; inspectionPriorities: string[] }> = {
  McLaren: {
    rustAreas: [
      { area: "Monocoque tub (carbon fiber — check for delamination)", severity: "high" },
      { area: "Suspension pickup points (aluminum corrosion)", severity: "medium" },
      { area: "Engine bay heat shield area", severity: "medium" },
    ],
    interiorIssues: [
      { item: "Leather seat bolsters", commonProblem: "Wear on driver's side entry point", partAvailability: "rare" },
      { item: "Center console switches", commonProblem: "Fading/cracking due to heat", partAvailability: "rare" },
      { item: "Headliner", commonProblem: "Sagging in tropical climates", partAvailability: "moderate" },
    ],
    inspectionPriorities: [
      "Full monocoque inspection with ultrasound",
      "Gold foil heat shielding integrity check",
      "Windshield seal condition (unique curved glass)",
      "Door mechanism and dihedral hinge wear",
      "Complete electrical system diagnostic",
    ],
  },
  Porsche: {
    rustAreas: [
      { area: "Front trunk floor and battery box", severity: "high" },
      { area: "Rear quarter panels and kidney area", severity: "high" },
      { area: "Door bottoms and rocker panels", severity: "medium" },
      { area: "Targa bar (Targa models)", severity: "medium" },
    ],
    interiorIssues: [
      { item: "Dashboard top", commonProblem: "Cracking and warping from UV exposure", partAvailability: "moderate" },
      { item: "Door panel pockets", commonProblem: "Sagging and deformation", partAvailability: "easy" },
      { item: "Seat heating elements", commonProblem: "Failure on Sport Seats", partAvailability: "moderate" },
    ],
    inspectionPriorities: [
      "Galvanized vs non-galvanized body check (pre-1976 at risk)",
      "Heater channel and sill inspection",
      "Cylinder head leaks (check between fins)",
      "Transmission synchro condition (2nd and 3rd gear)",
      "Rear trailing arm bushing condition",
    ],
  },
  Ferrari: {
    rustAreas: [
      { area: "Tubular steel frame (hidden by body panels)", severity: "high" },
      { area: "Door sill panels", severity: "medium" },
      { area: "Underbody crossmembers", severity: "medium" },
    ],
    interiorIssues: [
      { item: "Leather dashboard", commonProblem: "Shrinkage and cracking", partAvailability: "moderate" },
      { item: "Switchgear", commonProblem: "Sticky surface coating degradation", partAvailability: "easy" },
      { item: "Carpet and trim", commonProblem: "Fading from UV exposure", partAvailability: "moderate" },
    ],
    inspectionPriorities: [
      "Frame rail and structural tube inspection",
      "Cam belt service date verification (critical)",
      "Classiche certification eligibility check",
      "All body panel fit and gap alignment",
      "Brake system (Brembo) pad and rotor condition",
    ],
  },
  Nissan: {
    rustAreas: [
      { area: "Rear wheel arches and quarters", severity: "high" },
      { area: "Front chassis rails", severity: "high" },
      { area: "Boot/trunk floor", severity: "medium" },
      { area: "Strut tower tops", severity: "medium" },
    ],
    interiorIssues: [
      { item: "Dashboard", commonProblem: "Cracking on top surface (R32/R33)", partAvailability: "rare" },
      { item: "Boost gauge and MFD", commonProblem: "LCD pixel failure", partAvailability: "rare" },
      { item: "Seat bolsters", commonProblem: "Wear on entry points", partAvailability: "moderate" },
    ],
    inspectionPriorities: [
      "ATTESA E-TS system full diagnostic",
      "RB26 compression and leak-down test",
      "Turbo shaft play and boost response",
      "Import compliance and title verification",
      "Underbody rust inspection (salt road exposure)",
    ],
  },
  default: {
    rustAreas: [
      { area: "Rocker panels and sills", severity: "high" },
      { area: "Wheel arches", severity: "medium" },
      { area: "Trunk/boot floor", severity: "medium" },
      { area: "Door bottoms", severity: "low" },
    ],
    interiorIssues: [
      { item: "Dashboard", commonProblem: "Cracking and fading", partAvailability: "moderate" },
      { item: "Seat leather/fabric", commonProblem: "Wear on bolsters", partAvailability: "easy" },
      { item: "Headliner", commonProblem: "Sagging from adhesive failure", partAvailability: "easy" },
    ],
    inspectionPriorities: [
      "Full structural and chassis inspection",
      "Engine compression and leak-down test",
      "Complete electrical system check",
      "Brake system inspection",
      "Fluid analysis (oil, coolant, transmission)",
    ],
  },
}

const mockPriceHistory: Record<string, number[]> = {
  Porsche: [180000, 210000, 245000, 290000, 320000],
  Ferrari: [450000, 520000, 580000, 640000, 720000],
  McLaren: [12000000, 13500000, 15000000, 17000000, 19500000],
  Lamborghini: [280000, 310000, 350000, 400000, 460000],
  BMW: [65000, 78000, 92000, 108000, 125000],
  Nissan: [85000, 110000, 145000, 180000, 220000],
  Toyota: [75000, 95000, 120000, 145000, 175000],
  "Mercedes-Benz": [320000, 350000, 380000, 420000, 470000],
  "Aston Martin": [400000, 440000, 480000, 520000, 580000],
  Lexus: [350000, 380000, 410000, 440000, 490000],
  Ford: [280000, 310000, 340000, 380000, 420000],
  Acura: [100000, 115000, 135000, 155000, 180000],
  Jaguar: [120000, 130000, 145000, 160000, 180000],
  default: [150000, 170000, 195000, 220000, 250000],
}

const platformLabels: Record<string, { short: string; color: string }> = {
  BRING_A_TRAILER: { short: "BaT", color: "bg-amber-500/20 text-amber-400" },
  CARS_AND_BIDS: { short: "C&B", color: "bg-blue-500/20 text-blue-400" },
  COLLECTING_CARS: { short: "CC", color: "bg-purple-500/20 text-purple-400" },
  RM_SOTHEBYS: { short: "RM", color: "bg-rose-500/20 text-rose-400" },
  GOODING: { short: "Gooding", color: "bg-emerald-500/20 text-emerald-400" },
  BONHAMS: { short: "Bonhams", color: "bg-cyan-500/20 text-cyan-400" },
}

const regionLabels: Record<string, { flag: string; short: string }> = {
  US: { flag: "🇺🇸", short: "US" },
  EU: { flag: "🇪🇺", short: "EU" },
  UK: { flag: "🇬🇧", short: "UK" },
  JP: { flag: "🇯🇵", short: "JP" },
}

// ─── HELPERS ───
function timeLeft(endTime: Date): string {
  const diff = endTime.getTime() - Date.now()
  if (diff <= 0) return "Ended"
  const days = Math.floor(diff / 86400000)
  const hrs = Math.floor((diff % 86400000) / 3600000)
  if (days > 0) return `${days}d ${hrs}h`
  const mins = Math.floor((diff % 3600000) / 60000)
  return `${hrs}h ${mins}m`
}

function findBestRegion(pricing: CollectorCar["fairValueByRegion"]): string {
  const regions = ["US", "EU", "UK", "JP"] as const
  let best: string = "US"
  let bestAvg = Infinity
  for (const r of regions) {
    const p = pricing[r]
    const avg = toUsd((p.low + p.high) / 2, p.currency)
    if (avg < bestAvg) { bestAvg = avg; best = r }
  }
  return best
}

// ─── SECTION IDS for scroll-spy ───
const SECTION_IDS = [
  "summary",
  "identity",
  "production",
  "valuation",
  "performance",
  "technical",
  "risk",
  "condition",
  "dueDiligence",
  "ownership",
  "marketContext",
  "similar",
  "verdict",
] as const

type SectionId = typeof SECTION_IDS[number]

const SECTION_ICONS: Record<SectionId, React.ComponentType<{ className?: string }>> = {
  summary: Sparkles,
  identity: Car,
  production: Factory,
  valuation: Globe,
  performance: TrendingUp,
  technical: Settings,
  risk: AlertTriangle,
  condition: Search,
  dueDiligence: HelpCircle,
  ownership: DollarSign,
  marketContext: BarChart3,
  similar: Users,
  verdict: Award,
}

// ═══════════════════════════════════════════════════════════════
// ─── MAIN COMPONENT ───
// ═══════════════════════════════════════════════════════════════
export function ReportClient({ car, similarCars, dbMarketData, dbMarketDataBrand = [], dbComparables = [], dbAnalysis, dbSoldHistory = [], dbAnalyses = [] }: {
  car: CollectorCar
  similarCars: CollectorCar[]
  dbMarketData?: DbMarketDataRow | null
  dbMarketDataBrand?: DbMarketDataRow[]
  dbComparables?: DbComparableRow[]
  dbAnalysis?: DbAnalysisRow | null
  dbSoldHistory?: DbSoldRecord[]
  dbAnalyses?: DbAnalysisRow[]
}) {
  const t = useTranslations("investmentReport")
  const tPricing = useTranslations("pricing")
  const { selectedRegion, effectiveRegion } = useRegion()

  // Scroll-spy state
  const [activeSection, setActiveSection] = useState<SectionId>("summary")
  const sectionRefs = useRef<Record<SectionId, HTMLElement | null>>(
    Object.fromEntries(SECTION_IDS.map(id => [id, null])) as Record<SectionId, HTMLElement | null>
  )

  // Token system
  const {
    user,
    isRegistered,
    isLoading: tokensLoading,
    tokens,
    consumeForAnalysis,
    hasAnalyzed,
    addTokens,
    setPlan,
  } = useTokens()

  const [hasAccess, setHasAccess] = useState(false)
  const [copiedQuestions, setCopiedQuestions] = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [purchaseProcessing, setPurchaseProcessing] = useState<string | null>(null)
  const [purchaseSuccess, setPurchaseSuccess] = useState(false)
  const [downloadingPdf, setDownloadingPdf] = useState(false)
  const [downloadingExcel, setDownloadingExcel] = useState(false)
  const [showDownloadSheet, setShowDownloadSheet] = useState(false)

  // Check access on mount
  useEffect(() => {
    if (!tokensLoading) {
      setHasAccess(hasAnalyzed(car.id))
    }
  }, [tokensLoading, car.id, hasAnalyzed])

  const handleUnlock = () => {
    if (hasAnalyzed(car.id)) {
      setHasAccess(true)
      return
    }
    const success = consumeForAnalysis(car.id)
    if (success) {
      setHasAccess(true)
    } else {
      setShowPricing(true)
    }
  }

  const handlePurchase = (planId: "single" | "explorer" | "unlimited") => {
    setPurchaseProcessing(planId)
    setTimeout(() => {
      const tokensToAdd = planId === "single" ? 1000 : planId === "explorer" ? 5000 : 999000
      addTokens(tokensToAdd)
      setPlan(planId)
      consumeForAnalysis(car.id)
      setPurchaseProcessing(null)
      setPurchaseSuccess(true)
      setTimeout(() => {
        setPurchaseSuccess(false)
        setShowPricing(false)
        setHasAccess(true)
      }, 1500)
    }, 1500)
  }

  // ─── COMPUTED DATA (DB-first, fallback to hardcoded) ───
  const isLive = car.status === "ACTIVE" || car.status === "ENDING_SOON"

  // Red flags & questions: prefer DB analysis
  const flags = (dbAnalysis?.redFlags?.length ?? 0) > 0
    ? dbAnalysis!.redFlags : (redFlags[car.make] || redFlags.default)
  const questions = (dbAnalysis?.criticalQuestions?.length ?? 0) > 0
    ? dbAnalysis!.criticalQuestions : (sellerQuestions[car.make] || sellerQuestions.default)

  // Ownership costs: prefer DB analysis
  const fallbackCosts = ownershipCosts[car.make] || ownershipCosts.default
  const costs = {
    insurance: dbAnalysis?.insuranceEstimate ?? fallbackCosts.insurance,
    storage: fallbackCosts.storage,
    maintenance: dbAnalysis?.yearlyMaintenance ?? fallbackCosts.maintenance,
  }

  // Comparable sales: prefer DB
  const comps = dbComparables.length > 0
    ? dbComparables.map(c => ({
        title: c.title,
        price: c.soldPrice,
        date: c.soldDate ? new Date(c.soldDate).toLocaleDateString("en-US", { month: "short", year: "numeric" }) : "N/A",
        platform: c.platform === "BRING_A_TRAILER" ? "BaT" : c.platform === "CARS_AND_BIDS" ? "C&B" : c.platform === "COLLECTING_CARS" ? "CC" : c.platform,
        delta: dbMarketData?.avgPrice ? Math.round(((c.soldPrice - dbMarketData.avgPrice) / dbMarketData.avgPrice) * 100) : 0,
      }))
    : (comparableSales[car.make] || comparableSales.default)

  const events = eventsData[car.make] || eventsData.default
  const shipping = shippingCosts[car.make] || shippingCosts.default
  const totalAnnualCost = costs.insurance + costs.storage + costs.maintenance
  const platform = platformLabels[car.platform]

  const production = productionData[car.make] || productionData.default
  const technical = technicalData[car.make] || technicalData.default
  const condition = conditionData[car.make] || conditionData.default

  // Fair value: prefer DB market data for range
  const regionRange = getFairValueForRegion(car.fairValueByRegion, selectedRegion)
  const fairLow = dbMarketData?.lowPrice ?? regionRange.low
  const fairHigh = dbMarketData?.highPrice ?? regionRange.high
  const bidInRegion = convertFromUsd(car.currentBid, regionRange.currency)
  const pricePosition = fairHigh > fairLow
    ? Math.min(Math.max(((bidInRegion - fairLow) / (fairHigh - fairLow)) * 100, 0), 100) : 50
  const isBelowFair = bidInRegion < (fairLow + fairHigh) / 2

  const pricing = car.fairValueByRegion
  const bestRegion = findBestRegion(pricing)
  const maxRegionalUsd = Math.max(
    ...(["US", "EU", "UK", "JP"] as const).map(r =>
      toUsd((pricing[r].low + pricing[r].high) / 2, pricing[r].currency)
    )
  )

  // Price history: prefer DB sold records
  const priceHistory = (() => {
    if (dbSoldHistory.length >= 3) {
      const now = new Date()
      const years = [0, 1, 2, 3, 4].map(i => now.getFullYear() - 4 + i)
      const buckets = years.map(yr => {
        const sales = dbSoldHistory.filter(s => new Date(s.date).getFullYear() === yr)
        return sales.length > 0 ? Math.round(sales.reduce((sum, s) => sum + s.price, 0) / sales.length) : null
      })
      const filled = [...buckets]
      for (let i = 0; i < filled.length; i++) {
        if (filled[i] == null) {
          const prev = filled.slice(0, i).reverse().find(v => v != null)
          const next = filled.slice(i + 1).find(v => v != null)
          filled[i] = prev ?? next ?? car.currentBid
        }
      }
      return filled as number[]
    }
    return mockPriceHistory[car.make] || mockPriceHistory.default
  })()
  const brand5yReturn = Math.round(((priceHistory[priceHistory.length - 1] - priceHistory[0]) / priceHistory[0]) * 100)
  const cagr = (Math.pow(priceHistory[priceHistory.length - 1] / priceHistory[0], 1 / 5) - 1) * 100

  // Risk score: prefer DB confidence, fallback to grade-based
  const riskScore = dbAnalysis?.confidence === "HIGH" ? 25 :
    dbAnalysis?.confidence === "MEDIUM" ? 45 :
    dbAnalysis?.confidence === "LOW" ? 70 :
    car.investmentGrade === "AAA" ? 25 : car.investmentGrade === "AA" ? 35 : car.investmentGrade === "A" ? 50 : 65

  // Verdict logic
  const verdict = isBelowFair && car.investmentGrade <= "AA" ? "buy" :
    isBelowFair ? "hold" :
    pricePosition > 70 ? "watch" : "hold"

  // Arbitrage: difference between cheapest and most expensive region
  const cheapestRegionAvgUsd = toUsd(
    (pricing[bestRegion as keyof typeof pricing].low + pricing[bestRegion as keyof typeof pricing].high) / 2,
    pricing[bestRegion as keyof typeof pricing].currency
  )
  const arbitrageSavings = maxRegionalUsd - cheapestRegionAvgUsd
  const hasArbitrage = arbitrageSavings > car.currentBid * 0.05

  // ─── SCROLL SPY ───
  const handleScrollSpy = useCallback(() => {
    const offset = 120
    let current: SectionId = "summary"
    for (const id of SECTION_IDS) {
      const el = sectionRefs.current[id]
      if (el) {
        const rect = el.getBoundingClientRect()
        if (rect.top <= offset) current = id
      }
    }
    setActiveSection(current)
  }, [])

  useEffect(() => {
    window.addEventListener("scroll", handleScrollSpy, { passive: true })
    return () => window.removeEventListener("scroll", handleScrollSpy)
  }, [handleScrollSpy])

  const scrollToSection = (id: SectionId) => {
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" })
  }

  const setSectionRef = (id: SectionId) => (el: HTMLElement | null) => {
    sectionRefs.current[id] = el
  }

  // Copy questions to clipboard
  const handleCopyQuestions = () => {
    navigator.clipboard.writeText(questions.join("\n"))
    setCopiedQuestions(true)
    setTimeout(() => setCopiedQuestions(false), 2000)
  }

  // ─── PDF DOWNLOAD (pure jsPDF — no html2canvas) ───
  const handleDownloadPdf = async () => {
    setDownloadingPdf(true)
    try {
      const jsPDFModule = await import("jspdf")
      const jsPDF = jsPDFModule.default || jsPDFModule.jsPDF

      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
      const W = 210
      const H = 297
      const M = 15 // margin
      const CW = W - M * 2 // content width
      let pg = 0

      // ─── Helpers ───
      const bg = () => { pdf.setFillColor(11, 11, 16); pdf.rect(0, 0, W, H, "F") }
      const pink = () => pdf.setTextColor(248, 180, 217)
      const white = () => pdf.setTextColor(255, 252, 247)
      const gray = () => pdf.setTextColor(130, 130, 140)
      const dim = () => pdf.setTextColor(90, 90, 100)
      const accentBar = () => { pdf.setFillColor(248, 180, 217); pdf.rect(0, 0, W, 1.2, "F") }

      const clientName = user?.name || "Valued Client"
      const firstName = clientName.split(" ")[0]

      const chrome = (title: string) => {
        pg++
        accentBar()
        pdf.setFontSize(7); dim()
        pdf.text("MONZA LAB", M, 8)
        pdf.text(title.toUpperCase(), W - M, 8, { align: "right" })
        pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.15)
        pdf.line(M, 11, W - M, 11)
        pdf.line(M, H - 12, W - M, H - 12)
        pdf.setFontSize(6.5); dim()
        pdf.text(`Prepared for ${clientName}`, M, H - 7)
        pdf.text(`${pg}`, W - M, H - 7, { align: "right" })
      }

      const sectionTitle = (num: number, title: string, y: number) => {
        pdf.setFontSize(7); pink()
        pdf.text(`SECTION ${String(num).padStart(2, "0")}`, M, y)
        pdf.setFontSize(14); white()
        pdf.text(title, M, y + 7)
        pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.3)
        pdf.line(M, y + 10, M + 25, y + 10)
        return y + 16
      }

      const label = (text: string, x: number, y: number) => {
        pdf.setFontSize(7); dim(); pdf.text(text.toUpperCase(), x, y)
      }
      const value = (text: string, x: number, y: number, color?: "pink" | "white" | "green" | "red") => {
        pdf.setFontSize(10)
        if (color === "pink") pink()
        else if (color === "green") pdf.setTextColor(52, 211, 153)
        else if (color === "red") pdf.setTextColor(248, 113, 113)
        else white()
        pdf.text(text, x, y)
      }
      const row = (k: string, v: string, y: number) => {
        pdf.setFontSize(8); gray(); pdf.text(k, M, y)
        pdf.setFontSize(8); white(); pdf.text(v, M + 75, y)
        return y + 5.5
      }
      const bullet = (text: string, y: number, color?: "pink" | "green" | "red") => {
        pdf.setFontSize(7)
        if (color === "pink") pink()
        else if (color === "green") pdf.setTextColor(52, 211, 153)
        else if (color === "red") pdf.setTextColor(248, 113, 113)
        else gray()
        pdf.text("●", M, y)
        pdf.setFontSize(8); white()
        const lines = pdf.splitTextToSize(text, CW - 6)
        pdf.text(lines, M + 5, y)
        return y + lines.length * 4.2
      }

      // ═══ PAGE 1: COVER ═══
      bg()
      pdf.setFillColor(248, 180, 217); pdf.rect(0, 0, W, 2, "F")
      pdf.setFontSize(8); pink(); pdf.text("MONZA LAB", M, 20)
      pdf.setFontSize(7); dim()
      pdf.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), W - M, 20, { align: "right" })
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.5); pdf.line(M, 100, M + 40, 100)
      pdf.setFontSize(11); pink(); pdf.text("INVESTMENT DOSSIER", M, 112)
      pdf.setFontSize(30); white()
      const tLines = pdf.splitTextToSize(car.title, CW)
      pdf.text(tLines, M, 127)
      const tEnd = 127 + tLines.length * 11
      pdf.setFontSize(9); gray()
      pdf.text(`Grade: ${car.investmentGrade}    Trend: ${car.trend}    5yr: +${brand5yReturn}%`, M, tEnd + 10)
      const vy = tEnd + 22
      pdf.setFillColor(verdict === "buy" ? 52 : 59, verdict === "buy" ? 211 : 130, verdict === "buy" ? 153 : 246)
      pdf.rect(M, vy - 4, 26, 8, "F")
      pdf.setFontSize(8); pdf.setTextColor(11, 11, 16)
      pdf.text(verdict.toUpperCase(), M + 13, vy + 1, { align: "center" })
      gray(); pdf.text(`Risk: ${riskScore}/100  |  CAGR: ${cagr.toFixed(1)}%  |  Cost: $${totalAnnualCost.toLocaleString()}/yr`, M + 30, vy + 1)
      // Personalized "Prepared for" — prominent
      const prepY = vy + 24
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.2); pdf.line(M, prepY, M + 20, prepY)
      pdf.setFontSize(8); dim(); pdf.text("PREPARED EXCLUSIVELY FOR", M, prepY + 7)
      pdf.setFontSize(18); white(); pdf.text(clientName, M, prepY + 17)
      pdf.setFontSize(8); gray()
      pdf.text(new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }), M, prepY + 24)
      // Financial box
      const bY = 220
      pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.3); pdf.rect(M, bY, CW, 38, "S")
      label("CURRENT BID", M + 8, bY + 9); label("FAIR VALUE (USD)", M + 65, bY + 9); label("BEST REGION", M + 135, bY + 9)
      pdf.setFontSize(12); pink(); pdf.text(`$${car.currentBid.toLocaleString()}`, M + 8, bY + 21)
      white(); pdf.text(`$${pricing.US.low.toLocaleString()} – $${pricing.US.high.toLocaleString()}`, M + 65, bY + 21)
      pdf.text(regionLabels[bestRegion]?.short || "US", M + 135, bY + 21)
      pdf.setDrawColor(40, 40, 50); pdf.line(M + 58, bY + 3, M + 58, bY + 35); pdf.line(M + 128, bY + 3, M + 128, bY + 35)
      pdf.setFontSize(6.5); dim(); pdf.text("CONFIDENTIAL", M, H - 15); pdf.text("monzalab.com", W - M, H - 15, { align: "right" })
      pdf.setFillColor(248, 180, 217); pdf.rect(0, H - 2, W, 2, "F")

      const secNames = ["Executive Summary", "Vehicle Identity", "Production & Heritage", "Regional Valuation", "Performance & Returns", "Technical Deep-Dive", "Risk Assessment", "Condition Guide", "Due Diligence", "Ownership Economics", "Market Context", "Similar Vehicles", "Final Verdict"]

      // ═══ PAGE 2: PERSONAL LETTER ═══
      pdf.addPage(); bg(); chrome("Welcome")
      // Decorative top line
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.4)
      pdf.line(M, 22, M + 20, 22)
      // Greeting
      pdf.setFontSize(22); white()
      pdf.text(`Dear ${firstName},`, M, 38)
      // Letter body
      pdf.setFontSize(10); pdf.setTextColor(180, 180, 190)
      const letterBody = [
        `Thank you for trusting Monza Lab with your investment analysis of the ${car.title}.`,
        "",
        "We understand that acquiring a collector vehicle is more than a financial decision — it's a deeply personal one. Every car tells a story, and the right one becomes part of yours.",
        "",
        `This dossier was prepared exclusively for you. Inside, you'll find a comprehensive analysis covering ${secNames.length} key dimensions: from regional valuation and arbitrage opportunities to technical deep-dives, condition assessments, and our final investment verdict.`,
        "",
        "Our goal is simple: to give you the clarity and confidence to make the best decision — whether that's bidding today or waiting for the right moment.",
        "",
        "We're honored to be part of your journey.",
      ]
      let ly = 50
      letterBody.forEach(line => {
        if (line === "") { ly += 4; return }
        const wrapped = pdf.splitTextToSize(line, CW)
        pdf.text(wrapped, M, ly)
        ly += wrapped.length * 5
      })
      // Signature
      ly += 10
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.3)
      pdf.line(M, ly, M + 15, ly)
      ly += 8
      pdf.setFontSize(10); pink()
      pdf.text("The Monza Lab Team", M, ly)
      pdf.setFontSize(8); gray()
      pdf.text("monzalab.com", M, ly + 6)
      // Bottom decorative element
      pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.15)
      pdf.line(M, H - 40, W - M, H - 40)
      pdf.setFontSize(7); dim()
      pdf.text("\"The best investment you can make is an informed one.\"", W / 2, H - 33, { align: "center" })

      // ═══ PAGE 3: TABLE OF CONTENTS ═══
      pdf.addPage(); bg(); chrome("Contents")
      pdf.setFontSize(18); white(); pdf.text("Contents", M, 30)
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.4); pdf.line(M, 34, M + 28, 34)
      secNames.forEach((name, i) => {
        const y = 44 + i * 14
        pdf.setFontSize(8); pink(); pdf.text(String(i + 1).padStart(2, "0"), M, y)
        pdf.setFontSize(10); white(); pdf.text(name, M + 12, y)
        pdf.setDrawColor(50, 50, 60); pdf.setLineWidth(0.1); pdf.line(M + 80, y, W - M - 12, y)
        pdf.setFontSize(8); dim(); pdf.text(String(i + 3), W - M - 3, y, { align: "right" })
      })

      // ─── Card helper: dark card with border like the web ───
      const card = (x: number, y: number, w: number, h: number) => {
        pdf.setFillColor(15, 14, 22); pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.08)
        // Fill + very faint white border (simulates border-white/5)
        pdf.rect(x, y, w, h, "F")
        pdf.setDrawColor(40, 40, 50); pdf.rect(x, y, w, h, "S")
      }
      // Badge helper: colored pill
      const badge = (text: string, x: number, y: number, bgR: number, bgG: number, bgB: number, txR: number, txG: number, txB: number) => {
        const tw = pdf.getTextWidth(text) + 4
        pdf.setFillColor(bgR, bgG, bgB); pdf.rect(x, y - 3, tw, 5, "F")
        pdf.setFontSize(6.5); pdf.setTextColor(txR, txG, txB); pdf.text(text, x + 2, y + 0.5)
        return tw
      }
      // Card row: key-value inside a card context
      const cardRow = (k: string, v: string, x: number, y: number, w: number) => {
        pdf.setFontSize(7.5); gray(); pdf.text(k, x + 4, y)
        pdf.setFontSize(7.5); white(); pdf.text(v, x + w - 4, y, { align: "right" })
        pdf.setDrawColor(30, 30, 40); pdf.setLineWidth(0.08); pdf.line(x + 4, y + 1.5, x + w - 4, y + 1.5)
        return y + 5.5
      }

      // ═══ PAGE 4: EXECUTIVE SUMMARY ═══
      pdf.addPage(); bg(); chrome("Executive Summary")
      let y = sectionTitle(1, "Executive Summary", 16)
      // 6-metric card grid (3 cols x 2 rows)
      const mData = [
        { lbl: "INVESTMENT GRADE", val: car.investmentGrade, clr: car.investmentGrade === "AAA" ? [52,211,153] : car.investmentGrade === "AA" ? [96,165,250] : [251,191,36] },
        { lbl: "CURRENT PRICE", val: `$${car.currentBid.toLocaleString()}`, clr: [248,180,217] },
        { lbl: "FAIR VALUE", val: `$${pricing.US.low.toLocaleString()} – $${pricing.US.high.toLocaleString()}`, clr: [255,252,247] },
        { lbl: "5-YEAR RETURN", val: `+${brand5yReturn}%`, clr: brand5yReturn > 0 ? [52,211,153] : [248,113,113] },
        { lbl: "RISK SCORE", val: `${riskScore}/100`, clr: riskScore < 35 ? [52,211,153] : riskScore < 55 ? [248,180,217] : [248,113,113] },
        { lbl: "ANNUAL COST", val: `$${totalAnnualCost.toLocaleString()}`, clr: [255,252,247] },
      ]
      const mw = (CW - 6) / 3
      mData.forEach((m, i) => {
        const col = i % 3; const rw = Math.floor(i / 3)
        const mx = M + col * (mw + 3); const my = y + rw * 22
        card(mx, my, mw, 19)
        pdf.setFontSize(6); dim(); pdf.text(m.lbl, mx + 4, my + 6)
        pdf.setFontSize(m.val.length > 20 ? 9 : 13); pdf.setTextColor(m.clr[0], m.clr[1], m.clr[2])
        pdf.text(m.val, mx + 4, my + 14)
      })
      y += 50

      // Thesis card
      card(M, y, CW, 24)
      pdf.setFontSize(6); dim(); pdf.text("INVESTMENT THESIS", M + 4, y + 5)
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.3); pdf.line(M + 4, y + 7, M + 18, y + 7)
      pdf.setFontSize(8); white()
      const thesisLines = pdf.splitTextToSize(car.thesis || "—", CW - 8)
      pdf.text(thesisLines, M + 4, y + 12)
      y += 30

      // Price position gauge card
      card(M, y, CW, 22)
      pdf.setFontSize(6); dim(); pdf.text("PRICE POSITION IN FAIR RANGE", M + 4, y + 5)
      // Gradient bar: green → pink → red
      const gY = y + 9; const gW = CW - 8
      for (let gi = 0; gi < gW; gi++) {
        const pct = gi / gW
        const r = pct < 0.5 ? Math.round(52 + (248 - 52) * pct * 2) : Math.round(248 + (248 - 248) * (pct - 0.5) * 2)
        const g = pct < 0.5 ? Math.round(211 + (180 - 211) * pct * 2) : Math.round(180 + (113 - 180) * (pct - 0.5) * 2)
        const b = pct < 0.5 ? Math.round(153 + (217 - 153) * pct * 2) : Math.round(217 + (113 - 217) * (pct - 0.5) * 2)
        pdf.setFillColor(r, g, b); pdf.rect(M + 4 + gi, gY, 1.2, 4, "F")
      }
      // Position dot
      const dotX = M + 4 + (pricePosition / 100) * gW
      pdf.setFillColor(255, 255, 255); pdf.circle(dotX, gY + 2, 2.5, "F")
      pdf.setFillColor(248, 180, 217); pdf.circle(dotX, gY + 2, 1.8, "F")
      pdf.setFontSize(6); gray()
      pdf.text(fmtRegional(fairLow, regionRange.currency), M + 4, gY + 9)
      pdf.text(fmtRegional(fairHigh, regionRange.currency), M + 4 + gW, gY + 9, { align: "right" })
      pdf.setFontSize(7); white(); pdf.text(`${pricePosition.toFixed(0)}%`, dotX, gY + 9, { align: "center" })
      y += 28

      // ═══ PAGE 5: VEHICLE IDENTITY ═══
      pdf.addPage(); bg(); chrome("Vehicle Identity")
      y = sectionTitle(2, "Vehicle Identity", 16)
      // Specs card (2 columns)
      const specs = [
        ["Year", String(car.year)], ["Make", car.make], ["Model", car.model], ["Trim", car.trim || "—"],
        ["Engine", car.engine], ["Transmission", car.transmission],
        ["Mileage", `${car.mileage.toLocaleString()} ${car.mileageUnit}`], ["Location", car.location],
      ]
      const halfW = (CW - 4) / 2
      card(M, y, halfW, specs.length / 2 * 5.5 + 6)
      card(M + halfW + 4, y, halfW, specs.length / 2 * 5.5 + 6)
      specs.forEach((s, i) => {
        const col = i < specs.length / 2 ? 0 : 1
        const ri = col === 0 ? i : i - specs.length / 2
        const sx = col === 0 ? M : M + halfW + 4
        y = Math.max(y, y) // keep y stable
        cardRow(s[0], s[1], sx, y + 5 + ri * 5.5, halfW)
      })
      y += specs.length / 2 * 5.5 + 10

      // Auction info card
      card(M, y, CW, 22)
      pdf.setFontSize(6); dim(); pdf.text("AUCTION STATUS", M + 4, y + 5)
      const statClr = isLive ? [52, 211, 153] : [130, 130, 140]
      pdf.setFillColor(statClr[0], statClr[1], statClr[2]); pdf.circle(M + 4 + 47, y + 4.5, 1, "F")
      pdf.setFontSize(7); pdf.setTextColor(statClr[0], statClr[1], statClr[2]); pdf.text(car.status, M + 50, y + 5)
      pdf.setFontSize(8); pink(); pdf.text(`$${car.currentBid.toLocaleString()}`, M + 4, y + 12)
      pdf.setFontSize(7); gray(); pdf.text(`${car.bidCount} bids · ${car.platform.replace(/_/g, " ")}`, M + 4, y + 17)
      y += 28

      // History card
      card(M, y, CW, 28)
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.4); pdf.line(M, y, M, y + 28)
      pdf.setFontSize(6); dim(); pdf.text("HISTORY & PROVENANCE", M + 5, y + 5)
      pdf.setFontSize(8); white()
      const histLines = pdf.splitTextToSize(car.history || "—", CW - 10)
      pdf.text(histLines, M + 5, y + 11)

      // ═══ PAGE 6: PRODUCTION & HERITAGE ═══
      pdf.addPage(); bg(); chrome("Production & Heritage")
      y = sectionTitle(3, "Production & Heritage", 16)
      // Key stat callout card (pink tint)
      pdf.setFillColor(25, 18, 24); pdf.rect(M, y, CW, 12, "F")
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.3); pdf.rect(M, y, CW, 12, "S")
      pdf.setFontSize(8); pink(); pdf.text(production.keyStat, M + 4, y + 7.5)
      y += 18
      // Stats grid (3 cards)
      const pCards = [
        { lbl: "YEARS PRODUCED", val: production.yearsProduced },
        { lbl: "TOTAL BUILT", val: production.totalBuilt.toLocaleString() },
        { lbl: "STEERING", val: production.lhd > 0 ? `${production.lhd} LHD / ${production.rhd} RHD` : "Varies" },
      ]
      const pw = (CW - 6) / 3
      pCards.forEach((pc, i) => {
        const px = M + i * (pw + 3)
        card(px, y, pw, 16)
        pdf.setFontSize(6); dim(); pdf.text(pc.lbl, px + 4, y + 5)
        pdf.setFontSize(10); white(); pdf.text(pc.val, px + 4, y + 12)
      })
      y += 22
      // Variant bars
      card(M, y, CW, 8 + production.variants.length * 11)
      pdf.setFontSize(6); dim(); pdf.text("VARIANT BREAKDOWN", M + 4, y + 5)
      const maxUnits = Math.max(...production.variants.map(v => v.units))
      production.variants.forEach((v, i) => {
        const vy = y + 10 + i * 11
        pdf.setFontSize(8); white(); pdf.text(v.name, M + 4, vy)
        pdf.setFontSize(7); gray(); pdf.text(`${v.units.toLocaleString()} units`, M + 4, vy + 4)
        pink(); pdf.text(v.priceRange, W - M - 4, vy, { align: "right" })
        // Bar
        const bw = Math.max((v.units / maxUnits) * (CW - 8), 4)
        pdf.setFillColor(248, 180, 217); pdf.rect(M + 4, vy + 5.5, bw, 2.5, "F")
        pdf.setFillColor(40, 40, 50); pdf.rect(M + 4 + bw, vy + 5.5, CW - 8 - bw, 2.5, "F")
      })

      // ═══ PAGE 7: REGIONAL VALUATION ═══
      pdf.addPage(); bg(); chrome("Regional Valuation")
      y = sectionTitle(4, "Regional Valuation", 16)
      // Regional bars card
      card(M, y, CW, 6 + 4 * 16)
      pdf.setFontSize(6); dim(); pdf.text("REGIONAL FAIR VALUE COMPARISON", M + 4, y + 5)
      ;(["US", "EU", "UK", "JP"] as const).forEach((r, i) => {
        const ry = y + 10 + i * 16
        const rp = pricing[r]
        const avgUsd = toUsd((rp.low + rp.high) / 2, rp.currency)
        const barPct = maxRegionalUsd > 0 ? (avgUsd / maxRegionalUsd) * 100 : 50
        const isBest = r === bestRegion
        // Label row
        pdf.setFontSize(9); if (isBest) pink(); else white()
        pdf.text(regionLabels[r].short, M + 4, ry)
        if (isBest) badge("BEST BUY", M + 18, ry, 20, 60, 45, 52, 211, 153)
        pdf.setFontSize(7); gray()
        pdf.text(`${fmtRegional(rp.low, rp.currency)} – ${fmtRegional(rp.high, rp.currency)}`, W - M - 4, ry, { align: "right" })
        // Bar
        const bw = (barPct / 100) * (CW - 8)
        pdf.setFillColor(30, 30, 40); pdf.rect(M + 4, ry + 3, CW - 8, 3.5, "F")
        pdf.setFillColor(isBest ? 52 : 248, isBest ? 211 : 180, isBest ? 153 : 217)
        pdf.rect(M + 4, ry + 3, bw, 3.5, "F")
        pdf.setFontSize(6); dim(); pdf.text(`$${Math.round(avgUsd).toLocaleString()}`, M + 4, ry + 10)
      })
      y += 6 + 4 * 16 + 4

      // Gauge card
      card(M, y, CW, 22)
      pdf.setFontSize(6); dim(); pdf.text("MARKET POSITION", M + 4, y + 5)
      const g2Y = y + 9; const g2W = CW - 8
      for (let gi = 0; gi < g2W; gi++) {
        const pct = gi / g2W
        const r2 = pct < 0.5 ? Math.round(52 + (248 - 52) * pct * 2) : Math.round(248 + (248 - 248) * (pct - 0.5) * 2)
        const g2 = pct < 0.5 ? Math.round(211 + (180 - 211) * pct * 2) : Math.round(180 + (113 - 180) * (pct - 0.5) * 2)
        const b2 = pct < 0.5 ? Math.round(153 + (217 - 153) * pct * 2) : Math.round(217 + (113 - 217) * (pct - 0.5) * 2)
        pdf.setFillColor(r2, g2, b2); pdf.rect(M + 4 + gi, g2Y, 1.2, 4, "F")
      }
      const d2X = M + 4 + (pricePosition / 100) * g2W
      pdf.setFillColor(255, 255, 255); pdf.circle(d2X, g2Y + 2, 2.5, "F")
      pdf.setFillColor(248, 180, 217); pdf.circle(d2X, g2Y + 2, 1.8, "F")
      pdf.setFontSize(7)
      if (isBelowFair) { pdf.setTextColor(52, 211, 153); pdf.text("Below fair value — potential opportunity", M + 4, g2Y + 9) }
      else { pdf.setTextColor(251, 191, 36); pdf.text("At or above fair value midpoint", M + 4, g2Y + 9) }
      y += 28

      // Arbitrage card
      if (hasArbitrage) {
        pdf.setFillColor(15, 25, 20); pdf.rect(M, y, CW, 14, "F")
        pdf.setDrawColor(52, 211, 153); pdf.setLineWidth(0.2); pdf.rect(M, y, CW, 14, "S")
        pdf.setFontSize(8); pdf.setTextColor(52, 211, 153)
        pdf.text("ARBITRAGE OPPORTUNITY", M + 4, y + 5)
        pdf.setFontSize(7.5); pdf.setTextColor(160, 170, 165)
        pdf.text(`Buy in ${regionLabels[bestRegion]?.short || bestRegion} — save $${Math.round(arbitrageSavings).toLocaleString()} vs most expensive region`, M + 4, y + 11)
        y += 18
      }

      // ═══ PAGE 8: PERFORMANCE & RETURNS ═══
      pdf.addPage(); bg(); chrome("Performance & Returns")
      y = sectionTitle(5, "Performance & Returns", 16)
      // Area chart card
      card(M, y, CW, 58)
      pdf.setFontSize(6); dim(); pdf.text("5-YEAR PRICE HISTORY", M + 4, y + 5)
      pdf.text(`CAGR: ${cagr.toFixed(1)}%`, M + CW / 2, y + 5); pink(); pdf.text(`5yr: +${brand5yReturn}%`, W - M - 4, y + 5, { align: "right" })
      const maxP = Math.max(...priceHistory)
      const chartX = M + 4; const chartY = y + 10; const chartW2 = CW - 8; const chartH2 = 36
      // Grid lines
      pdf.setDrawColor(30, 30, 40); pdf.setLineWidth(0.08)
      for (let g = 0; g <= 4; g++) { pdf.line(chartX, chartY + (g / 4) * chartH2, chartX + chartW2, chartY + (g / 4) * chartH2) }
      // Area fill: build polygon points, fill row by row
      const pts = priceHistory.map((p, i) => ({
        x: chartX + (i / (priceHistory.length - 1)) * chartW2,
        y: chartY + (1 - p / maxP) * chartH2,
      }))
      // Fill area with pink semi-transparent strips
      for (let si = 0; si < pts.length - 1; si++) {
        const x1 = pts[si].x; const y1 = pts[si].y; const x2 = pts[si + 1].x; const y2 = pts[si + 1].y
        const steps = Math.ceil(x2 - x1)
        for (let s = 0; s < steps; s++) {
          const frac = s / steps
          const cx = x1 + (x2 - x1) * frac
          const cy = y1 + (y2 - y1) * frac
          const h = chartY + chartH2 - cy
          pdf.setFillColor(248, 180, 217); pdf.rect(cx, cy, 1.1, h, "F")
        }
      }
      // Darken area fill to make it semi-transparent look
      pdf.setFillColor(15, 14, 22); pdf.setGState(new (pdf as any).GState({ opacity: 0.75 }))
      for (let si = 0; si < pts.length - 1; si++) {
        const x1 = pts[si].x; const y1 = pts[si].y; const x2 = pts[si + 1].x; const y2 = pts[si + 1].y
        const steps = Math.ceil(x2 - x1)
        for (let s = 0; s < steps; s++) {
          const frac = s / steps
          const cx = x1 + (x2 - x1) * frac
          const cy = y1 + (y2 - y1) * frac
          pdf.rect(cx, cy, 1.1, chartY + chartH2 - cy, "F")
        }
      }
      pdf.setGState(new (pdf as any).GState({ opacity: 1 }))
      // Line
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.5)
      for (let si = 0; si < pts.length - 1; si++) { pdf.line(pts[si].x, pts[si].y, pts[si + 1].x, pts[si + 1].y) }
      // Points
      pts.forEach((pt, i) => {
        pdf.setFillColor(i === pts.length - 1 ? 248 : 15, i === pts.length - 1 ? 180 : 14, i === pts.length - 1 ? 217 : 22)
        pdf.circle(pt.x, pt.y, 1.2, "F")
        pdf.setDrawColor(248, 180, 217); pdf.circle(pt.x, pt.y, 1.2, "S")
      })
      // Labels
      priceHistory.forEach((p, i) => {
        const px = chartX + (i / (priceHistory.length - 1)) * chartW2
        pdf.setFontSize(6); dim(); pdf.text(String(2021 + i), px, chartY + chartH2 + 4, { align: "center" })
        pdf.setFontSize(5.5); white(); pdf.text(formatUsd(p), px, pts[i].y - 2, { align: "center" })
      })
      y += 64

      // Benchmarks card
      const allReturns = [{ label: car.make, ret: brand5yReturn }, ...BENCHMARKS.map(b => ({ label: b.label, ret: b.return5y }))]
      const maxRet = Math.max(...allReturns.map(r => r.ret))
      card(M, y, CW, 8 + allReturns.length * 10)
      pdf.setFontSize(6); dim(); pdf.text("VS. MARKET BENCHMARKS", M + 4, y + 5)
      allReturns.forEach((r, i) => {
        const ry = y + 10 + i * 10
        const isPrimary = r.label === car.make
        pdf.setFontSize(8); if (isPrimary) pink(); else gray(); pdf.text(r.label, M + 4, ry + 2)
        pdf.setFontSize(9); if (isPrimary) pink(); else white(); pdf.text(`+${r.ret}%`, W - M - 4, ry + 2, { align: "right" })
        // Bar
        const bw = Math.max((r.ret / maxRet) * (CW - 8), 3)
        pdf.setFillColor(30, 30, 40); pdf.rect(M + 4, ry + 4, CW - 8, 3, "F")
        pdf.setFillColor(isPrimary ? 248 : 60, isPrimary ? 180 : 60, isPrimary ? 217 : 70)
        pdf.rect(M + 4, ry + 4, bw, 3, "F")
      })

      // ═══ PAGE 9: TECHNICAL DEEP-DIVE ═══
      pdf.addPage(); bg(); chrome("Technical Deep-Dive")
      y = sectionTitle(6, "Technical Deep-Dive", 16)
      // Engine specs grid card
      const specW = (CW - 6) / 3
      card(M, y, CW, 8 + Math.ceil(technical.engineDetails.length / 3) * 16)
      pdf.setFontSize(6); dim(); pdf.text("ENGINE & POWERTRAIN", M + 4, y + 5)
      technical.engineDetails.forEach((d, i) => {
        const col = i % 3; const rw2 = Math.floor(i / 3)
        const ex = M + 4 + col * (specW + 1); const ey = y + 10 + rw2 * 16
        pdf.setFontSize(6); dim(); pdf.text(d.spec.toUpperCase(), ex, ey)
        pdf.setFontSize(9); white(); pdf.text(d.value, ex, ey + 6)
      })
      y += 12 + Math.ceil(technical.engineDetails.length / 3) * 16

      // Issues card
      card(M, y, CW, 7 + technical.knownIssues.length * 10)
      pdf.setFontSize(6); dim(); pdf.text("KNOWN MECHANICAL ISSUES", M + 4, y + 5)
      technical.knownIssues.forEach((iss, i) => {
        const iy = y + 10 + i * 10
        // Severity dot
        const sClr = iss.severity === "critical" ? [248,113,113] : iss.severity === "moderate" ? [251,191,36] : [100,100,110]
        pdf.setFillColor(sClr[0], sClr[1], sClr[2]); pdf.circle(M + 6, iy - 0.5, 1, "F")
        pdf.setFontSize(7.5); white()
        const issText = pdf.splitTextToSize(iss.issue, CW - 45)
        pdf.text(issText, M + 10, iy)
        // Badge
        badge(iss.severity.toUpperCase(), M + CW - 55, iy, sClr[0] > 200 ? 40 : 30, sClr[1] > 150 ? 30 : 25, sClr[2] > 150 ? 25 : 20, sClr[0], sClr[1], sClr[2])
        pdf.setFontSize(7); gray(); pdf.text(iss.repairCost, W - M - 4, iy, { align: "right" })
      })
      y += 11 + technical.knownIssues.length * 10

      // Service schedule card
      card(M, y, CW, 7 + technical.serviceIntervals.length * 6)
      pdf.setFontSize(6); dim(); pdf.text("SERVICE SCHEDULE", M + 4, y + 5)
      technical.serviceIntervals.forEach((s, i) => {
        const sy = y + 10 + i * 6
        pdf.setFontSize(7.5); white(); pdf.text(s.item, M + 4, sy)
        gray(); pdf.text(s.interval, M + CW / 2, sy)
        pink(); pdf.text(s.cost, W - M - 4, sy, { align: "right" })
      })

      // ═══ PAGE 10: RISK ASSESSMENT ═══
      pdf.addPage(); bg(); chrome("Risk Assessment")
      y = sectionTitle(7, "Risk Assessment", 16)
      // Risk gauge card
      card(M, y, CW, 26)
      pdf.setFontSize(6); dim(); pdf.text("RISK SCORE", M + 4, y + 5)
      pdf.setFontSize(20)
      const rsClr = riskScore < 35 ? [52,211,153] : riskScore < 55 ? [248,180,217] : [248,113,113]
      pdf.setTextColor(rsClr[0], rsClr[1], rsClr[2])
      pdf.text(`${riskScore}`, M + 4, y + 16)
      pdf.setFontSize(9); gray(); pdf.text("/100", M + 18, y + 16)
      // Gauge bar
      const rGY = y + 19
      for (let gi = 0; gi < CW - 8; gi++) {
        const pct = gi / (CW - 8)
        const gr = pct < 0.35 ? 52 : pct < 0.55 ? 251 : 248
        const gg = pct < 0.35 ? 211 : pct < 0.55 ? 191 : 113
        const gb = pct < 0.35 ? 153 : pct < 0.55 ? 36 : 113
        pdf.setFillColor(gr, gg, gb); pdf.rect(M + 4 + gi, rGY, 1.2, 3, "F")
      }
      const rDot = M + 4 + (riskScore / 100) * (CW - 8)
      pdf.setFillColor(255, 255, 255); pdf.circle(rDot, rGY + 1.5, 2, "F")
      pdf.setFillColor(rsClr[0], rsClr[1], rsClr[2]); pdf.circle(rDot, rGY + 1.5, 1.3, "F")
      y += 32

      // Red flags card
      card(M, y, CW, 7 + flags.length * 7)
      pdf.setFontSize(6); dim(); pdf.text("RED FLAGS", M + 4, y + 5)
      flags.forEach((f, i) => {
        const fy = y + 11 + i * 7
        pdf.setFillColor(248, 113, 113); pdf.circle(M + 6, fy - 0.5, 0.8, "F")
        pdf.setFontSize(7.5); white()
        const fLines = pdf.splitTextToSize(f, CW - 12)
        pdf.text(fLines, M + 10, fy)
      })

      // ═══ PAGE 11: CONDITION GUIDE ═══
      pdf.addPage(); bg(); chrome("Condition Guide")
      y = sectionTitle(8, "Condition Guide", 16)
      // Rust areas card
      card(M, y, CW, 7 + condition.rustAreas.length * 7)
      pdf.setFontSize(6); dim(); pdf.text("BODYWORK & RUST-PRONE AREAS", M + 4, y + 5)
      condition.rustAreas.forEach((a, i) => {
        const ay = y + 11 + i * 7
        const aClr = a.severity === "high" ? [248,113,113] : a.severity === "medium" ? [251,191,36] : [52,211,153]
        pdf.setFillColor(aClr[0], aClr[1], aClr[2]); pdf.circle(M + 6, ay - 0.5, 0.8, "F")
        pdf.setFontSize(7.5); white(); pdf.text(a.area, M + 10, ay)
        badge(a.severity.toUpperCase(), W - M - 22, ay, aClr[0] > 200 ? 40 : 20, aClr[1] > 150 ? 30 : 25, aClr[2] > 150 ? 25 : 20, aClr[0], aClr[1], aClr[2])
      })
      y += 11 + condition.rustAreas.length * 7 + 4
      // Interior card
      card(M, y, CW, 7 + condition.interiorIssues.length * 10)
      pdf.setFontSize(6); dim(); pdf.text("INTERIOR CONCERNS", M + 4, y + 5)
      condition.interiorIssues.forEach((item, i) => {
        const iy = y + 11 + i * 10
        pdf.setFontSize(8); white(); pdf.text(item.item, M + 4, iy)
        pdf.setFontSize(7); gray(); pdf.text(item.commonProblem, M + 4, iy + 4.5)
        const pClr = item.partAvailability === "rare" ? [248,113,113] : item.partAvailability === "moderate" ? [251,191,36] : [52,211,153]
        badge(`PARTS: ${item.partAvailability.toUpperCase()}`, W - M - 36, iy, pClr[0] > 200 ? 40 : 20, pClr[1] > 150 ? 30 : 25, pClr[2] > 150 ? 25 : 20, pClr[0], pClr[1], pClr[2])
      })
      y += 11 + condition.interiorIssues.length * 10 + 4
      // Inspection priorities card
      card(M, y, CW, 7 + condition.inspectionPriorities.length * 6)
      pdf.setFontSize(6); dim(); pdf.text("INSPECTION PRIORITIES", M + 4, y + 5)
      condition.inspectionPriorities.forEach((p, i) => {
        const py = y + 11 + i * 6
        // Numbered circle
        pdf.setFillColor(248, 180, 217); pdf.circle(M + 7, py - 0.5, 2, "F")
        pdf.setFontSize(6); pdf.setTextColor(11, 11, 16); pdf.text(String(i + 1), M + 7, py + 0.3, { align: "center" })
        pdf.setFontSize(7.5); white(); pdf.text(p, M + 12, py)
      })

      // ═══ PAGE 12: DUE DILIGENCE ═══
      pdf.addPage(); bg(); chrome("Due Diligence")
      y = sectionTitle(9, "Due Diligence", 16)
      // Red flags card
      card(M, y, CW, 7 + flags.length * 7)
      pdf.setFontSize(6); dim(); pdf.text("KEY RISK AREAS", M + 4, y + 5)
      flags.forEach((f, i) => {
        const fy = y + 11 + i * 7
        pdf.setFillColor(248, 113, 113); pdf.circle(M + 6, fy - 0.5, 0.8, "F")
        pdf.setFontSize(7.5); white()
        const fL = pdf.splitTextToSize(f, CW - 12)
        pdf.text(fL, M + 10, fy)
      })
      y += 11 + flags.length * 7 + 4
      // Questions card
      card(M, y, CW, 7 + questions.length * 6.5)
      pdf.setFontSize(6); dim(); pdf.text("QUESTIONS FOR THE SELLER", M + 4, y + 5)
      questions.forEach((q, i) => {
        const qy = y + 11 + i * 6.5
        pdf.setFillColor(248, 180, 217); pdf.circle(M + 7, qy - 0.5, 2, "F")
        pdf.setFontSize(6); pdf.setTextColor(11, 11, 16); pdf.text(String(i + 1), M + 7, qy + 0.3, { align: "center" })
        pdf.setFontSize(7.5); white(); pdf.text(q, M + 12, qy)
      })

      // ═══ PAGE 13: OWNERSHIP ECONOMICS ═══
      pdf.addPage(); bg(); chrome("Ownership Economics")
      y = sectionTitle(10, "Ownership Economics", 16)
      // Annual costs card with bars
      const costItems = [
        { lbl: "Insurance (Agreed Value)", val: costs.insurance },
        { lbl: "Climate-Controlled Storage", val: costs.storage },
        { lbl: "Service & Maintenance", val: costs.maintenance },
      ]
      card(M, y, CW, 7 + costItems.length * 12 + 14)
      pdf.setFontSize(6); dim(); pdf.text("ANNUAL OWNERSHIP COSTS (USD)", M + 4, y + 5)
      costItems.forEach((c, i) => {
        const cy2 = y + 11 + i * 12
        pdf.setFontSize(7.5); white(); pdf.text(c.lbl, M + 4, cy2)
        pink(); pdf.text(`$${c.val.toLocaleString()}`, W - M - 4, cy2, { align: "right" })
        const pct = c.val / totalAnnualCost
        pdf.setFillColor(30, 30, 40); pdf.rect(M + 4, cy2 + 2, CW - 8, 3, "F")
        pdf.setFillColor(248, 180, 217); pdf.rect(M + 4, cy2 + 2, (CW - 8) * pct, 3, "F")
        pdf.setFontSize(6); dim(); pdf.text(`${(pct * 100).toFixed(0)}%`, M + 4, cy2 + 8)
      })
      // Total
      const tY = y + 11 + costItems.length * 12
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.2); pdf.line(M + 4, tY, W - M - 4, tY)
      pdf.setFontSize(8); white(); pdf.text("Total Annual Cost", M + 4, tY + 5)
      pdf.setFontSize(10); pink(); pdf.text(`$${totalAnnualCost.toLocaleString()}`, W - M - 4, tY + 5, { align: "right" })
      pdf.setFontSize(7); gray(); pdf.text(`${((totalAnnualCost / car.currentBid) * 100).toFixed(1)}% of vehicle value`, M + 4, tY + 10)
      y += 11 + costItems.length * 12 + 18

      // Shipping card
      card(M, y, CW, 30)
      pdf.setFontSize(6); dim(); pdf.text("SHIPPING & LOGISTICS (USD)", M + 4, y + 5)
      y += 8
      y = cardRow("Domestic (Enclosed)", `$${shipping.domestic.toLocaleString()}`, M, y, CW)
      y = cardRow("EU Import (incl. duties)", `$${shipping.euImport.toLocaleString()}`, M, y, CW)
      y = cardRow("UK Import (incl. duties)", `$${shipping.ukImport.toLocaleString()}`, M, y, CW)

      // ═══ PAGE 14: MARKET CONTEXT ═══
      pdf.addPage(); bg(); chrome("Market Context")
      y = sectionTitle(11, "Market Context", 16)
      // Events card
      card(M, y, CW, 7 + events.length * 8)
      pdf.setFontSize(6); dim(); pdf.text("UPCOMING EVENTS & CATALYSTS", M + 4, y + 5)
      events.forEach((e, i) => {
        const ey = y + 11 + i * 8
        const eClr = e.impact === "positive" ? [52,211,153] : e.impact === "negative" ? [248,113,113] : [130,130,140]
        pdf.setFillColor(eClr[0], eClr[1], eClr[2]); pdf.circle(M + 6, ey - 0.5, 0.8, "F")
        pdf.setFontSize(7.5); white(); pdf.text(e.name, M + 10, ey)
        pdf.setFontSize(6.5); gray(); pdf.text(e.type, M + 10, ey + 3.5)
        badge(e.impact.toUpperCase(), W - M - 28, ey, eClr[0] > 200 ? 40 : 15, eClr[1] > 150 ? 30 : 25, eClr[2] > 150 ? 25 : 18, eClr[0], eClr[1], eClr[2])
      })
      y += 11 + events.length * 8 + 4

      // Comps card
      card(M, y, CW, 7 + comps.length * 10)
      pdf.setFontSize(6); dim(); pdf.text("COMPARABLE SALES", M + 4, y + 5)
      comps.forEach((s, i) => {
        const sy = y + 11 + i * 10
        pdf.setFontSize(8); white(); pdf.text(s.title, M + 4, sy)
        pdf.setFontSize(7); gray(); pdf.text(`${s.date} · ${s.platform}`, M + 4, sy + 4.5)
        pdf.setFontSize(9); white(); pdf.text(`$${s.price.toLocaleString()}`, W - M - 28, sy, { align: "right" })
        const dClr = s.delta > 0 ? [52,211,153] : [248,113,113]
        badge(`${s.delta > 0 ? "+" : ""}${s.delta}%`, W - M - 22, sy, dClr[0] > 200 ? 40 : 15, dClr[1] > 150 ? 30 : 25, dClr[2] > 150 ? 25 : 18, dClr[0], dClr[1], dClr[2])
      })

      // ═══ PAGE 15: SIMILAR VEHICLES ═══
      pdf.addPage(); bg(); chrome("Similar Vehicles")
      y = sectionTitle(12, "Similar Vehicles", 16)
      const maxSimBid = Math.max(car.currentBid, ...similarCars.map(sc => sc.currentBid))
      similarCars.forEach((sc, i) => {
        card(M, y, CW, 16)
        pdf.setFontSize(8); white(); pdf.text(sc.title, M + 4, y + 5)
        // Grade badge
        const gClr = sc.investmentGrade === "AAA" ? [52,211,153] : sc.investmentGrade === "AA" ? [96,165,250] : [251,191,36]
        badge(sc.investmentGrade, M + 4, y + 10, gClr[0] > 200 ? 20 : 15, gClr[1] > 150 ? 35 : 25, gClr[2] > 150 ? 25 : 15, gClr[0], gClr[1], gClr[2])
        pdf.setFontSize(7); gray(); pdf.text(sc.trend, M + 20, y + 10)
        // Price + bar
        pdf.setFontSize(9); pink(); pdf.text(`$${sc.currentBid.toLocaleString()}`, W - M - 4, y + 5, { align: "right" })
        const sbPct = sc.currentBid / maxSimBid
        pdf.setFillColor(30, 30, 40); pdf.rect(M + 4, y + 12, CW - 8, 2, "F")
        pdf.setFillColor(60, 60, 70); pdf.rect(M + 4, y + 12, (CW - 8) * sbPct, 2, "F")
        y += 20
      })

      // ═══ PAGE 16: FINAL VERDICT ═══
      pdf.addPage(); bg(); chrome("Final Verdict")
      y = sectionTitle(13, "Final Verdict", 16)
      // Large verdict badge
      const vClr = verdict === "buy" ? [52,211,153] : verdict === "hold" ? [251,191,36] : [248,180,217]
      pdf.setFillColor(vClr[0], vClr[1], vClr[2]); pdf.rect(M, y, 55, 18, "F")
      pdf.setFontSize(22); pdf.setTextColor(11, 11, 16)
      pdf.text(verdict.toUpperCase(), M + 27.5, y + 12.5, { align: "center" })
      y += 25
      // Verdict metrics card (3 cols)
      const vMetrics = [
        { lbl: "GRADE", val: car.investmentGrade, clr: car.investmentGrade === "AAA" ? [52,211,153] : car.investmentGrade === "AA" ? [96,165,250] : [251,191,36] },
        { lbl: "5YR RETURN", val: `+${brand5yReturn}%`, clr: brand5yReturn > 0 ? [52,211,153] : [248,113,113] },
        { lbl: "RISK", val: `${riskScore}/100`, clr: rsClr },
      ]
      const vmW = (CW - 6) / 3
      vMetrics.forEach((vm, i) => {
        const vx = M + i * (vmW + 3)
        card(vx, y, vmW, 16)
        pdf.setFontSize(6); dim(); pdf.text(vm.lbl, vx + 4, y + 5)
        pdf.setFontSize(14); pdf.setTextColor(vm.clr[0], vm.clr[1], vm.clr[2])
        pdf.text(vm.val, vx + 4, y + 13)
      })
      y += 22
      // Summary rows card
      card(M, y, CW, 48)
      pdf.setFontSize(6); dim(); pdf.text("SUMMARY", M + 4, y + 5)
      let sy = y + 10
      sy = cardRow("Price Position", `${pricePosition.toFixed(0)}% of fair range`, M, sy, CW)
      sy = cardRow("Below Fair Value?", isBelowFair ? "YES" : "NO", M, sy, CW)
      sy = cardRow("Best Buy Region", regionLabels[bestRegion]?.short || bestRegion, M, sy, CW)
      if (hasArbitrage) { sy = cardRow("Arbitrage Savings", `$${Math.round(arbitrageSavings).toLocaleString()}`, M, sy, CW) }
      sy = cardRow("Annual Cost", `$${totalAnnualCost.toLocaleString()}`, M, sy, CW)
      sy = cardRow("Cost % of Value", `${((totalAnnualCost / car.currentBid) * 100).toFixed(1)}%`, M, sy, CW)
      sy = cardRow("CAGR (5yr)", `${cagr.toFixed(1)}%`, M, sy, CW)

      // ═══ CLOSING PAGE: THANK YOU ═══
      pdf.addPage(); bg()
      // No chrome on this page — clean, personal
      pdf.setFillColor(248, 180, 217); pdf.rect(0, 0, W, 1.2, "F")
      // Centered decorative line
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.4)
      pdf.line(W / 2 - 15, 80, W / 2 + 15, 80)
      // Thank you message
      pdf.setFontSize(24); white()
      pdf.text(`Thank you, ${firstName}.`, W / 2, 100, { align: "center" })
      // Body text
      pdf.setFontSize(10); pdf.setTextColor(160, 160, 170)
      const closingLines = [
        "We hope this dossier gives you the confidence and clarity",
        "to make the right decision at the right time.",
        "",
        "Whether you choose to bid today or continue exploring,",
        "Monza Lab is here to support your journey.",
        "",
        "Great cars find great owners — and we believe",
        `the ${car.title} deserves someone who truly`,
        "understands its value.",
      ]
      let cy = 115
      closingLines.forEach(line => {
        if (line === "") { cy += 5; return }
        pdf.text(line, W / 2, cy, { align: "center" })
        cy += 6
      })
      // Divider
      cy += 12
      pdf.setDrawColor(248, 180, 217); pdf.setLineWidth(0.2)
      pdf.line(W / 2 - 20, cy, W / 2 + 20, cy)
      cy += 12
      // What's next section
      pdf.setFontSize(8); pink()
      pdf.text("WHAT'S NEXT", W / 2, cy, { align: "center" })
      cy += 8
      pdf.setFontSize(9); pdf.setTextColor(160, 160, 170)
      const nextSteps = [
        "Explore more vehicles in our curated marketplace",
        "Generate dossiers for any listing that catches your eye",
        "Compare investment grades across your shortlist",
      ]
      nextSteps.forEach((step, i) => {
        pdf.setFontSize(7); pink(); pdf.text(`${i + 1}`, W / 2 - 45, cy, { align: "center" })
        pdf.setFontSize(9); pdf.setTextColor(160, 160, 170); pdf.text(step, W / 2 - 38, cy)
        cy += 7
      })
      // Brand footer
      pdf.setDrawColor(40, 40, 50); pdf.setLineWidth(0.15)
      pdf.line(M, H - 45, W - M, H - 45)
      pdf.setFontSize(9); pink()
      pdf.text("MONZA LAB", W / 2, H - 36, { align: "center" })
      pdf.setFontSize(7); pdf.setTextColor(100, 100, 110)
      pdf.text("Collector Vehicle Intelligence", W / 2, H - 30, { align: "center" })
      pdf.text("monzalab.com", W / 2, H - 24, { align: "center" })
      // Bottom accent
      pdf.setFillColor(248, 180, 217); pdf.rect(0, H - 2, W, 2, "F")

      // Save
      const carSlug = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
      const userSlug = user?.name ? `_${user.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}` : ""
      pdf.save(`Monza-Dossier_${carSlug}${userSlug}.pdf`)
    } catch (err) {
      console.error("PDF generation failed:", err)
    } finally {
      setDownloadingPdf(false)
    }
  }

  // ─── EXCEL DOWNLOAD ───
  const handleDownloadExcel = async () => {
    setDownloadingExcel(true)
    try {
      const XLSX = await import("xlsx")
      const wb = XLSX.utils.book_new()

      // ═══ Sheet 1: Cover & Summary ═══
      const coverData: (string | number)[][] = [
        ["MONZA LAB — Investment Dossier"],
        [""],
        ["Vehicle", car.title],
        ["Year", car.year],
        ["Make", car.make],
        ["Model", car.model],
        ["Trim", car.trim || "—"],
        [""],
        ["INVESTMENT ANALYSIS"],
        ["Investment Grade", car.investmentGrade],
        ["Verdict", verdict.toUpperCase()],
        ["Current Bid (USD)", car.currentBid],
        ["Fair Value Low (USD)", pricing.US.low],
        ["Fair Value High (USD)", pricing.US.high],
        ["Price Position", `${pricePosition.toFixed(0)}% of fair range`],
        ["Below Fair Value?", isBelowFair ? "YES" : "NO"],
        ["5-Year Brand Return", `${brand5yReturn}%`],
        ["CAGR (5yr)", `${cagr.toFixed(1)}%`],
        ["Risk Score", `${riskScore}/100`],
        ["Total Annual Cost (USD)", totalAnnualCost],
        [""],
        ["VEHICLE DETAILS"],
        ["Engine", car.engine],
        ["Transmission", car.transmission],
        ["Mileage", `${car.mileage.toLocaleString()} ${car.mileageUnit}`],
        ["Platform", car.platform.replace(/_/g, " ")],
        ["Location", car.location],
        ["Region", car.region],
        ["Category", car.category],
        ["Status", car.status],
        ["Bid Count", car.bidCount],
        [""],
        ["ARBITRAGE OPPORTUNITY"],
        ["Best Buy Region", regionLabels[bestRegion]?.short || bestRegion],
        ["Potential Savings (USD)", hasArbitrage ? Math.round(arbitrageSavings) : 0],
        ["Arbitrage Available?", hasArbitrage ? "YES" : "NO"],
        [""],
        [`Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`],
        ...(user?.name ? [[`Prepared for: ${user.name}`]] : []),
        ["CONFIDENTIAL — monzalab.com"],
      ]
      const ws1 = XLSX.utils.aoa_to_sheet(coverData)
      ws1["!cols"] = [{ wch: 28 }, { wch: 45 }]
      // Merge title row
      ws1["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
      XLSX.utils.book_append_sheet(wb, ws1, "Summary")

      // ═══ Sheet 2: Regional Valuation ═══
      const valuationRows: (string | number)[][] = [
        ["REGIONAL FAIR VALUE COMPARISON"],
        [""],
        ["Region", "Currency", "Fair Low", "Fair High", "Fair Average", "Average (USD)", "vs Best Region"],
      ]
      const regions = ["US", "EU", "UK", "JP"] as const
      for (const r of regions) {
        const rp = pricing[r]
        const avg = (rp.low + rp.high) / 2
        const avgUsd = toUsd(avg, rp.currency)
        const bestAvgUsd = toUsd((pricing[bestRegion as keyof typeof pricing].low + pricing[bestRegion as keyof typeof pricing].high) / 2, pricing[bestRegion as keyof typeof pricing].currency)
        const diff = avgUsd - bestAvgUsd
        valuationRows.push([
          `${regionLabels[r].short}${r === bestRegion ? " (BEST)" : ""}`,
          rp.currency,
          rp.low,
          rp.high,
          Math.round(avg),
          Math.round(avgUsd),
          r === bestRegion ? "—" : `+$${Math.round(diff).toLocaleString()}`,
        ])
      }
      valuationRows.push(
        [""],
        ["PRICE POSITION ANALYSIS"],
        ["Current Bid (USD)", car.currentBid],
        ["Position in Fair Range", `${pricePosition.toFixed(0)}%`],
        ["Below Midpoint?", isBelowFair ? "YES — Potential value" : "NO — At or above midpoint"],
      )
      const ws2 = XLSX.utils.aoa_to_sheet(valuationRows)
      ws2["!cols"] = [{ wch: 20 }, { wch: 10 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 18 }]
      ws2["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }]
      XLSX.utils.book_append_sheet(wb, ws2, "Valuation")

      // ═══ Sheet 3: Comparable Sales ═══
      const compsRows: (string | number | null)[][] = [
        ["COMPARABLE MARKET TRANSACTIONS"],
        [""],
        ["Vehicle", "Sale Price (USD)", "Date", "Platform", "Delta vs Current"],
      ]
      for (const s of comps) {
        compsRows.push([s.title, s.price, s.date, s.platform, `${s.delta > 0 ? "+" : ""}${s.delta}%`])
      }
      compsRows.push(
        [""],
        ["Average Sale Price (USD)", Math.round(comps.reduce((sum, s) => sum + s.price, 0) / comps.length)],
        ["Median Delta", `${comps.length > 0 ? comps.sort((a, b) => a.delta - b.delta)[Math.floor(comps.length / 2)].delta : 0}%`],
      )
      const ws3 = XLSX.utils.aoa_to_sheet(compsRows)
      ws3["!cols"] = [{ wch: 32 }, { wch: 20 }, { wch: 12 }, { wch: 18 }, { wch: 16 }]
      ws3["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }]
      XLSX.utils.book_append_sheet(wb, ws3, "Comparable Sales")

      // ═══ Sheet 4: Ownership Costs ═══
      const costRows: (string | number)[][] = [
        ["ANNUAL OWNERSHIP COSTS"],
        [""],
        ["Category", "Annual Cost (USD)"],
        ["Insurance (Agreed Value)", costs.insurance],
        ["Climate-Controlled Storage", costs.storage],
        ["Service & Maintenance", costs.maintenance],
        ["Total Annual Cost", totalAnnualCost],
        ["Cost as % of Value", `${((totalAnnualCost / car.currentBid) * 100).toFixed(1)}%`],
        [""],
        ["SHIPPING & LOGISTICS"],
        ["Route", "Estimated Cost (USD)"],
        ["Domestic (Enclosed Transport)", shipping.domestic],
        ["EU Import (incl. duties & VAT)", shipping.euImport],
        ["UK Import (incl. duties & VAT)", shipping.ukImport],
        [""],
        ["5-YEAR PRICE HISTORY"],
        ["Year", "Index Value (USD)", "YoY Change"],
        ...priceHistory.map((p, i) => [
          String(2021 + i),
          p,
          i === 0 ? "—" : `${(((p - priceHistory[i - 1]) / priceHistory[i - 1]) * 100).toFixed(1)}%`,
        ]),
        [""],
        ["BENCHMARK COMPARISON (5yr Return)"],
        ["Asset", "5yr Return"],
        [car.make, `${brand5yReturn}%`],
        ...BENCHMARKS.map(b => [b.label, `${b.return5y}%`]),
        [`Outperformance vs S&P 500`, `${brand5yReturn - 42}pp`],
      ]
      const ws4 = XLSX.utils.aoa_to_sheet(costRows)
      ws4["!cols"] = [{ wch: 34 }, { wch: 22 }, { wch: 14 }]
      ws4["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
      XLSX.utils.book_append_sheet(wb, ws4, "Costs & Returns")

      // ═══ Sheet 5: Production & Heritage ═══
      const prodRows: (string | number)[][] = [
        ["PRODUCTION & HERITAGE"],
        [""],
        ["Attribute", "Value"],
        ["Years Produced", production.yearsProduced],
        ["Total Units Built", production.totalBuilt],
        ...(production.lhd > 0 || production.rhd > 0 ? [
          ["Left-Hand Drive", production.lhd],
          ["Right-Hand Drive", production.rhd],
          ["LHD/RHD Split", `${((production.lhd / (production.lhd + production.rhd)) * 100).toFixed(0)}% / ${((production.rhd / (production.lhd + production.rhd)) * 100).toFixed(0)}%`],
        ] as (string | number)[][] : []),
        ["Key Fact", production.keyStat],
        [""],
        ["VARIANT BREAKDOWN"],
        ["Variant", "Units Produced", "Current Price Range"],
        ...production.variants.map(v => [v.name, v.units, v.priceRange]),
        [""],
        ["Total Across All Variants", production.variants.reduce((sum, v) => sum + v.units, 0)],
      ]
      const ws5 = XLSX.utils.aoa_to_sheet(prodRows)
      ws5["!cols"] = [{ wch: 28 }, { wch: 20 }, { wch: 22 }]
      ws5["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
      XLSX.utils.book_append_sheet(wb, ws5, "Production")

      // ═══ Sheet 6: Technical Deep-Dive ═══
      const techRows: (string | number)[][] = [
        ["TECHNICAL DEEP-DIVE"],
        [""],
        ["ENGINE SPECIFICATIONS"],
        ["Specification", "Value"],
        ...technical.engineDetails.map(d => [d.spec, d.value]),
        [""],
        ["KNOWN MECHANICAL ISSUES"],
        ["Issue", "Severity", "Est. Repair Cost"],
        ...technical.knownIssues.map(i => [i.issue, i.severity.toUpperCase(), i.repairCost]),
        [""],
        ["Total Critical Issues", technical.knownIssues.filter(i => i.severity === "critical").length],
        ["Total Moderate Issues", technical.knownIssues.filter(i => i.severity === "moderate").length],
        ["Total Minor Issues", technical.knownIssues.filter(i => i.severity === "minor").length],
        [""],
        ["SERVICE SCHEDULE"],
        ["Service Item", "Interval", "Estimated Cost"],
        ...technical.serviceIntervals.map(s => [s.item, s.interval, s.cost]),
      ]
      const ws6 = XLSX.utils.aoa_to_sheet(techRows)
      ws6["!cols"] = [{ wch: 44 }, { wch: 22 }, { wch: 18 }]
      ws6["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
      XLSX.utils.book_append_sheet(wb, ws6, "Technical")

      // ═══ Sheet 7: Condition Guide ═══
      const condRows: (string | number)[][] = [
        ["CONDITION & INSPECTION GUIDE"],
        [""],
        ["BODYWORK & RUST-PRONE AREAS"],
        ["Area", "Severity"],
        ...condition.rustAreas.map(a => [a.area, a.severity.toUpperCase()]),
        [""],
        ["INTERIOR CONDITION CONCERNS"],
        ["Component", "Common Problem", "Part Availability"],
        ...condition.interiorIssues.map(i => [i.item, i.commonProblem, i.partAvailability.toUpperCase()]),
        [""],
        ["MODEL-SPECIFIC INSPECTION PRIORITIES"],
        ["Priority", "Item"],
        ...condition.inspectionPriorities.map((p, i) => [i + 1, p]),
      ]
      const ws7 = XLSX.utils.aoa_to_sheet(condRows)
      ws7["!cols"] = [{ wch: 50 }, { wch: 34 }, { wch: 20 }]
      ws7["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 2 } }]
      XLSX.utils.book_append_sheet(wb, ws7, "Condition")

      // ═══ Sheet 8: Due Diligence ═══
      const ddRows: (string | number)[][] = [
        ["DUE DILIGENCE CHECKLIST"],
        [""],
        ["RED FLAGS — Key Risk Areas"],
        ["#", "Risk Item"],
        ...flags.map((f, i) => [i + 1, f]),
        [""],
        ["SELLER QUESTIONS — Pre-Purchase"],
        ["#", "Question"],
        ...questions.map((q, i) => [i + 1, q]),
      ]
      const ws8 = XLSX.utils.aoa_to_sheet(ddRows)
      ws8["!cols"] = [{ wch: 6 }, { wch: 60 }]
      ws8["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 1 } }]
      XLSX.utils.book_append_sheet(wb, ws8, "Due Diligence")

      // ═══ Sheet 9: Market Context ═══
      const mktRows: (string | number)[][] = [
        ["MARKET CONTEXT & EVENTS"],
        [""],
        ["UPCOMING EVENTS & CATALYSTS"],
        ["Event", "Type", "Expected Impact"],
        ...events.map(e => [e.name, e.type, e.impact.toUpperCase()]),
        [""],
        ["VEHICLE THESIS"],
        [car.thesis || "No specific thesis available"],
        [""],
        ["HISTORY"],
        [car.history || "No documented history available"],
      ]
      const ws9 = XLSX.utils.aoa_to_sheet(mktRows)
      ws9["!cols"] = [{ wch: 40 }, { wch: 18 }, { wch: 18 }]
      ws9["!merges"] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 2 } },
        { s: { r: 7, c: 0 }, e: { r: 7, c: 2 } },
        { s: { r: 9, c: 0 }, e: { r: 9, c: 2 } },
      ]
      XLSX.utils.book_append_sheet(wb, ws9, "Market Context")

      const carSlug = `${car.year}-${car.make}-${car.model}`.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")
      const userSlug = user?.name ? `_${user.name.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9-]/g, "")}` : ""
      XLSX.writeFile(wb, `Monza-Data_${carSlug}${userSlug}.xlsx`)
    } catch (err) {
      console.error("Excel generation failed:", err)
    } finally {
      setDownloadingExcel(false)
    }
  }

  // ─── PAYWALL BLUR WRAPPER ───
  const PaywallSection = ({ children, sectionId }: { children: React.ReactNode; sectionId: SectionId }) => {
    if (sectionId === "summary" || hasAccess) return <>{children}</>
    return (
      <div className="relative">
        <div className="blur-sm pointer-events-none select-none">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center bg-[#0b0b10]/60 backdrop-blur-[2px] rounded-2xl">
          <div className="text-center px-6 py-8">
            <Lock className="size-8 text-[#F8B4D9] mx-auto mb-3" />
            <p className="text-[14px] font-semibold text-[#FFFCF7] mb-1">{t("unlockReport")}</p>
            <p className="text-[11px] text-[#6B7280] max-w-[280px]">{t("unlockDesc")}</p>
            <button
              onClick={handleUnlock}
              className="mt-4 flex items-center gap-2 mx-auto rounded-xl bg-[#F8B4D9] px-6 py-3 text-[12px] font-semibold text-[#0b0b10] hover:bg-[#f4cbde] active:scale-[0.97] transition-all"
            >
              <Coins className="size-4" />
              {t("unlockCost")}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ─── SECTION HEADER ───
  const SectionHeader = ({ id, title }: { id: SectionId; title: string }) => {
    const Icon = SECTION_ICONS[id]
    const sectionNumber = SECTION_IDS.indexOf(id) + 1
    return (
      <div className="flex items-center gap-3 mb-5">
        <div className="flex items-center justify-center size-8 rounded-lg bg-[rgba(248,180,217,0.1)]">
          <Icon className="size-4 text-[#F8B4D9]" />
        </div>
        <div>
          <span className="text-[9px] font-mono text-[#4B5563] tracking-wider">SECTION {String(sectionNumber).padStart(2, "0")}</span>
          <h2 className="text-[16px] md:text-[18px] font-bold text-[#FFFCF7] leading-tight">{title}</h2>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b10]">
      {/* ═══ STICKY NAV — Desktop: sidebar, Mobile: top pills ═══ */}

      {/* MOBILE: Sticky top pills */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-[#0b0b10]/95 backdrop-blur-xl border-b border-white/5">
        <div className="flex items-center gap-2 px-3 py-2">
          <Link
            href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
            className="shrink-0 p-2 text-[#4B5563] hover:text-[#F8B4D9] transition-colors"
          >
            <ArrowLeft className="size-4" />
          </Link>
          <div className="flex-1 overflow-x-auto no-scrollbar">
            <div className="flex items-center gap-1.5 min-w-max">
              {SECTION_IDS.map(id => {
                const Icon = SECTION_ICONS[id]
                const isActive = activeSection === id
                const isLocked = id !== "summary" && !hasAccess
                return (
                  <button
                    key={id}
                    onClick={() => scrollToSection(id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-medium whitespace-nowrap transition-all ${
                      isActive
                        ? "bg-[#F8B4D9]/15 text-[#F8B4D9] border border-[#F8B4D9]/20"
                        : "text-[#6B7280] hover:text-[#9CA3AF]"
                    }`}
                  >
                    {isLocked ? <Lock className="size-2.5" /> : <Icon className="size-2.5" />}
                    {t(`sections.${id}`)}
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* DESKTOP: Fixed left sidebar nav */}
      <div className="hidden md:flex fixed left-0 top-0 bottom-0 w-[240px] flex-col bg-[#0b0b10] border-r border-white/5 z-40 pt-[80px]">
        <div className="px-4 py-4 border-b border-white/5">
          <Link
            href={`/cars/${car.make.toLowerCase().replace(/\s+/g, "-")}/${car.id}`}
            className="inline-flex items-center gap-1.5 text-[10px] text-[#6B7280] hover:text-[#F8B4D9] transition-colors"
          >
            <ArrowLeft className="size-3" />
            {t("backToVehicle")}
          </Link>
          <h1 className="text-[13px] font-bold text-[#FFFCF7] mt-2 leading-tight">{car.title}</h1>
          <div className="flex items-center gap-2 mt-1.5">
            <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
              car.investmentGrade === "AAA"
                ? "bg-emerald-500/15 text-emerald-400 border border-emerald-400/20"
                : car.investmentGrade === "AA"
                  ? "bg-blue-500/15 text-blue-400 border border-blue-400/20"
                  : "bg-amber-500/15 text-amber-400 border border-amber-400/20"
            }`}>{car.investmentGrade}</span>
            <span className="text-[10px] text-[#4B5563]">{t("title")}</span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto py-3 px-2">
          {SECTION_IDS.map((id, i) => {
            const Icon = SECTION_ICONS[id]
            const isActive = activeSection === id
            const isLocked = id !== "summary" && !hasAccess
            return (
              <button
                key={id}
                onClick={() => scrollToSection(id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left transition-all mb-0.5 ${
                  isActive
                    ? "bg-[rgba(248,180,217,0.08)] text-[#F8B4D9]"
                    : "text-[#6B7280] hover:text-[#9CA3AF] hover:bg-white/[0.02]"
                }`}
              >
                <span className="text-[9px] font-mono w-4 text-right">{String(i + 1).padStart(2, "0")}</span>
                {isLocked ? <Lock className="size-3.5 shrink-0" /> : <Icon className="size-3.5 shrink-0" />}
                <span className="text-[11px] font-medium">{t(`sections.${id}`)}</span>
              </button>
            )
          })}
        </nav>

        {hasAccess ? (
          <div className="p-3 border-t border-white/5">
            <button
              onClick={() => setShowDownloadSheet(true)}
              disabled={downloadingPdf || downloadingExcel}
              className="w-full flex items-center gap-3 px-3.5 py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde] active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {(downloadingPdf || downloadingExcel) ? (
                <>
                  <div className="size-4 rounded-full border-2 border-[#0b0b10]/30 border-t-[#0b0b10] animate-spin shrink-0" />
                  <span className="text-[12px] font-semibold">{t("downloadGenerating")}</span>
                </>
              ) : (
                <>
                  <Download className="size-4 shrink-0" />
                  <span className="text-[12px] font-semibold flex-1 text-left">{t("downloadButton")}</span>
                  <ChevronRight className="size-3.5 opacity-50 shrink-0" />
                </>
              )}
            </button>
          </div>
        ) : !tokensLoading && (
          <div className="p-4 border-t border-white/5">
            <button
              onClick={handleUnlock}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#F8B4D9] py-3 text-[11px] font-semibold uppercase tracking-wider text-[#0b0b10] hover:bg-[#f4cbde] transition-colors"
            >
              <Lock className="size-3.5" />
              {t("unlockReport")}
            </button>
            <p className="text-[9px] text-[#4B5563] text-center mt-2">{t("unlockCost")}</p>
          </div>
        )}
      </div>

      {/* ═══ MAIN CONTENT ═══ */}
      <div className="md:ml-[240px] pt-[52px] md:pt-[80px]">
        <div className={`max-w-[840px] mx-auto px-4 md:px-8 ${hasAccess ? "pb-32" : "pb-24"}`}>

          {/* ═══ COVER / HERO ═══ */}
          <div className="relative aspect-[16/9] md:aspect-[21/9] rounded-2xl md:rounded-3xl overflow-hidden mt-4 md:mt-6">
            <Image
              src={car.image}
              alt={car.title}
              fill
              className="object-cover"
              priority
              sizes="(min-width: 768px) 840px, 100vw"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/30 to-transparent" />
            <div className="absolute bottom-4 md:bottom-6 left-4 md:left-6 right-4 md:right-6">
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-full bg-[#F8B4D9]/20 text-[#F8B4D9] text-[9px] font-bold border border-[#F8B4D9]/20 backdrop-blur-md">
                  {t("title")}
                </span>
                {!hasAccess && (
                  <span className="px-2 py-0.5 rounded-full bg-white/10 text-[#9CA3AF] text-[9px] font-medium backdrop-blur-md">
                    {t("freePreview")}
                  </span>
                )}
              </div>
              <h1 className="text-[20px] md:text-[28px] font-bold text-white">{car.title}</h1>
              <p className="text-[11px] md:text-[13px] text-[#9CA3AF] mt-1">{t("subtitle")}</p>
            </div>
          </div>

          <div className="space-y-6 md:space-y-8 mt-6 md:mt-8">

            {/* ═══════════════════════════════════════
                §1 — EXECUTIVE SUMMARY (always visible)
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("summary")} id="section-summary" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <SectionHeader id="summary" title={t("sections.summary")} />

              {/* 6-metric grid */}
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {/* Investment Grade */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("summary.investmentGrade")}</span>
                  <p className={`text-[28px] font-black mt-1 ${
                    car.investmentGrade === "AAA" ? "text-emerald-400" : car.investmentGrade === "AA" ? "text-blue-400" : "text-amber-400"
                  }`}>{car.investmentGrade}</p>
                </div>
                {/* Current Price */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("summary.currentPrice")}</span>
                  <p className="text-[20px] font-bold font-mono text-[#F8B4D9] mt-1">{formatPriceForRegion(car.currentBid, selectedRegion)}</p>
                </div>
                {/* Fair Value */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("summary.fairValue")}</span>
                  <p className="text-[14px] font-mono font-semibold text-[#FFFCF7] mt-2">
                    {fmtRegional(fairLow, regionRange.currency)} – {fmtRegional(fairHigh, regionRange.currency)}
                  </p>
                </div>
                {/* 5yr Return */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("summary.fiveYearReturn")}</span>
                  <p className={`text-[24px] font-bold font-mono mt-1 ${brand5yReturn > 0 ? "text-emerald-400" : "text-red-400"}`}>
                    +{brand5yReturn}%
                  </p>
                </div>
                {/* Annual Cost */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("summary.annualCost")}</span>
                  <p className="text-[18px] font-bold font-mono text-[#FFFCF7] mt-1">{formatPriceForRegion(totalAnnualCost, selectedRegion)}/yr</p>
                </div>
                {/* Risk Score */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                  <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("summary.riskScore")}</span>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex-1 h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className={`h-full rounded-full ${riskScore <= 30 ? "bg-emerald-400" : riskScore <= 50 ? "bg-amber-400" : "bg-red-400"}`}
                        style={{ width: `${riskScore}%` }}
                      />
                    </div>
                    <span className={`text-[12px] font-bold ${riskScore <= 30 ? "text-emerald-400" : riskScore <= 50 ? "text-amber-400" : "text-red-400"}`}>
                      {riskScore}/100
                    </span>
                  </div>
                </div>
              </div>

              {/* Verdict one-liner */}
              <div className="mt-4 rounded-xl bg-[rgba(248,180,217,0.06)] border border-[rgba(248,180,217,0.15)] p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="size-5 text-[#F8B4D9] shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[12px] font-semibold text-[#F8B4D9] mb-1">{t("summary.verdict")}</p>
                    <p className="text-[13px] text-[#D1D5DB] leading-relaxed">{car.thesis}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ═══════════════════════════════════════
                §2 — VEHICLE IDENTITY & PROVENANCE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("identity")} id="section-identity" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="identity">
                <SectionHeader id="identity" title={t("sections.identity")} />

                {/* Specs grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  {[
                    { label: t("identity.engine"), value: car.engine, icon: <Gauge className="size-4" /> },
                    { label: t("identity.transmission"), value: car.transmission, icon: <Cog className="size-4" /> },
                    { label: t("identity.mileage"), value: `${car.mileage.toLocaleString()} ${car.mileageUnit}`, icon: <TrendingUp className="size-4" /> },
                    { label: t("identity.location"), value: car.location, icon: <MapPin className="size-4" /> },
                    { label: t("identity.category"), value: car.category, icon: <Car className="size-4" /> },
                  ].map((spec, i) => (
                    <div key={i} className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                      <div className="flex items-center gap-2 text-[#F8B4D9]/60 mb-2">
                        {spec.icon}
                        <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{spec.label}</span>
                      </div>
                      <span className="text-[14px] font-semibold text-[#FFFCF7]">{spec.value}</span>
                    </div>
                  ))}
                </div>

                {/* Provenance */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <History className="size-4 text-[#F8B4D9]" />
                    <h3 className="text-[12px] font-semibold text-[#FFFCF7]">{t("identity.provenance")}</h3>
                  </div>
                  <div className="border-l-2 border-[#F8B4D9]/20 pl-4">
                    <p className="text-[13px] text-[#D1D5DB] leading-relaxed">{car.history}</p>
                  </div>
                </div>

                {/* Platform data */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <FileText className="size-4 text-[#F8B4D9]" />
                    <h3 className="text-[12px] font-semibold text-[#FFFCF7]">{t("identity.platformData")}</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">{t("identity.platform")}</span>
                      <div className="flex items-center gap-2 mt-1">
                        {platform && <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold ${platform.color}`}>{platform.short}</span>}
                        <span className="text-[12px] text-[#9CA3AF]">{car.platform.replace(/_/g, " ")}</span>
                      </div>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">{t("identity.currentBid")}</span>
                      <p className="text-[16px] font-mono font-bold text-[#F8B4D9] mt-1">{formatPriceForRegion(car.currentBid, selectedRegion)}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">{t("identity.bidCount")}</span>
                      <p className="text-[14px] font-semibold text-[#FFFCF7] mt-1">{car.bidCount}</p>
                    </div>
                    <div>
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">{t("identity.status")}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        {isLive && <div className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />}
                        <span className={`text-[12px] font-semibold ${isLive ? "text-emerald-400" : "text-[#9CA3AF]"}`}>
                          {car.status === "ENDED" ? "Ended" : isLive ? `Live · ${timeLeft(car.endTime)}` : car.status}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §3 — PRODUCTION & HERITAGE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("production")} id="section-production" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="production">
                <SectionHeader id="production" title={t("sections.production")} />

                {/* Key stat callout */}
                <div className="rounded-xl bg-[rgba(248,180,217,0.06)] border border-[rgba(248,180,217,0.15)] p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <Factory className="size-5 text-[#F8B4D9] shrink-0 mt-0.5" />
                    <p className="text-[13px] text-[#D1D5DB] leading-relaxed">{production.keyStat}</p>
                  </div>
                </div>

                {/* Production stats grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-4">
                  <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("production.yearsProduced")}</span>
                    <p className="text-[16px] font-bold text-[#FFFCF7] mt-1">{production.yearsProduced}</p>
                  </div>
                  <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4">
                    <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("production.totalBuilt")}</span>
                    <p className="text-[16px] font-bold font-mono text-[#F8B4D9] mt-1">{production.totalBuilt.toLocaleString()}</p>
                  </div>
                  {(production.lhd > 0 || production.rhd > 0) && (
                    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-4 col-span-2 md:col-span-1">
                      <span className="text-[9px] font-medium tracking-[0.15em] uppercase text-[#6B7280]">{t("production.steering")}</span>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[12px] font-mono text-[#FFFCF7]">LHD: {production.lhd.toLocaleString()}</span>
                        <span className="text-[10px] text-[#4B5563]">|</span>
                        <span className="text-[12px] font-mono text-[#FFFCF7]">RHD: {production.rhd.toLocaleString()}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Variant breakdown with pricing */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">{t("production.variants")}</h3>
                  <div className="space-y-2">
                    {production.variants.map((v, i) => {
                      const pct = production.totalBuilt > 0 ? (v.units / production.totalBuilt) * 100 : 25
                      return (
                        <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2">
                              <span className="text-[13px] font-semibold text-[#FFFCF7]">{v.name}</span>
                              <span className="text-[9px] font-mono text-[#4B5563]">({v.units.toLocaleString()} units)</span>
                            </div>
                            <span className="text-[12px] font-mono font-semibold text-[#F8B4D9]">{v.priceRange}</span>
                          </div>
                          <div className="relative h-[4px] rounded-full bg-white/[0.04] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${Math.min(pct, 100)}%` }}
                              transition={{ duration: 0.6, delay: 0.1 + i * 0.08 }}
                              className="h-full rounded-full bg-[#F8B4D9]/30"
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §4 — MARKET VALUATION & REGIONAL ARBITRAGE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("valuation")} id="section-valuation" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="valuation">
                <SectionHeader id="valuation" title={t("sections.valuation")} />

                {/* Regional breakdown bars */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">{t("valuation.regionalBreakdown")}</h3>
                  <div className="space-y-4">
                    {(["US", "EU", "UK", "JP"] as const).map(r => {
                      const rp = pricing[r]
                      const avgUsd = toUsd((rp.low + rp.high) / 2, rp.currency)
                      const barWidth = maxRegionalUsd > 0 ? (avgUsd / maxRegionalUsd) * 100 : 50
                      const isBest = r === bestRegion
                      const isUserRegion = r === effectiveRegion
                      return (
                        <div key={r}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-[14px]">{regionLabels[r].flag}</span>
                              <span className="text-[12px] font-medium text-[#FFFCF7]">{regionLabels[r].short}</span>
                              {isBest && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-400/20">
                                  {t("valuation.bestBuy")}
                                </span>
                              )}
                              {isUserRegion && !isBest && (
                                <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#F8B4D9]/15 text-[#F8B4D9] border border-[#F8B4D9]/20">
                                  {t("valuation.yourMarket")}
                                </span>
                              )}
                            </div>
                            <span className="text-[12px] font-mono text-[#9CA3AF]">
                              {fmtRegional(rp.low, rp.currency)} – {fmtRegional(rp.high, rp.currency)}
                            </span>
                          </div>
                          <div className="relative h-[8px] rounded-full bg-white/[0.04] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${barWidth}%` }}
                              transition={{ duration: 0.8, delay: 0.1 }}
                              className={`h-full rounded-full ${isBest ? "bg-emerald-400" : "bg-[#F8B4D9]/40"}`}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Market position gauge */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("valuation.marketPositionGauge")}</h3>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-mono text-[#9CA3AF]">{fmtRegional(fairLow, regionRange.currency)}</span>
                    <span className="text-[9px] text-[#6B7280]">{effectiveRegion} Fair Value Range</span>
                    <span className="text-[10px] font-mono text-[#9CA3AF]">{fmtRegional(fairHigh, regionRange.currency)}</span>
                  </div>
                  <div className="relative h-[12px] rounded-full bg-white/[0.04] overflow-hidden">
                    <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/20 via-[#F8B4D9]/20 to-red-400/20" />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 size-[14px] rounded-full bg-[#F8B4D9] border-2 border-[#0b0b10] shadow-lg shadow-[#F8B4D9]/40"
                      style={{ left: `calc(${pricePosition}% - 7px)` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center gap-1.5">
                    {isBelowFair ? (
                      <>
                        <CheckCircle2 className="size-3.5 text-emerald-400" />
                        <span className="text-[11px] font-medium text-emerald-400">{t("valuation.belowFair")}</span>
                      </>
                    ) : pricePosition > 80 ? (
                      <>
                        <AlertTriangle className="size-3.5 text-red-400" />
                        <span className="text-[11px] font-medium text-red-400">{t("valuation.aboveFair")}</span>
                      </>
                    ) : (
                      <>
                        <Target className="size-3.5 text-amber-400" />
                        <span className="text-[11px] font-medium text-amber-400">{t("valuation.atFair")}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Arbitrage alert */}
                {hasArbitrage && (
                  <div className="rounded-xl bg-emerald-400/[0.05] border border-emerald-400/20 p-5 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="size-8 rounded-lg bg-emerald-400/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Globe className="size-4 text-emerald-400" />
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-emerald-400 mb-1">{t("valuation.arbitrageAlert")}</p>
                        <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
                          {t("valuation.arbitrageDesc", { region: regionLabels[bestRegion]?.short || bestRegion, amount: formatUsd(arbitrageSavings) })}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Comparable sales */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">{t("valuation.comparables")}</h3>
                  <div className="space-y-2">
                    {comps.map((sale, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/5">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#FFFCF7] truncate">{sale.title}</p>
                          <p className="text-[10px] text-[#4B5563] mt-0.5">{sale.date} · {sale.platform}</p>
                        </div>
                        <div className="text-right shrink-0 ml-3">
                          <p className="text-[16px] font-bold font-mono text-[#FFFCF7]">{formatPriceForRegion(sale.price, selectedRegion)}</p>
                          <span className={`text-[10px] font-mono font-semibold ${sale.delta > 0 ? "text-emerald-400" : "text-red-400"}`}>
                            {sale.delta > 0 ? "+" : ""}{sale.delta}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §4 — INVESTMENT PERFORMANCE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("performance")} id="section-performance" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="performance">
                <SectionHeader id="performance" title={t("sections.performance")} />

                {/* 5-Year Return Comparison bars */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">
                    {t("performance.vsBenchmarks")}
                  </h3>
                  <div className="space-y-4">
                    {/* Brand return */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[12px] font-semibold text-[#F8B4D9]">{car.make}</span>
                        <span className="text-[14px] font-mono font-bold text-emerald-400">+{brand5yReturn}%</span>
                      </div>
                      <div className="relative h-[10px] rounded-full bg-white/[0.04] overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(brand5yReturn, 100)}%` }}
                          transition={{ duration: 0.8, delay: 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-[#F8B4D9] to-[#F8B4D9]/60"
                        />
                      </div>
                    </div>
                    {/* Benchmarks */}
                    {BENCHMARKS.map((bench, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className="text-[12px] text-[#9CA3AF]">{bench.label}</span>
                          <span className="text-[12px] font-mono text-[#6B7280]">+{bench.return5y}%</span>
                        </div>
                        <div className="relative h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${Math.min(bench.return5y, 100)}%` }}
                            transition={{ duration: 0.8, delay: 0.2 + i * 0.1 }}
                            className="h-full rounded-full bg-white/10"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  {brand5yReturn > BENCHMARKS[0].return5y && (
                    <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald-500/[0.05] border border-emerald-400/10">
                      <TrendingUp className="size-3.5 text-emerald-400" />
                      <span className="text-[11px] text-emerald-400">{t("performance.outperforms", { benchmark: "S&P 500" })}</span>
                    </div>
                  )}
                </div>

                {/* Price trend — SVG area chart */}
                {(() => {
                  const chartW = 100 // viewBox percentage
                  const chartH = 60
                  const padL = 0
                  const padR = 0
                  const padT = 8
                  const padB = 0
                  const maxP = Math.max(...priceHistory)
                  const minP = 0
                  const rangeP = maxP - minP || 1
                  const points = priceHistory.map((p, i) => ({
                    x: padL + (i / (priceHistory.length - 1)) * (chartW - padL - padR),
                    y: padT + (1 - (p - minP) / rangeP) * (chartH - padT - padB),
                    price: p,
                    year: 2021 + i,
                  }))
                  const linePath = points.map((pt, i) => `${i === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")
                  const areaPath = `${linePath} L ${points[points.length - 1].x} ${chartH} L ${points[0].x} ${chartH} Z`

                  return (
                    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280]">{t("performance.priceTrend")}</h3>
                        <div className="flex items-center gap-4">
                          <span className="text-[10px] text-[#6B7280]">CAGR: <span className="text-emerald-400 font-mono font-semibold">{cagr.toFixed(1)}%</span></span>
                          <span className="text-[10px] text-[#6B7280]">5yr: <span className="text-[#F8B4D9] font-mono font-semibold">+{brand5yReturn}%</span></span>
                        </div>
                      </div>

                      {/* SVG Chart */}
                      <div className="relative">
                        <svg viewBox={`0 0 ${chartW} ${chartH + 10}`} className="w-full h-auto" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="0%" stopColor="#F8B4D9" stopOpacity="0.3" />
                              <stop offset="100%" stopColor="#F8B4D9" stopOpacity="0.02" />
                            </linearGradient>
                            <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                              <stop offset="0%" stopColor="#F8B4D9" stopOpacity="0.5" />
                              <stop offset="100%" stopColor="#F8B4D9" stopOpacity="1" />
                            </linearGradient>
                          </defs>
                          {/* Grid lines */}
                          {[0, 0.25, 0.5, 0.75, 1].map(pct => {
                            const gy = padT + (1 - pct) * (chartH - padT - padB)
                            return <line key={pct} x1={padL} y1={gy} x2={chartW - padR} y2={gy} stroke="rgba(255,255,255,0.04)" strokeWidth="0.2" />
                          })}
                          {/* Area fill */}
                          <motion.path
                            d={areaPath}
                            fill="url(#areaGrad)"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 1, delay: 0.3 }}
                          />
                          {/* Line */}
                          <motion.path
                            d={linePath}
                            fill="none"
                            stroke="url(#lineGrad)"
                            strokeWidth="0.8"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            initial={{ pathLength: 0 }}
                            animate={{ pathLength: 1 }}
                            transition={{ duration: 1.2, delay: 0.2 }}
                          />
                          {/* Data points */}
                          {points.map((pt, i) => (
                            <motion.circle
                              key={i}
                              cx={pt.x}
                              cy={pt.y}
                              r={i === points.length - 1 ? 1.4 : 0.8}
                              fill={i === points.length - 1 ? "#F8B4D9" : "#0b0b10"}
                              stroke="#F8B4D9"
                              strokeWidth={i === points.length - 1 ? 0.5 : 0.3}
                              initial={{ opacity: 0, scale: 0 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ duration: 0.3, delay: 0.5 + i * 0.15 }}
                            />
                          ))}
                          {/* Glow on last point */}
                          <motion.circle
                            cx={points[points.length - 1].x}
                            cy={points[points.length - 1].y}
                            r="3"
                            fill="none"
                            stroke="#F8B4D9"
                            strokeWidth="0.2"
                            opacity="0.3"
                            initial={{ r: 1 }}
                            animate={{ r: 3, opacity: [0.3, 0, 0.3] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </svg>

                        {/* X-axis labels (years) */}
                        <div className="flex justify-between mt-1 px-0">
                          {points.map((pt, i) => (
                            <span key={i} className={`text-[9px] font-mono ${i === points.length - 1 ? "text-[#F8B4D9] font-semibold" : "text-[#4B5563]"}`}>
                              {pt.year}
                            </span>
                          ))}
                        </div>

                        {/* Y-axis price labels */}
                        <div className="flex justify-between mt-2">
                          {points.map((pt, i) => (
                            <span key={i} className={`text-[9px] font-mono ${i === points.length - 1 ? "text-[#FFFCF7] font-semibold" : "text-[#6B7280]"}`}>
                              {formatUsd(pt.price)}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* YoY change pills */}
                      <div className="flex gap-2 mt-4">
                        {priceHistory.slice(1).map((p, i) => {
                          const prev = priceHistory[i]
                          const change = ((p - prev) / prev) * 100
                          return (
                            <div key={i} className="flex-1 text-center py-1.5 rounded-lg bg-white/[0.02] border border-white/5">
                              <span className="text-[8px] text-[#4B5563] block">{2021 + i}→{2022 + i}</span>
                              <span className={`text-[10px] font-mono font-semibold ${change > 0 ? "text-emerald-400" : "text-red-400"}`}>
                                {change > 0 ? "+" : ""}{change.toFixed(0)}%
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })()}

                {/* Similar Cars Price Comparison */}
                {similarCars.length > 0 && (() => {
                  const allCars = [{ ...car, isCurrent: true }, ...similarCars.map(sc => ({ ...sc, isCurrent: false }))]
                  const maxBid = Math.max(...allCars.map(c => c.currentBid))
                  return (
                    <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mt-4">
                      <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-1">{t("performance.similarComparison")}</h3>
                      <p className="text-[10px] text-[#4B5563] mb-5">{t("performance.similarComparisonDesc")}</p>

                      <div className="space-y-3">
                        {allCars.map((c, i) => {
                          const barPct = maxBid > 0 ? (c.currentBid / maxBid) * 100 : 50
                          const isCurrent = "isCurrent" in c && c.isCurrent
                          return (
                            <div key={i}>
                              <div className="flex items-center justify-between mb-1">
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className={`text-[11px] font-medium truncate ${isCurrent ? "text-[#F8B4D9]" : "text-[#FFFCF7]"}`}>
                                    {c.title}
                                  </span>
                                  {isCurrent && (
                                    <span className="shrink-0 px-1.5 py-0.5 rounded text-[7px] font-bold bg-[#F8B4D9]/15 text-[#F8B4D9] border border-[#F8B4D9]/20">
                                      THIS CAR
                                    </span>
                                  )}
                                  <span className={`shrink-0 px-1.5 py-0.5 rounded text-[7px] font-bold ${
                                    c.investmentGrade === "AAA"
                                      ? "bg-emerald-500/15 text-emerald-400 border border-emerald-400/20"
                                      : c.investmentGrade === "AA"
                                        ? "bg-blue-500/15 text-blue-400 border border-blue-400/20"
                                        : "bg-amber-500/15 text-amber-400 border border-amber-400/20"
                                  }`}>
                                    {c.investmentGrade}
                                  </span>
                                </div>
                                <span className={`text-[12px] font-mono font-semibold shrink-0 ml-3 ${isCurrent ? "text-[#F8B4D9]" : "text-[#9CA3AF]"}`}>
                                  {formatPriceForRegion(c.currentBid, selectedRegion)}
                                </span>
                              </div>
                              <div className="relative h-[6px] rounded-full bg-white/[0.04] overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${barPct}%` }}
                                  transition={{ duration: 0.7, delay: 0.1 + i * 0.08 }}
                                  className={`h-full rounded-full ${isCurrent ? "bg-[#F8B4D9]" : "bg-white/10"}`}
                                />
                              </div>
                              <div className="flex items-center gap-3 mt-1">
                                <span className={`text-[9px] ${c.trend === "Appreciating" ? "text-emerald-400" : c.trend === "Stable" ? "text-amber-400" : "text-red-400"}`}>
                                  {c.trend}
                                </span>
                                <span className="text-[9px] text-[#4B5563]">{c.category}</span>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* Summary stats */}
                      <div className="mt-5 pt-4 border-t border-white/5 grid grid-cols-3 gap-3">
                        <div className="text-center">
                          <span className="text-[8px] font-medium tracking-[0.1em] uppercase text-[#6B7280] block">{t("performance.avgPrice")}</span>
                          <span className="text-[13px] font-mono font-bold text-[#FFFCF7] mt-0.5 block">
                            {formatPriceForRegion(Math.round(allCars.reduce((s, c) => s + c.currentBid, 0) / allCars.length), selectedRegion)}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-medium tracking-[0.1em] uppercase text-[#6B7280] block">{t("performance.priceRank")}</span>
                          <span className="text-[13px] font-mono font-bold text-[#F8B4D9] mt-0.5 block">
                            #{[...allCars].sort((a, b) => b.currentBid - a.currentBid).findIndex(c => "isCurrent" in c && c.isCurrent) + 1}/{allCars.length}
                          </span>
                        </div>
                        <div className="text-center">
                          <span className="text-[8px] font-medium tracking-[0.1em] uppercase text-[#6B7280] block">{t("performance.vsMkt")}</span>
                          {(() => {
                            const avg = similarCars.reduce((s, c) => s + c.currentBid, 0) / similarCars.length
                            const diff = ((car.currentBid - avg) / avg) * 100
                            return (
                              <span className={`text-[13px] font-mono font-bold mt-0.5 block ${diff > 0 ? "text-[#F8B4D9]" : "text-emerald-400"}`}>
                                {diff > 0 ? "+" : ""}{diff.toFixed(0)}%
                              </span>
                            )
                          })()}
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §6 — TECHNICAL DEEP-DIVE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("technical")} id="section-technical" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="technical">
                <SectionHeader id="technical" title={t("sections.technical")} />

                {/* Engine specifications */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">{t("technical.engineSpecs")}</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {technical.engineDetails.map((detail, i) => (
                      <div key={i} className="p-3 rounded-lg bg-white/[0.02]">
                        <span className="text-[9px] font-medium tracking-[0.12em] uppercase text-[#6B7280]">{detail.spec}</span>
                        <p className="text-[13px] font-semibold text-[#FFFCF7] mt-1">{detail.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Known mechanical issues */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("technical.knownIssues")}</h3>
                  <div className="space-y-2">
                    {technical.knownIssues.map((issue, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                        <div className={`size-2 rounded-full mt-1.5 shrink-0 ${
                          issue.severity === "critical" ? "bg-red-400" : issue.severity === "moderate" ? "bg-amber-400" : "bg-[#4B5563]"
                        }`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#FFFCF7]">{issue.issue}</p>
                          <p className="text-[10px] text-[#6B7280] mt-0.5">{t("technical.estRepair")}: {issue.repairCost}</p>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          issue.severity === "critical" ? "bg-red-500/10 text-red-400" :
                          issue.severity === "moderate" ? "bg-amber-500/10 text-amber-400" :
                          "bg-white/5 text-[#4B5563]"
                        }`}>
                          {t(`technical.${issue.severity}`)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Service intervals & costs */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Wrench className="size-4 text-[#F8B4D9]" />
                    <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280]">{t("technical.serviceSchedule")}</h3>
                  </div>
                  <div className="space-y-2">
                    {technical.serviceIntervals.map((svc, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#FFFCF7]">{svc.item}</p>
                          <p className="text-[10px] text-[#4B5563] mt-0.5">{svc.interval}</p>
                        </div>
                        <span className="text-[13px] font-mono font-semibold text-[#F8B4D9] shrink-0 ml-3">{svc.cost}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §7 — RISK ASSESSMENT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("risk")} id="section-risk" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="risk">
                <SectionHeader id="risk" title={t("sections.risk")} />

                {/* Risk gauge */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("risk.overallScore")}</h3>
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="relative h-[10px] rounded-full bg-white/[0.04] overflow-hidden">
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-emerald-400/30 via-amber-400/30 to-red-400/30" />
                        <motion.div
                          initial={{ left: 0 }}
                          animate={{ left: `calc(${riskScore}% - 8px)` }}
                          transition={{ duration: 0.8 }}
                          className="absolute top-1/2 -translate-y-1/2 size-[16px] rounded-full bg-white border-2 border-[#0b0b10] shadow-lg"
                          style={{ left: `calc(${riskScore}% - 8px)` }}
                        />
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-[9px] text-emerald-400">{t("risk.low")}</span>
                        <span className="text-[9px] text-amber-400">{t("risk.moderate")}</span>
                        <span className="text-[9px] text-red-400">{t("risk.high")}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-[28px] font-black ${riskScore <= 30 ? "text-emerald-400" : riskScore <= 50 ? "text-amber-400" : "text-red-400"}`}>
                        {riskScore}
                      </span>
                      <span className="text-[12px] text-[#4B5563]">/100</span>
                    </div>
                  </div>
                </div>

                {/* Red flags */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("risk.knownIssues")}</h3>
                  <div className="space-y-2">
                    {flags.map((flag, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-[rgba(248,180,217,0.03)] border border-white/[0.03]">
                        <AlertTriangle className="size-4 text-[#F8B4D9] mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] text-[#FFFCF7]">{flag}</p>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                          i < 2 ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9]" : "bg-white/5 text-[#4B5563]"
                        }`}>
                          {i < 2 ? t("risk.critical") : t("risk.monitor")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §8 — CONDITION GUIDE
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("condition")} id="section-condition" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="condition">
                <SectionHeader id="condition" title={t("sections.condition")} />

                {/* Bodywork / Rust-prone areas */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("condition.rustAreas")}</h3>
                  <div className="space-y-2">
                    {condition.rustAreas.map((area, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className={`size-3 rounded-full shrink-0 ${
                            area.severity === "high" ? "bg-red-400" : area.severity === "medium" ? "bg-amber-400" : "bg-emerald-400"
                          }`} />
                          <span className="text-[13px] text-[#FFFCF7]">{area.area}</span>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full shrink-0 ml-2 ${
                          area.severity === "high" ? "bg-red-500/10 text-red-400" :
                          area.severity === "medium" ? "bg-amber-500/10 text-amber-400" :
                          "bg-emerald-500/10 text-emerald-400"
                        }`}>
                          {t(`condition.${area.severity}`)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Interior condition concerns */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("condition.interiorIssues")}</h3>
                  <div className="space-y-2">
                    {condition.interiorIssues.map((item, i) => (
                      <div key={i} className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.03]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[13px] font-semibold text-[#FFFCF7]">{item.item}</span>
                          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                            item.partAvailability === "rare" ? "bg-red-500/10 text-red-400" :
                            item.partAvailability === "moderate" ? "bg-amber-500/10 text-amber-400" :
                            "bg-emerald-500/10 text-emerald-400"
                          }`}>
                            {t(`condition.parts_${item.partAvailability}`)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B7280]">{item.commonProblem}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Model-specific inspection priorities */}
                <div className="rounded-xl bg-[rgba(248,180,217,0.06)] border border-[rgba(248,180,217,0.15)] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Search className="size-4 text-[#F8B4D9]" />
                    <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#F8B4D9]">{t("condition.inspectionPriorities")}</h3>
                  </div>
                  <div className="space-y-2">
                    {condition.inspectionPriorities.map((priority, i) => (
                      <div key={i} className="flex items-start gap-3 p-2.5">
                        <span className="flex items-center justify-center size-5 rounded-full bg-[#F8B4D9]/10 text-[9px] font-bold text-[#F8B4D9] shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[13px] text-[#D1D5DB]">{priority}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §9 — DUE DILIGENCE TOOLKIT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("dueDiligence")} id="section-dueDiligence" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="dueDiligence">
                <SectionHeader id="dueDiligence" title={t("sections.dueDiligence")} />

                {/* Questions to ask */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280]">{t("dueDiligence.questionsToAsk")}</h3>
                    <button
                      onClick={handleCopyQuestions}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.03] border border-white/5 text-[10px] font-medium text-[#9CA3AF] hover:text-[#F8B4D9] hover:border-[#F8B4D9]/20 transition-all"
                    >
                      {copiedQuestions ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                      {copiedQuestions ? t("dueDiligence.copied") : t("dueDiligence.copyAll")}
                    </button>
                  </div>
                  <div className="space-y-2">
                    {questions.map((q, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                        <span className="flex items-center justify-center size-6 rounded-full bg-[#F8B4D9]/10 text-[10px] font-bold text-[#F8B4D9] shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[13px] text-[#D1D5DB]">{q}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Inspection checklist */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("dueDiligence.inspectionChecklist")}</h3>
                  <div className="space-y-2">
                    {[
                      { item: "Compression test all cylinders", critical: true },
                      { item: "Full chassis and suspension inspection", critical: true },
                      { item: "Paint depth measurement (all panels)", critical: false },
                      { item: "Electronics and switchgear test", critical: false },
                      { item: "Road test (minimum 30 minutes)", critical: true },
                      { item: "Fluid analysis (engine oil, transmission)", critical: false },
                    ].map((check, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                          <div className={`size-5 rounded-md flex items-center justify-center ${check.critical ? "bg-[#F8B4D9]/10" : "bg-white/5"}`}>
                            <CheckCircle2 className={`size-3 ${check.critical ? "text-[#F8B4D9]" : "text-[#4B5563]"}`} />
                          </div>
                          <span className="text-[13px] text-[#D1D5DB]">{check.item}</span>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          check.critical ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9]" : "bg-[#4B5563]/20 text-[#4B5563]"
                        }`}>
                          {check.critical ? t("dueDiligence.required") : t("dueDiligence.recommended")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §7 — OWNERSHIP ECONOMICS
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("ownership")} id="section-ownership" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="ownership">
                <SectionHeader id="ownership" title={t("sections.ownership")} />

                {/* Annual costs */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">{t("ownership.annualCosts")}</h3>
                  <div className="space-y-3">
                    {[
                      { label: t("ownership.insurance"), value: costs.insurance, icon: <Shield className="size-4 text-[#4B5563]" /> },
                      { label: t("ownership.storage"), value: costs.storage, icon: <MapPin className="size-4 text-[#4B5563]" /> },
                      { label: t("ownership.maintenance"), value: costs.maintenance, icon: <Wrench className="size-4 text-[#4B5563]" /> },
                    ].map((item, i) => {
                      const pct = totalAnnualCost > 0 ? (item.value / totalAnnualCost) * 100 : 33
                      return (
                        <div key={i}>
                          <div className="flex items-center justify-between mb-1.5">
                            <div className="flex items-center gap-2">
                              {item.icon}
                              <span className="text-[12px] text-[#9CA3AF]">{item.label}</span>
                            </div>
                            <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(item.value, selectedRegion)}</span>
                          </div>
                          <div className="relative h-[4px] rounded-full bg-white/[0.04] overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: 0.1 + i * 0.1 }}
                              className="h-full rounded-full bg-[#F8B4D9]/30"
                            />
                          </div>
                        </div>
                      )
                    })}
                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                      <span className="text-[13px] font-semibold text-[#FFFCF7]">{t("ownership.totalAnnual")}</span>
                      <span className="text-[20px] font-mono font-bold text-[#F8B4D9]">{formatPriceForRegion(totalAnnualCost, selectedRegion)}/yr</span>
                    </div>
                  </div>
                </div>

                {/* 5-Year projection */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-4">{t("ownership.fiveYearProjection")}</h3>
                  <div className="flex items-end gap-2 md:gap-3 h-[120px]">
                    {[1, 2, 3, 4, 5].map(year => {
                      const cumulative = totalAnnualCost * year
                      const maxCumulative = totalAnnualCost * 5
                      const barHeight = (cumulative / maxCumulative) * 100
                      return (
                        <div key={year} className="flex-1 flex flex-col items-center gap-1">
                          <span className="text-[9px] font-mono text-[#6B7280]">{formatPriceForRegion(cumulative, selectedRegion)}</span>
                          <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: `${barHeight}%` }}
                            transition={{ duration: 0.6, delay: year * 0.1 }}
                            className="w-full rounded-t-md bg-[#F8B4D9]/20"
                          />
                          <span className="text-[9px] text-[#4B5563]">Yr {year}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Shipping estimates */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Truck className="size-4 text-[#F8B4D9]" />
                    <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280]">{t("ownership.shippingEstimates")}</h3>
                  </div>
                  <div className="space-y-2">
                    {[
                      { label: t("ownership.domestic"), value: shipping.domestic },
                      { label: t("ownership.euImport"), value: shipping.euImport },
                      { label: t("ownership.ukImport"), value: shipping.ukImport },
                    ].map((item, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                        <span className="text-[13px] text-[#9CA3AF]">{item.label}</span>
                        <span className="text-[14px] font-mono font-semibold text-[#FFFCF7]">{formatPriceForRegion(item.value, selectedRegion)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §8 — MARKET CONTEXT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("marketContext")} id="section-marketContext" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="marketContext">
                <SectionHeader id="marketContext" title={t("sections.marketContext")} />

                {/* Brand thesis */}
                <div className="rounded-xl bg-[rgba(248,180,217,0.06)] border border-[rgba(248,180,217,0.15)] p-5 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="size-1.5 rounded-full bg-[#F8B4D9]" />
                    <h3 className="text-[12px] font-semibold text-[#F8B4D9]">{t("marketContext.brandThesis")}: {car.make}</h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-[#D1D5DB]">{car.thesis}</p>
                </div>

                {/* Market events */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("marketContext.marketEvents")}</h3>
                  <div className="space-y-2">
                    {events.map((event, i) => (
                      <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.02]">
                        <div className="flex items-center gap-3">
                          <span className={`size-2 rounded-full ${
                            event.impact === "positive" ? "bg-emerald-400" :
                            event.impact === "negative" ? "bg-red-400" : "bg-[#4B5563]"
                          }`} />
                          <div>
                            <p className="text-[13px] text-[#FFFCF7]">{event.name}</p>
                            <p className="text-[10px] text-[#4B5563]">{event.type}</p>
                          </div>
                        </div>
                        <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                          event.impact === "positive" ? "bg-emerald-500/10 text-emerald-400" :
                          event.impact === "negative" ? "bg-red-500/10 text-red-400" :
                          "bg-white/5 text-[#4B5563]"
                        }`}>
                          {event.impact === "positive" ? t("marketContext.valuePositive") : event.impact === "negative" ? t("marketContext.valueNegative") : t("marketContext.neutral")}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §9 — SIMILAR VEHICLES
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("similar")} id="section-similar" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="similar">
                <SectionHeader id="similar" title={t("sections.similar")} />
                <p className="text-[11px] text-[#6B7280] mb-4">{t("similar.compareNote")}</p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {similarCars.slice(0, 6).map(sc => (
                    <Link
                      key={sc.id}
                      href={`/cars/${sc.make.toLowerCase().replace(/\s+/g, "-")}/${sc.id}`}
                      className="group flex items-center gap-4 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 hover:border-[rgba(248,180,217,0.15)] p-3 transition-all"
                    >
                      <div className="relative w-20 h-14 rounded-lg overflow-hidden shrink-0">
                        <Image
                          src={sc.image}
                          alt={sc.title}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">{sc.title}</p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[12px] font-mono font-semibold text-[#F8B4D9]">{formatPriceForRegion(sc.currentBid, selectedRegion)}</span>
                          <span className={`text-[9px] font-bold ${
                            sc.investmentGrade === "AAA" ? "text-emerald-400" : sc.investmentGrade === "AA" ? "text-blue-400" : "text-amber-400"
                          }`}>{sc.investmentGrade}</span>
                          <span className="text-[10px] text-emerald-400">{sc.trend}</span>
                        </div>
                      </div>
                      <ChevronRight className="size-4 text-[#4B5563] group-hover:text-[#F8B4D9] transition-colors shrink-0" />
                    </Link>
                  ))}
                </div>
              </PaywallSection>
            </section>

            {/* ═══════════════════════════════════════
                §10 — INVESTMENT VERDICT
                ═══════════════════════════════════════ */}
            <section ref={setSectionRef("verdict")} id="section-verdict" className="scroll-mt-[70px] md:scroll-mt-[100px]">
              <PaywallSection sectionId="verdict">
                <SectionHeader id="verdict" title={t("sections.verdict")} />

                {/* Verdict card */}
                <div className="rounded-2xl bg-gradient-to-br from-[rgba(248,180,217,0.08)] via-[rgba(15,14,22,0.8)] to-[rgba(15,14,22,0.6)] border border-[rgba(248,180,217,0.2)] p-6 md:p-8 mb-4">
                  <div className="text-center mb-6">
                    <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#6B7280]">{t("verdict.recommendation")}</span>
                    <p className={`text-[40px] md:text-[48px] font-black mt-1 ${
                      verdict === "buy" ? "text-emerald-400" : verdict === "hold" ? "text-amber-400" : "text-[#F8B4D9]"
                    }`}>
                      {t(`verdict.${verdict}`)}
                    </p>
                  </div>

                  <div className="flex items-center justify-center gap-4 mb-6">
                    <div className="text-center">
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">Grade</span>
                      <p className={`text-[20px] font-black ${
                        car.investmentGrade === "AAA" ? "text-emerald-400" : car.investmentGrade === "AA" ? "text-blue-400" : "text-amber-400"
                      }`}>{car.investmentGrade}</p>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="text-center">
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">5yr Return</span>
                      <p className="text-[20px] font-black text-emerald-400">+{brand5yReturn}%</p>
                    </div>
                    <div className="h-8 w-px bg-white/10" />
                    <div className="text-center">
                      <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">Risk</span>
                      <p className={`text-[20px] font-black ${riskScore <= 30 ? "text-emerald-400" : riskScore <= 50 ? "text-amber-400" : "text-red-400"}`}>{riskScore}/100</p>
                    </div>
                  </div>

                  {/* Strategy */}
                  <div className="rounded-xl bg-white/[0.03] border border-white/5 p-4">
                    <h4 className="text-[11px] font-semibold text-[#FFFCF7] mb-2">{t("verdict.strategyTitle")}</h4>
                    <p className="text-[12px] text-[#9CA3AF] leading-relaxed">
                      {t(`verdict.${verdict}Strategy`)}
                    </p>
                  </div>
                </div>

                {/* Key takeaways */}
                <div className="rounded-xl bg-[rgba(15,14,22,0.6)] border border-white/5 p-5 mb-4">
                  <h3 className="text-[11px] font-semibold tracking-[0.15em] uppercase text-[#6B7280] mb-3">{t("verdict.keyTakeaways")}</h3>
                  <div className="space-y-2">
                    {[
                      `${car.investmentGrade} investment grade with ${brand5yReturn}% 5-year return`,
                      isBelowFair ? `Currently priced below fair value in ${effectiveRegion}` : `Trading near fair value in ${effectiveRegion}`,
                      `Annual ownership costs of ${formatPriceForRegion(totalAnnualCost, selectedRegion)}`,
                      hasArbitrage ? `Arbitrage opportunity: ${formatUsd(arbitrageSavings)} savings via ${regionLabels[bestRegion]?.short} market` : `${car.make} brand showing consistent appreciation trend`,
                    ].map((takeaway, i) => (
                      <div key={i} className="flex items-start gap-3 p-3 rounded-lg bg-white/[0.02]">
                        <CheckCircle2 className="size-4 text-[#F8B4D9] mt-0.5 shrink-0" />
                        <span className="text-[13px] text-[#D1D5DB]">{takeaway}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="rounded-xl bg-white/[0.02] border border-white/[0.03] p-4">
                  <p className="text-[10px] text-[#4B5563] leading-relaxed italic">
                    {t("verdict.disclaimer")}
                  </p>
                </div>
              </PaywallSection>
            </section>

          </div>
        </div>
      </div>

      {/* ═══ MOBILE: Floating download button ═══ */}
      {hasAccess && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0b0b10]/90 backdrop-blur-xl border-t border-[rgba(248,180,217,0.08)]">
          <div className="px-4 py-2.5">
            <button
              onClick={() => setShowDownloadSheet(true)}
              disabled={downloadingPdf || downloadingExcel}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-[rgba(248,180,217,0.2)] bg-[rgba(248,180,217,0.06)] text-[#F8B4D9] font-semibold text-[12px] hover:bg-[rgba(248,180,217,0.1)] active:scale-[0.97] transition-all disabled:opacity-50"
            >
              {(downloadingPdf || downloadingExcel) ? (
                <>
                  <div className="size-3.5 rounded-full border-2 border-[#F8B4D9]/30 border-t-[#F8B4D9] animate-spin" />
                  <span>{t("downloadGenerating")}</span>
                </>
              ) : (
                <>
                  <Download className="size-3.5" />
                  <span>{t("downloadButton")}</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ═══ DOWNLOAD SHEET ═══ */}
      <AnimatePresence>
        {showDownloadSheet && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-[70] flex items-end md:items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#0b0b10]/60 backdrop-blur-sm" onClick={() => !downloadingPdf && !downloadingExcel && setShowDownloadSheet(false)} />

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ type: "spring", damping: 28, stiffness: 250, delay: 0.05 }}
              className="relative w-full max-w-sm mx-4 mb-0 md:mb-0 rounded-t-2xl md:rounded-2xl bg-[#111114] border border-white/10 shadow-2xl overflow-hidden"
            >
              {/* Pink accent line */}
              <div className="h-[2px] bg-gradient-to-r from-transparent via-[#F8B4D9] to-transparent" />

              {/* Header */}
              <div className="px-6 pt-6 pb-4 text-center">
                <div className="size-11 rounded-full bg-[#F8B4D9]/10 flex items-center justify-center mx-auto mb-3">
                  <Download className="size-5 text-[#F8B4D9]" />
                </div>
                <h3 className="text-[16px] font-bold text-[#FFFCF7]">{t("downloadButton")}</h3>
                <p className="text-[11px] text-[#6B7280] mt-1">{car.title}</p>
              </div>

              {/* Options */}
              <div className="px-5 pb-6 space-y-2.5">
                <button
                  onClick={() => { handleDownloadPdf(); setShowDownloadSheet(false) }}
                  disabled={downloadingPdf}
                  className="w-full flex items-center gap-4 p-4 rounded-xl bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde] active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {downloadingPdf ? (
                    <div className="size-5 rounded-full border-2 border-[#0b0b10]/30 border-t-[#0b0b10] animate-spin shrink-0" />
                  ) : (
                    <FileText className="size-5 shrink-0" />
                  )}
                  <div className="text-left flex-1">
                    <p className="text-[13px] font-bold">{t("downloadPdf")}</p>
                    <p className="text-[10px] opacity-60">{t("downloadPdfDesc")}</p>
                  </div>
                  <ChevronRight className="size-4 opacity-40 shrink-0" />
                </button>

                <button
                  onClick={() => { handleDownloadExcel(); setShowDownloadSheet(false) }}
                  disabled={downloadingExcel}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border border-white/10 bg-white/[0.03] text-[#FFFCF7] hover:bg-white/[0.06] active:scale-[0.98] transition-all disabled:opacity-60"
                >
                  {downloadingExcel ? (
                    <div className="size-5 rounded-full border-2 border-[#F8B4D9]/30 border-t-[#F8B4D9] animate-spin shrink-0" />
                  ) : (
                    <BarChart3 className="size-5 text-[#F8B4D9] shrink-0" />
                  )}
                  <div className="text-left flex-1">
                    <p className="text-[13px] font-semibold">{t("downloadExcel")}</p>
                    <p className="text-[10px] text-[#6B7280]">{t("downloadExcelDesc")}</p>
                  </div>
                  <ChevronRight className="size-4 text-[#4B5563] shrink-0" />
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ PRICING MODAL ═══ */}
      <AnimatePresence>
        {showPricing && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[80] flex items-end md:items-center justify-center"
          >
            <div className="absolute inset-0 bg-[#0b0b10]/70 backdrop-blur-md" onClick={() => !purchaseProcessing && setShowPricing(false)} />

            <motion.div
              initial={{ opacity: 0, y: 60 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 60 }}
              transition={{ type: "spring", damping: 25, stiffness: 200, delay: 0.1 }}
              className="relative w-full max-w-2xl mx-4 mb-0 md:mb-0 rounded-t-2xl md:rounded-2xl bg-[#0F1012] border border-white/10 shadow-2xl overflow-hidden max-h-[90vh] md:max-h-[85vh] overflow-y-auto"
            >
              {/* Top gradient bar */}
              <div className="h-0.5 bg-gradient-to-r from-[#F8B4D9] via-[#F8B4D9]/40 to-transparent" />

              {/* Close button */}
              <button
                onClick={() => !purchaseProcessing && setShowPricing(false)}
                className="absolute top-4 right-4 z-10 size-8 rounded-full bg-white/5 flex items-center justify-center text-[#6B7280] hover:text-[#FFFCF7] hover:bg-white/10 transition-all"
              >
                <span className="text-[16px]">&times;</span>
              </button>

              {/* SUCCESS STATE */}
              {purchaseSuccess ? (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="px-6 py-16 text-center"
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", damping: 15, stiffness: 200, delay: 0.1 }}
                    className="size-16 rounded-full bg-emerald-400/10 flex items-center justify-center mx-auto mb-4"
                  >
                    <Check className="size-8 text-emerald-400" />
                  </motion.div>
                  <h3 className="text-[20px] font-bold text-[#FFFCF7]">{tPricing("successTitle")}</h3>
                  <p className="text-[13px] text-[#6B7280] mt-2">{tPricing("successDesc")}</p>
                </motion.div>
              ) : (
                <>
                  {/* Header */}
                  <div className="px-6 pt-8 pb-2 text-center">
                    <div className="size-12 rounded-full bg-[#F8B4D9]/10 flex items-center justify-center mx-auto mb-3">
                      <Sparkles className="size-6 text-[#F8B4D9]" />
                    </div>
                    <h3 className="text-[20px] font-bold text-[#FFFCF7]">{tPricing("title")}</h3>
                    <p className="text-[12px] text-[#6B7280] mt-1 max-w-md mx-auto">{tPricing("subtitle")}</p>
                  </div>

                  {/* Plans grid */}
                  <div className="px-6 pt-5 pb-4 grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* ─── SINGLE REPORT ─── */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-[13px] font-semibold text-[#FFFCF7]">{tPricing("single.name")}</h4>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{tPricing("single.desc")}</p>
                      </div>
                      <div className="mb-4">
                        <span className="text-[32px] font-black text-[#FFFCF7]">{tPricing("single.price")}</span>
                        <span className="text-[11px] text-[#4B5563] ml-1.5">{tPricing("single.period")}</span>
                      </div>
                      <div className="space-y-2 mb-5 flex-1">
                        {(["feature1", "feature2", "feature3", "feature4"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-[#F8B4D9] shrink-0" />
                            <span className="text-[11px] text-[#9CA3AF]">{tPricing(`single.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handlePurchase("single")}
                        disabled={!!purchaseProcessing}
                        className="w-full py-3 rounded-xl border border-white/10 text-[#FFFCF7] font-semibold text-[12px] hover:bg-white/[0.05] disabled:opacity-50 transition-all"
                      >
                        {purchaseProcessing === "single" ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-3.5 rounded-full border-2 border-[#F8B4D9] border-t-transparent animate-spin" />
                            {tPricing("processing")}
                          </span>
                        ) : tPricing("single.cta")}
                      </button>
                    </div>

                    {/* ─── EXPLORER PACK (HIGHLIGHTED) ─── */}
                    <div className="rounded-xl border border-[#F8B4D9]/30 bg-[rgba(248,180,217,0.04)] p-5 flex flex-col relative">
                      <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                        <span className="px-3 py-1 rounded-full bg-[#F8B4D9] text-[#0b0b10] text-[9px] font-bold uppercase tracking-wider">
                          {tPricing("explorer.badge")}
                        </span>
                      </div>
                      <div className="mb-4 mt-1">
                        <h4 className="text-[13px] font-semibold text-[#FFFCF7]">{tPricing("explorer.name")}</h4>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{tPricing("explorer.desc")}</p>
                      </div>
                      <div className="mb-1">
                        <span className="text-[32px] font-black text-[#FFFCF7]">{tPricing("explorer.price")}</span>
                        <span className="text-[11px] text-[#4B5563] ml-1.5">{tPricing("explorer.period")}</span>
                      </div>
                      <p className="text-[10px] text-[#F8B4D9] font-mono font-semibold mb-4">{tPricing("explorer.perReport")}</p>
                      <div className="space-y-2 mb-5 flex-1">
                        {(["feature1", "feature2", "feature3", "feature4"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-[#F8B4D9] shrink-0" />
                            <span className="text-[11px] text-[#9CA3AF]">{tPricing(`explorer.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handlePurchase("explorer")}
                        disabled={!!purchaseProcessing}
                        className="w-full py-3 rounded-xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[12px] hover:bg-[#f4cbde] disabled:opacity-50 active:scale-[0.97] transition-all"
                      >
                        {purchaseProcessing === "explorer" ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-3.5 rounded-full border-2 border-[#0b0b10] border-t-transparent animate-spin" />
                            {tPricing("processing")}
                          </span>
                        ) : tPricing("explorer.cta")}
                      </button>
                    </div>

                    {/* ─── UNLIMITED ─── */}
                    <div className="rounded-xl border border-white/10 bg-white/[0.02] p-5 flex flex-col">
                      <div className="mb-4">
                        <h4 className="text-[13px] font-semibold text-[#FFFCF7]">{tPricing("unlimited.name")}</h4>
                        <p className="text-[11px] text-[#6B7280] mt-0.5">{tPricing("unlimited.desc")}</p>
                      </div>
                      <div className="mb-4">
                        <span className="text-[32px] font-black text-[#FFFCF7]">{tPricing("unlimited.price")}</span>
                        <span className="text-[11px] text-[#4B5563] ml-0.5">{tPricing("unlimited.period")}</span>
                      </div>
                      <div className="space-y-2 mb-5 flex-1">
                        {(["feature1", "feature2", "feature3", "feature4"] as const).map(key => (
                          <div key={key} className="flex items-center gap-2">
                            <CheckCircle2 className="size-3.5 text-[#F8B4D9] shrink-0" />
                            <span className="text-[11px] text-[#9CA3AF]">{tPricing(`unlimited.${key}`)}</span>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={() => handlePurchase("unlimited")}
                        disabled={!!purchaseProcessing}
                        className="w-full py-3 rounded-xl border border-white/10 text-[#FFFCF7] font-semibold text-[12px] hover:bg-white/[0.05] disabled:opacity-50 transition-all"
                      >
                        {purchaseProcessing === "unlimited" ? (
                          <span className="flex items-center justify-center gap-2">
                            <div className="size-3.5 rounded-full border-2 border-[#F8B4D9] border-t-transparent animate-spin" />
                            {tPricing("processing")}
                          </span>
                        ) : tPricing("unlimited.cta")}
                      </button>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="px-6 pb-6 pt-2">
                    <div className="flex items-center justify-center gap-2 mb-3">
                      <Coins className="size-3.5 text-[#F8B4D9]" />
                      <span className="text-[11px] text-[#6B7280]">
                        {tPricing("currentBalance")}: <span className="font-mono font-semibold text-[#FFFCF7]">{tokens.toLocaleString()}</span> {tPricing("tokens")}
                      </span>
                    </div>
                    <p className="text-[10px] text-[#4B5563] text-center">
                      {tPricing("guarantee")}
                    </p>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
