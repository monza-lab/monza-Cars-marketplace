"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, User, X, TrendingUp, BarChart3, Car, LogOut, Coins, Bookmark, FileText, Bell, Settings, Phone, ChevronRight, Clock, Globe, Award, Calendar, LinkIcon, ShieldCheck, Scale } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { CURATED_CARS, searchCars, type CollectorCar } from "@/lib/curatedCars";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { useRegion } from "@/lib/RegionContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { ViewToggle } from "./ViewToggle";
import { saveSearchQuery } from "@/lib/searchHistory";
import { getBrandConfig } from "@/lib/brandConfig";
import { CurrencyDropdown } from "./CurrencyDropdown";
import { stripHtml } from "@/lib/stripHtml";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

// ─── SMART SEARCH ENGINE (powered by brandConfig) ───

type SearchItem = {
  type: "family" | "series" | "variant" | "link"
  label: string
  subtitle: string
  family?: string
  seriesId?: string
  variantId?: string
  yearRange?: string
  keywords: string[]
  url?: string
}

// ─── AUCTION URL DETECTION ───

const AUCTION_PLATFORMS: { pattern: RegExp; name: string; icon: string }[] = [
  { pattern: /bringatrailer\.com/i, name: "Bring a Trailer", icon: "BaT" },
  { pattern: /carsandbids\.com/i, name: "Cars & Bids", icon: "C&B" },
  { pattern: /pcarmarket\.com/i, name: "PCarMarket", icon: "PCM" },
  { pattern: /collectingcars\.com/i, name: "Collecting Cars", icon: "CC" },
  { pattern: /rmsothebys\.com/i, name: "RM Sotheby's", icon: "RM" },
  { pattern: /bonhams\.com/i, name: "Bonhams", icon: "BH" },
  { pattern: /elferspot\.com/i, name: "Elferspot", icon: "ES" },
  { pattern: /hemmings\.com/i, name: "Hemmings", icon: "HM" },
  { pattern: /bat\.vin/i, name: "Bring a Trailer", icon: "BaT" },
]

function detectAuctionUrl(input: string): SearchItem | null {
  const trimmed = input.trim()
  if (!trimmed.match(/^https?:\/\//i) && !trimmed.match(/^www\./i)) return null

  for (const platform of AUCTION_PLATFORMS) {
    if (platform.pattern.test(trimmed)) {
      return {
        type: "link",
        label: `Analyze listing from ${platform.name}`,
        subtitle: "Paste detected — get full investment report",
        keywords: [],
        url: trimmed.startsWith("http") ? trimmed : `https://${trimmed}`,
      }
    }
  }

  // Generic URL that looks like a car listing
  if (trimmed.match(/^https?:\/\//i)) {
    return {
      type: "link",
      label: "Analyze this listing",
      subtitle: "Paste a link to get an investment report",
      keywords: [],
      url: trimmed,
    }
  }

  return null
}

function buildSearchIndex(): SearchItem[] {
  const config = getBrandConfig("porsche")
  if (!config) return []

  const items: SearchItem[] = []

  for (const group of config.familyGroups) {
    items.push({
      type: "family",
      label: group.label,
      subtitle: `${group.seriesIds.length} series`,
      keywords: [group.label.toLowerCase(), ...group.seriesIds],
    })
  }

  for (const series of config.series) {
    items.push({
      type: "series",
      label: series.label,
      subtitle: `${series.yearRange[0]}–${series.yearRange[1]}`,
      family: series.family,
      seriesId: series.id,
      yearRange: `${series.yearRange[0]}–${series.yearRange[1]}`,
      keywords: [series.label.toLowerCase(), series.id, ...series.keywords],
    })

    if (series.variants) {
      for (const variant of series.variants) {
        items.push({
          type: "variant",
          label: `${series.label} ${variant.label}`,
          subtitle: `${series.family} · ${series.yearRange[0]}–${series.yearRange[1]}`,
          family: series.family,
          seriesId: series.id,
          variantId: variant.id,
          keywords: [
            variant.label.toLowerCase(),
            `${series.label} ${variant.label}`.toLowerCase(),
            ...variant.keywords.map(k => k.toLowerCase()),
            series.id,
          ],
        })
      }
    }
  }

  return items
}

const SEARCH_INDEX = buildSearchIndex()

// Levenshtein distance for typo tolerance
function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length
  if (m === 0) return n
  if (n === 0) return m
  const dp: number[] = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    let prev = i - 1
    dp[0] = i
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j]
      dp[j] = a[i - 1] === b[j - 1] ? prev : 1 + Math.min(prev, dp[j], dp[j - 1])
      prev = tmp
    }
  }
  return dp[n]
}

// Check if query is a typo-match for target (max distance scales with word length)
function isTypoMatch(query: string, target: string): boolean {
  if (query.length <= 2) return false
  const maxDist = query.length <= 4 ? 1 : 2
  // Check each word in target
  const targetWords = target.split(/\s+/)
  for (const word of targetWords) {
    if (levenshtein(query, word) <= maxDist) return true
  }
  // Also check if query is a typo of the full target
  if (target.length <= query.length + 3 && levenshtein(query, target) <= maxDist) return true
  return false
}

function searchItems(query: string): SearchItem[] {
  if (!query.trim()) return []

  let q = query.toLowerCase().trim()

  // If typing "por", "pors", "porsc", "porsche" etc. — show browse suggestions
  // This catches both the word in progress and full "porsche" with no suffix
  const porscheTyping = /^(?:por|pors|porsc|porsch|porsche|posrche|prsche|porshe|porche|porsché)\s*$/i
  if (porscheTyping.test(q)) {
    return SEARCH_INDEX
      .filter(item => item.type === "family" || item.type === "series")
      .sort((a, b) => {
        const typePriority: Record<string, number> = { family: 3, series: 2, variant: 1, link: 4 }
        return (typePriority[b.type] || 0) - (typePriority[a.type] || 0)
      })
      .slice(0, 8)
  }

  // Strip "porsche" prefix for the actual search (e.g. "porsche gt3" → "gt3")
  q = q.replace(/^(?:porsche|posrche|prsche|porshe|porche|porsch|porsché)\s+/i, "")
  if (!q) return []

  // Split multi-word query for multi-token matching
  const tokens = q.split(/\s+/).filter(t => t.length > 0)

  return SEARCH_INDEX
    .map(item => {
      const lowerLabel = item.label.toLowerCase()
      let bestScore = 0

      // Full query matching against label
      if (lowerLabel === q) bestScore = 100
      else if (lowerLabel.startsWith(q)) bestScore = Math.max(bestScore, 90)
      else if (lowerLabel.includes(q)) bestScore = Math.max(bestScore, 70)

      // Keyword matching
      for (const kw of item.keywords) {
        if (kw === q) { bestScore = Math.max(bestScore, 85); break }
        if (kw.startsWith(q)) bestScore = Math.max(bestScore, 75)
        else if (kw.includes(q)) bestScore = Math.max(bestScore, 55)
      }

      // Multi-token: all tokens must match somewhere (label or keywords)
      if (tokens.length > 1 && bestScore < 60) {
        const searchable = [lowerLabel, ...item.keywords, item.subtitle.toLowerCase()].join(" ")
        const allMatch = tokens.every(t =>
          searchable.includes(t) || isTypoMatch(t, searchable)
        )
        if (allMatch) bestScore = Math.max(bestScore, 65)
      }

      // Typo tolerance on single token
      if (bestScore < 30) {
        if (isTypoMatch(q, lowerLabel)) bestScore = Math.max(bestScore, 45)
        for (const kw of item.keywords) {
          if (isTypoMatch(q, kw)) { bestScore = Math.max(bestScore, 40); break }
        }
      }

      // Fuzzy: all chars present in order (catches abbreviations)
      if (bestScore < 20 && q.length >= 2) {
        let qi = 0
        for (let i = 0; i < lowerLabel.length && qi < q.length; i++) {
          if (lowerLabel[i] === q[qi]) qi++
        }
        if (qi === q.length) bestScore = Math.max(bestScore, 25)
      }

      return bestScore > 0 ? { item, score: bestScore } : null
    })
    .filter((r): r is { item: SearchItem; score: number } => r !== null)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      const typePriority: Record<string, number> = { family: 3, series: 2, variant: 1, link: 4 }
      return (typePriority[b.item.type] || 0) - (typePriority[a.item.type] || 0)
    })
    .slice(0, 8)
    .map(r => r.item)
}

const SEARCH_TYPE_ICON = { family: Award, series: Calendar, variant: ShieldCheck, link: LinkIcon } as const

const REGIONS = [
  { id: "all", label: "ALL" },
  { id: "US", label: "US" },
  { id: "UK", label: "UK" },
  { id: "EU", label: "EU" },
  { id: "JP", label: "JP" },
];

// Menu links - labels will be translated in the component
const menuLinkKeys = [
  { href: "/auctions", key: "liveListings" },
  { href: "/search", key: "marketSearch" },
  { href: "/pricing", key: "pricing" },
  { href: "/about", key: "about" },
] as const;


// Response type with optional car context for navigation
type OracleResponse = {
  answer: string;
  chips: OracleChip[];
  carContext?: { id: string; make: string } | null;
  brandContext?: string | null;
};

type OracleChipId =
  | "viewCarDetails"
  | "viewFullDetails"
  | "similarCars"
  | "browseBrand"
  | "viewLiveListings"
  | "browseAll"
  | "browseByBrand"
  | "viewAllUnderBudget"
  | "bestRoiCars"
  | "setPriceAlert"
  | "viewAllBrand"
  | "compareModels"
  | "setAlerts";

type OracleChip = {
  id: OracleChipId;
};

// TODO(i18n): move to messages/*.json — oracle responses currently English-only
// Generate intelligent response based on query and car data
function getResponseForQuery(
  query: string,
  t: (key: string, values?: any) => string,
  formatPrice: (usdAmount: number) => string
): OracleResponse {
  const lowerQuery = query.toLowerCase();

  // Search for matching cars
  const matchingCars = searchCars(query);

  // Check for specific query types
  const isFairValueQuery = lowerQuery.includes("fair value") || lowerQuery.includes("worth") || lowerQuery.includes("price") || lowerQuery.includes("value");
  const isBudgetQuery = lowerQuery.includes("under") || lowerQuery.includes("below") || lowerQuery.includes("less than") || lowerQuery.includes("budget");
  const isTrendQuery = lowerQuery.includes("trend") || lowerQuery.includes("appreciation") || lowerQuery.includes("appreciating") || lowerQuery.includes("growing");
  const isBestQuery = lowerQuery.includes("best") || lowerQuery.includes("top") || lowerQuery.includes("recommend");
  const isCompareQuery = lowerQuery.includes("compare") || lowerQuery.includes("vs") || lowerQuery.includes("versus") || lowerQuery.includes("difference");

  // Extract budget amount if present
  const budgetMatch = lowerQuery.match(/(\d+)k|(\d+),?000|(\d+)m/i);
  let budgetAmount = 0;
  if (budgetMatch) {
    if (budgetMatch[1]) budgetAmount = parseInt(budgetMatch[1]) * 1000;
    else if (budgetMatch[2]) budgetAmount = parseInt(budgetMatch[2].replace(",", "")) * 1000;
    else if (budgetMatch[3]) budgetAmount = parseInt(budgetMatch[3]) * 1000000;
  }

  // If specific car(s) found and it's a value/price query
  if (matchingCars.length === 1 && isFairValueQuery) {
    const car = matchingCars[0];
    return {
      answer: `**${car.title}**

**Market Data:**
• Price: **${formatPrice(car.currentBid)}**${car.status === "ACTIVE" || car.status === "ENDING_SOON" ? ` with ${car.bidCount} bids` : ""}
• Platform: ${car.platform.replace(/_/g, " ")}
• Mileage: ${car.mileage.toLocaleString()} ${car.mileageUnit}
• Location: ${car.location}

**Vehicle Specs:**
• Engine: ${car.engine}
• Transmission: ${car.transmission}
• Year: ${car.year}

**About this Vehicle** _(Editorial)_
${stripHtml(car.thesis)}

_Note: Price data from real auction results. No value estimates._`,
      chips: [{ id: "viewCarDetails" }, { id: "similarCars" }, { id: "browseBrand" }],
      carContext: { id: car.id, make: car.make },
    };
  }

  // If looking for cars under a budget
  if (isBudgetQuery && budgetAmount > 0) {
    const affordableCars = CURATED_CARS.filter(car => car.make !== "Ferrari" && car.currentBid <= budgetAmount)
      .sort((a, b) => b.trendValue - a.trendValue)
      .slice(0, 5);

    if (affordableCars.length > 0) {
      const carList = affordableCars.map(car =>
        `• **${car.year} ${car.make} ${car.model}** — ${formatPrice(car.currentBid)} (${car.trend})`
      ).join("\n");

      return {
        answer: `**Collector Cars Under ${formatPrice(budgetAmount)}**

Based on your budget, here are the top appreciating assets:

${carList}

**Investment Insight:** At this price point, focus on ${affordableCars[0].category} vehicles. The ${affordableCars[0].title} offers the strongest appreciation potential at ${affordableCars[0].trend}.

**Key Considerations:**
• Prioritize documented history and matching numbers
• JDM vehicles continue to surge with 25-year import eligibility
• Manual transmissions command 15-20% premiums over automatics`,
        chips: [{ id: "viewAllUnderBudget" }, { id: "bestRoiCars" }, { id: "setPriceAlert" }],
        carContext: null,
      };
    }
  }

  // If asking about trends or appreciation
  if (isTrendQuery) {
    const liveCars = CURATED_CARS.filter(c => c.make !== "Ferrari" && (c.status === "ACTIVE" || c.status === "ENDING_SOON"));
    const topBidActivity = liveCars.sort((a, b) => b.bidCount - a.bidCount).slice(0, 5);

    const carList = topBidActivity.map(car =>
      `• **${car.title}** — ${formatPrice(car.currentBid)} (${car.bidCount} bids)`
    ).join("\n");

    return {
      answer: `**Most Active Listings Right Now**

${carList}

**Market Activity:**
• ${liveCars.length} live listings being tracked
• Total collection: ${CURATED_CARS.filter(c => c.make !== "Ferrari").length} vehicles
• Platforms: Bring a Trailer, Cars & Bids, AutoScout24, AutoTrader

**What's Hot** _(Editorial)_
JDM vehicles and analog supercars continue to attract strong market activity. Manual transmission examples consistently generate more competition.

_Note: Data from real market results. Past performance not indicative of future results._`,
      chips: [{ id: "viewLiveListings" }, { id: "setAlerts" }, { id: "browseAll" }],
      carContext: null,
    };
  }

  // If multiple cars match (brand/category search)
  if (matchingCars.length > 1) {
    const sortedCars = matchingCars.sort((a, b) => b.currentBid - a.currentBid).slice(0, 5);
    const brandOrCategory = sortedCars[0].make;
    const liveCars = matchingCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON");

    const carList = sortedCars.map(car =>
      `• **${car.title}** — ${formatPrice(car.currentBid)} ${car.status === "ACTIVE" || car.status === "ENDING_SOON" ? "(Live)" : "(Sold)"}`
    ).join("\n");

    return {
      answer: `**${brandOrCategory} Collection**

We're tracking ${matchingCars.length} ${brandOrCategory} vehicles:

${carList}

**Market Data:**
• Live auctions: **${liveCars.length}**
• Price range: ${formatPrice(Math.min(...sortedCars.map(c => c.currentBid)))}–${formatPrice(Math.max(...sortedCars.map(c => c.currentBid)))}
• Platforms: ${[...new Set(sortedCars.map(c => c.platform.replace(/_/g, " ")))].slice(0, 3).join(", ")}

**About ${brandOrCategory}** _(Editorial)_
${sortedCars[0].thesis}

_Data from real auction results._`,
      chips: [{ id: "viewAllBrand" }, { id: "compareModels" }, { id: "setAlerts" }],
      brandContext: brandOrCategory,
    };
  }

  // Single car match but general question
  if (matchingCars.length === 1) {
    const car = matchingCars[0];

    return {
      answer: `**${car.title}**

**Market Data:**
• Price: **${formatPrice(car.currentBid)}**${car.status === "ACTIVE" || car.status === "ENDING_SOON" ? ` with ${car.bidCount} bids` : ""}
• Platform: ${car.platform.replace(/_/g, " ")}
• Location: ${car.location}

**Vehicle Specs:**
• Engine: ${car.engine}
• Transmission: ${car.transmission}
• Mileage: ${car.mileage.toLocaleString()} ${car.mileageUnit}

**Seller's Notes:** ${stripHtml(car.history)}

**About this Model** _(Editorial)_
${stripHtml(car.thesis)}`,
      chips: [{ id: "viewFullDetails" }, { id: "similarCars" }, { id: "browseBrand" }],
      carContext: { id: car.id, make: car.make },
    };
  }

  // Default: Market overview with real data (excluding curated Ferraris)
  const nonFerrariCurated = CURATED_CARS.filter(c => c.make !== "Ferrari");
  const totalCars = nonFerrariCurated.length;
  const liveCars = nonFerrariCurated.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON");
  const totalValue = nonFerrariCurated.reduce((sum, c) => sum + c.currentBid, 0);
  const topBidActivity = liveCars.sort((a, b) => b.bidCount - a.bidCount)[0];

  return {
    answer: `**Monza Lab Market Overview**

We're tracking ${totalCars} collector vehicles across multiple auction platforms.

**Current Activity:**
• **${liveCars.length}** live auctions
• **${totalCars - liveCars.length}** completed sales
• Total tracked value: **${formatPrice(totalValue)}**

${topBidActivity ? `**Most Active:** ${topBidActivity.title} — ${formatPrice(topBidActivity.currentBid)} with ${topBidActivity.bidCount} bids` : ""}

**Platforms Tracked:**
• Bring a Trailer • Cars & Bids • Collecting Cars

**Try Asking:**
• "Show me Porsche under $200K"
• "What's the price of a Toyota Supra?"
• "Browse Ferrari collection"

_All prices from real market data._`,
    chips: [{ id: "viewLiveListings" }, { id: "browseByBrand" }, { id: "setAlerts" }],
    carContext: null,
  };
}

// ─── CHIP ROUTE MAPPING ───
// Check if chip starts with "View All" for brand-specific navigation
function getChipRoute(
  chip: OracleChip,
  carContext?: { id: string; make: string } | null,
  brandContext?: string | null
): string {
  // Car-specific routes
  if (carContext) {
    const makePath = carContext.make.toLowerCase().replace(/\s+/g, "-");
    if (chip.id === "viewCarDetails" || chip.id === "viewFullDetails") {
      return `/cars/${makePath}/${carContext.id}`;
    }
    if (chip.id === "similarCars") {
      return `/cars/${makePath}`;
    }
    if (chip.id === "browseBrand") {
      return `/cars/${makePath}`;
    }
  }

  // Brand-specific routes
  if (brandContext) {
    const makePath = brandContext.toLowerCase().replace(/\s+/g, "-");
    if (chip.id === "viewAllBrand") {
      return `/cars/${makePath}`;
    }
  }

  // General routes
  const staticRoutes: Record<OracleChipId, string> = {
    viewCarDetails: "/",
    viewFullDetails: "/",
    similarCars: "/",
    browseBrand: "/",
    viewLiveListings: "/auctions",
    browseAll: "/auctions",
    browseByBrand: "/cars",
    viewAllUnderBudget: "/",
    bestRoiCars: "/?sortBy=trendValue&sortOrder=desc",
    setPriceAlert: "/alerts",
    viewAllBrand: "/",
    compareModels: "/",
    setAlerts: "/alerts",
  };

  return staticRoutes[chip.id] || "/";
}

// Routes that are coming soon (show toast instead of navigating)
const comingSoonRoutes: Record<string, string> = {
  "/market-trends": "oracle.comingSoon.marketReport",
  "/alerts": "oracle.comingSoon.priceAlerts",
};

// ─── INLINE TOAST COMPONENT ───
function OracleToast({
  message,
  isVisible,
  onClose,
}: {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 2500);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-full bg-card border border-primary/20 px-5 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <Scale className="size-4 text-primary" />
          <span className="text-[13px] font-medium text-foreground">{message}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── THE ORACLE OVERLAY ───
function OracleOverlay({
  isOpen,
  onClose,
  query,
}: {
  isOpen: boolean;
  onClose: () => void;
  query: string;
}) {
  const t = useTranslations();
  const router = useRouter();
  const { formatPrice } = useCurrency();
  const [phase, setPhase] = useState<"loading" | "ready">("loading");
  const [response, setResponse] = useState<OracleResponse | null>(null);
  const [toastMessage, setToastMessage] = useState("");
  const [showToast, setShowToast] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // Handle chip click navigation
  const handleChipClick = (chip: OracleChip) => {
    if (!response) return;
    const route = getChipRoute(chip, response.carContext, response.brandContext);
    if (comingSoonRoutes[route]) {
      setToastMessage(t(comingSoonRoutes[route]));
      setShowToast(true);
    } else {
      onClose();
      router.push(route);
    }
  };

  const handleToastClose = useCallback(() => setShowToast(false), []);

  // Simple effect: when opens, load after delay
  useEffect(() => {
    if (!isOpen) {
      setPhase("loading");
      setResponse(null);
      return;
    }

    // Calculate response and show after brief delay
    const result = getResponseForQuery(query, t, formatPrice);
    const timer = setTimeout(() => {
      setResponse(result);
      setPhase("ready");
    }, 600);

    return () => clearTimeout(timer);
  }, [isOpen, query, t, formatPrice]);

  // Close on ESC
  useEffect(() => {
    if (!isOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [isOpen, onClose]);

  // Close on click outside
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (overlayRef.current && !overlayRef.current.contains(e.target as Node)) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-background/60 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />

          {/* Oracle Card */}
          <motion.div
            ref={overlayRef}
            initial={{ opacity: 0, y: -20, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed left-1/2 -translate-x-1/2 top-28 z-50 w-full max-w-3xl mx-4"
          >
            <div className="bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10">
                <div className="flex items-center gap-2">
                  <Scale className="size-4 text-primary" />
                  <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-primary">
                    {t("oracle.aiAnalysis")}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="size-8 flex items-center justify-center rounded-full hover:bg-foreground/5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Query Echo */}
              <div className="px-6 pt-4">
                <p className="text-[13px] text-muted-foreground">
                  <span className="text-muted-foreground/60">{t("oracle.youAsked")}</span>{" "}
                  <span className="text-foreground">"{query}"</span>
                </p>
              </div>

              {/* Content */}
              <div className="px-6 py-5 max-h-[50vh] overflow-y-auto no-scrollbar">
                {phase === "loading" ? (
                  // Loading State
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-primary animate-pulse" />
                      <span className="text-[14px] text-foreground/70">
                        {t("oracle.analyzingMarket")}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-primary/8 rounded animate-pulse w-full" />
                      <div className="h-4 bg-primary/8 rounded animate-pulse w-5/6" />
                      <div className="h-4 bg-primary/8 rounded animate-pulse w-4/6" />
                    </div>
                  </div>
                ) : response ? (
                  // Answer - simple text display (no typewriter)
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-[15px] leading-relaxed text-foreground whitespace-pre-wrap">
                      {response.answer.split("\n").map((line, i) => {
                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                        return (
                          <p key={i} className={line.startsWith("•") ? "pl-4 my-1" : "my-3"}>
                            {parts.map((part, j) => {
                              if (part.startsWith("**") && part.endsWith("**")) {
                                return (
                                  <span key={j} className="font-semibold text-primary">
                                    {part.slice(2, -2)}
                                  </span>
                                );
                              }
                              return <span key={j}>{part}</span>;
                            })}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Follow-up Chips */}
              {response && response.chips.length > 0 && (
                <div className="px-6 pb-5 pt-2 border-t border-primary/8">
                  <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-3">
                    {t("oracle.relatedActions")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {response.chips.map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => handleChipClick(chip)}
                        className="flex items-center gap-1.5 rounded-full bg-primary/8 border border-primary/15 px-4 py-2 text-[11px] font-medium text-primary cursor-pointer hover:bg-primary/20 hover:border-primary/30 active:scale-95 transition-all duration-150"
                      >
                        {i === 0 && <Car className="size-3" />}
                        {i === 1 && <BarChart3 className="size-3" />}
                        {i === 2 && <TrendingUp className="size-3" />}
                        {chip.id === "viewAllBrand" && response.brandContext
                          ? t("oracle.chips.viewAllBrand", { brand: response.brandContext })
                          : t(`oracle.chips.${chip.id}`)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}

      {/* Toast Notification */}
      <OracleToast
        message={toastMessage}
        isVisible={showToast}
        onClose={handleToastClose}
      />
    </AnimatePresence>
  );
}

// ─── INLINE LANGUAGE SWITCHER (for hamburger menu) ───
const LOCALE_LABELS: Record<string, string> = { en: "EN", es: "ES", de: "DE", ja: "JA" }

function InlineLanguageSwitcher() {
  const locale = useLocale()
  const pathname = usePathname()
  const router = useRouter()

  const handleChange = (newLocale: string) => {
    const query = typeof window !== "undefined" ? window.location.search : ""
    const href = query ? `${pathname}${query}` : pathname
    router.replace(href, { locale: newLocale })
  }

  return (
    <div className="flex items-center gap-0.5">
      {["en", "es", "de", "ja"].map((loc, i) => (
        <div key={loc} className="flex items-center">
          {i > 0 && <div className="w-px h-3 bg-foreground/10 mx-0.5" />}
          <button
            onClick={() => handleChange(loc)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
              loc === locale
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:text-muted-foreground"
            }`}
          >
            {LOCALE_LABELS[loc]}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── TYPING PLACEHOLDER PHRASES ───
const TYPING_PHRASES = [
  "Search 992 GT3 RS, Turbo S, Targa...",
  "What's a 1995 Porsche 993 worth?",
  "Find a 997 GT3 with manual gearbox",
  "Compare 991 GT3 vs 992 GT3",
  "Porsche 964 Carrera RS investment outlook",
  "Search Cayenne Turbo GT, 718 Spyder...",
  "How much is a Porsche 930 Turbo?",
  "Best Porsche under $100K right now",
]

// ─── MAIN HEADER COMPONENT ───
export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const { selectedRegion, setSelectedRegion } = useRegion();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOracleOpen, setIsOracleOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { theme, setTheme } = useTheme();
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  // Smart search autocomplete state
  const [searchResults, setSearchResults] = useState<SearchItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Typing animation for placeholder
  const [typedPlaceholder, setTypedPlaceholder] = useState("")
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    // Don't animate if user is focused or typing
    if (isFocused || query) return

    const currentPhrase = TYPING_PHRASES[phraseIndex]

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward
        if (charIndex < currentPhrase.length) {
          setTypedPlaceholder(currentPhrase.slice(0, charIndex + 1))
          setCharIndex(charIndex + 1)
        } else {
          // Pause at end, then start deleting
          setTimeout(() => setIsDeleting(true), 2000)
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setTypedPlaceholder(currentPhrase.slice(0, charIndex - 1))
          setCharIndex(charIndex - 1)
        } else {
          // Move to next phrase
          setIsDeleting(false)
          setPhraseIndex((phraseIndex + 1) % TYPING_PHRASES.length)
        }
      }
    }, isDeleting ? 25 : 55)

    return () => clearTimeout(timeout)
  }, [charIndex, isDeleting, phraseIndex, isFocused, query])

  // Auth state
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const creditsRemaining = profile?.creditsBalance ?? 0;
  const isAuthenticated = !!user;
  const hasUnlimited = profile?.tier === "MONTHLY" || profile?.tier === "ANNUAL";
  const homeHref = locale === "en" ? "/" : `/${locale}`;

  // Translated menu links
  const menuLinks = menuLinkKeys.map((link) => ({
    href: link.href,
    label: t(`nav.${link.key}`),
  }));

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current && !dropdownRef.current.contains(e.target as Node) &&
        inputRef.current && !inputRef.current.contains(e.target as Node)
      ) {
        setShowDropdown(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Navigate to result
  const handleResultSelect = useCallback((item: SearchItem) => {
    setShowDropdown(false)
    setQuery("")
    setIsFocused(false)
    inputRef.current?.blur()

    if (item.type === "link" && item.url) {
      // TODO: Backend will replace with /api/scrape → redirect to detail page
      // For now, navigate to analyze page with the URL as param
      router.push(`/search?analyze=${encodeURIComponent(item.url)}`)
    } else if (item.type === "family") {
      router.push(`/cars/porsche`)
    } else if (item.seriesId) {
      const variantParam = item.variantId ? `&variant=${item.variantId}` : ""
      router.push(`/cars/porsche?family=${item.seriesId}${variantParam}`)
    }
  }, [router])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // If dropdown is showing results, navigate to the active one
    if (showDropdown && searchResults.length > 0) {
      handleResultSelect(searchResults[activeIndex])
      return
    }
    // Fallback: open Oracle overlay
    if (query.trim()) {
      saveSearchQuery(query.trim());
      setSubmittedQuery(query);
      setIsOracleOpen(true);
      setShowDropdown(false);
      inputRef.current?.blur();
    }
  };

  const handleCloseOracle = () => {
    setIsOracleOpen(false);
    setQuery("");
  };

  return (
    <>
      <div className="fixed top-0 left-0 right-0 z-50">
        {/* Glass background — Obsidian */}
        <div className="absolute inset-0 h-full bg-background/85 backdrop-blur-xl border-b border-border" />

        {/* Free user CTA banner */}
        {profile && profile.tier === "FREE" && creditsRemaining <= 3 && (
          <div className="relative bg-primary/[0.06] border-b border-primary/20 px-4 py-2 text-center">
            <span className="text-[11px] text-foreground">
              <strong>{creditsRemaining}</strong>{" "}
              Free Reports left this month ·{" "}
              <Link
                href="/pricing"
                className="text-primary font-semibold hover:underline"
              >
                Go Unlimited — $59/mo →
              </Link>
            </span>
          </div>
        )}

        {/* COMPACT HEADER — Single Row (smaller on mobile) */}
        <div className="relative h-14 md:h-20 px-4 md:px-6 flex items-center gap-4 md:gap-6">
          {/* Left: Logo */}
          <Link href={homeHref} className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer">
            <span className="font-display font-light text-[18px] md:text-[22px] tracking-[0.35em] uppercase text-foreground">
              MONZA
            </span>
          </Link>

          {/* View Toggle: Monza | Classic */}
          <ViewToggle />

          {/* Center: Search Input with Smart Autocomplete (hidden on mobile) */}
          <div className="hidden md:block flex-1 max-w-xl relative">
            <form onSubmit={handleSubmit}>
              <div className="relative flex items-center">
                {/* Typing overlay when not focused and no query */}
                {!isFocused && !query && (
                  <div
                    className="absolute inset-0 flex items-center pointer-events-none select-none"
                    onClick={() => inputRef.current?.focus()}
                  >
                    <span className="text-[15px] font-light text-muted-foreground tracking-tight">
                      {typedPlaceholder}
                    </span>
                    <span className="inline-block w-[2px] h-[18px] bg-primary ml-[1px] animate-blink" />
                  </div>
                )}
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => {
                    const val = e.target.value
                    setQuery(val)
                    // Check for auction URL paste first
                    const linkResult = detectAuctionUrl(val)
                    const results = linkResult ? [linkResult] : searchItems(val)
                    setSearchResults(results)
                    setShowDropdown(results.length > 0 && val.trim().length > 0)
                    setActiveIndex(0)
                  }}
                  onFocus={() => {
                    setIsFocused(true)
                    if (query.trim() && searchResults.length > 0) setShowDropdown(true)
                  }}
                  onBlur={() => {
                    setIsFocused(false)
                    // Delay to allow click on dropdown items
                    setTimeout(() => setShowDropdown(false), 200)
                  }}
                  onKeyDown={(e) => {
                    if (!showDropdown || searchResults.length === 0) return
                    if (e.key === "ArrowDown") {
                      e.preventDefault()
                      setActiveIndex(prev => (prev + 1) % searchResults.length)
                    } else if (e.key === "ArrowUp") {
                      e.preventDefault()
                      setActiveIndex(prev => (prev - 1 + searchResults.length) % searchResults.length)
                    } else if (e.key === "Escape") {
                      setShowDropdown(false)
                    }
                  }}
                  placeholder={isFocused ? "Search 992, GT3, Turbo, Cayenne..." : ""}
                  className="w-full bg-transparent text-[15px] font-light text-foreground placeholder:text-muted-foreground focus:outline-none tracking-tight"
                />
                {query.trim() && (
                  <button
                    type="submit"
                    className="absolute right-0 flex size-8 items-center justify-center rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors"
                  >
                    <ArrowRight className="size-4" />
                  </button>
                )}
              </div>
            </form>

            {/* Smart Autocomplete Dropdown */}
            <AnimatePresence>
              {showDropdown && searchResults.length > 0 && (
                <motion.div
                  ref={dropdownRef}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-2 bg-background/[0.97] backdrop-blur-2xl border border-border rounded-xl shadow-2xl shadow-black/50 overflow-hidden z-[60]"
                >
                  {/* Results */}
                  <div className="py-1.5 max-h-[360px] overflow-y-auto">
                    {searchResults.map((item, idx) => {
                      const Icon = SEARCH_TYPE_ICON[item.type] || ShieldCheck
                      const isActive = idx === activeIndex
                      return (
                        <button
                          key={`${item.type}-${item.label}-${idx}`}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            handleResultSelect(item)
                          }}
                          onMouseEnter={() => setActiveIndex(idx)}
                          className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all cursor-pointer ${
                            isActive
                              ? "bg-accent text-accent-foreground"
                              : "hover:bg-foreground/5"
                          }`}
                        >
                          <div className={`flex items-center justify-center size-7 rounded-lg ${
                            isActive ? "bg-primary/15" : "bg-foreground/4"
                          }`}>
                            <Icon className={`size-3.5 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                          <div className="flex-1 text-left min-w-0">
                            <div className="flex items-center gap-2">
                              <span className={`text-[12px] font-medium truncate ${
                                isActive ? "text-primary" : "text-muted-foreground"
                              }`}>
                                {item.label}
                              </span>
                              {item.yearRange && (
                                <span className="text-[9px] tabular-nums text-muted-foreground shrink-0">
                                  {item.yearRange}
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {item.subtitle}
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[9px] tabular-nums px-1.5 py-0.5 rounded-full ${
                              isActive
                                ? "bg-primary/15 text-primary"
                                : "bg-foreground/4 text-muted-foreground"
                            }`}>
                              {item.type === "family" ? t("search.resultType.family") : item.type === "series" ? t("search.resultType.series") : item.type === "link" ? t("search.resultType.link") : t("search.resultType.variant")}
                            </span>
                            <ChevronRight className={`size-3 ${isActive ? "text-primary" : "text-muted-foreground"}`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Footer hint */}
                  <div className="px-4 py-2 border-t border-border flex items-center justify-between">
                    <span className="text-[9px] text-muted-foreground">
                      <kbd className="px-1 py-0.5 bg-foreground/4 rounded text-[8px] mr-1">↑↓</kbd>
                      {t("search.hint.navigate")}
                      <kbd className="px-1 py-0.5 bg-foreground/4 rounded text-[8px] mx-1">↵</kbd>
                      {t("search.hint.select")}
                      <kbd className="px-1 py-0.5 bg-foreground/4 rounded text-[8px] mx-1">esc</kbd>
                      {t("search.hint.close")}
                    </span>
                    <span className="text-[9px] text-muted-foreground">
                      {t("search.poweredBy")}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Region Filter — with pink separators */}
          <div className="hidden md:flex items-center shrink-0">
            {REGIONS.map((region, i) => {
              const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
              return (
                <div key={region.id} className="flex items-center">
                  {i > 0 && (
                    <div className="w-px h-3.5 bg-primary/20 mx-0.5" />
                  )}
                  <button
                    onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-[0.1em] transition-all ${
                      isActive
                        ? "bg-primary/15 text-primary border border-primary/25"
                        : "text-muted-foreground hover:text-foreground hover:bg-foreground/3"
                    }`}
                  >
                    {region.label}
                  </button>
                </div>
              )
            })}
          </div>

          {/* Currency Dropdown */}
          <div className="hidden md:flex items-center ml-2">
            <div className="w-px h-3.5 bg-primary/20 mx-1" />
            <CurrencyDropdown />
          </div>

          {/* Right: Actions — anchored to far right */}
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            {/* Credits - only show when authenticated, click → /account */}
            {isAuthenticated && (
              <button
                onClick={() => router.push('/account')}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border hover:bg-foreground/10 transition-colors cursor-pointer"
              >
                <Coins className={`size-3 ${hasUnlimited || creditsRemaining > 0 ? 'text-primary' : 'text-destructive'}`} />
                {hasUnlimited ? (
                  <span className="text-[12px] font-medium text-foreground">Unlimited</span>
                ) : (
                  <>
                    <span className="text-[12px] font-medium tabular-nums text-foreground">{creditsRemaining}</span>
                    <span className="text-[10px] text-muted-foreground">{t('auth.credits')}</span>
                  </>
                )}
              </button>
            )}

            {/* Account / Sign In */}
            {authLoading ? (
              <div className="hidden md:flex size-8 items-center justify-center">
                <div className="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isAuthenticated ? (
                <button
                  onClick={() => signOut()}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                  title={t("auth.signOut")}
                >
                  <User className="size-4" />
                  <span className="text-[11px] font-medium">
                    {profile?.name?.split(" ")[0] || t("mobile.account")}
                  </span>
                </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors text-[11px] font-semibold tracking-wide"
              >
                {t('auth.signIn')}
              </button>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Theme Toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="hidden md:flex items-center justify-center size-8 rounded-full border border-border text-muted-foreground hover:text-foreground hover:border-primary/30 transition-colors"
              aria-label="Toggle theme"
            >
              {theme === "dark" ? <Sun className="size-3.5" /> : <Moon className="size-3.5" />}
            </button>

            {/* Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors">
                  <Menu className="size-4" />
                  <span className="hidden md:inline">{t('nav.menu')}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="border-l border-primary/8 bg-background w-[340px] p-0 flex flex-col overflow-hidden">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto no-scrollbar">

                  {/* ── Profile Card ── */}
                  {isAuthenticated ? (
                    <div className="px-6 pt-6 pb-5">
                      <div className="flex items-center gap-3.5">
                        <div className="size-11 rounded-full bg-gradient-to-br from-primary/30 to-primary/10 border border-primary/20 flex items-center justify-center">
                          <User className="size-5 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-foreground truncate">
                            {profile?.name || "Collector"}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {user?.email || "member@monza.com"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 pt-6 pb-5">
                      <div className="flex items-center gap-3.5">
                        <div className="size-11 rounded-full bg-foreground/4 border border-border flex items-center justify-center">
                          <User className="size-5 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-foreground">{t("menu.profile.welcome")}</p>
                          <p className="text-[11px] text-muted-foreground">{t("menu.profile.signInHint")}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="mt-4 w-full rounded-xl bg-primary py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-primary-foreground hover:bg-primary/80 transition-colors"
                      >
                        {t('auth.signIn')}
                      </button>
                    </div>
                  )}

                  {/* ── Credits ── */}
                  <div className="mx-5 rounded-xl bg-primary/4 border border-primary/8 p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Coins className={`size-3.5 ${creditsRemaining > 0 ? "text-primary" : "text-destructive"}`} />
                        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">{t("menu.credits.label")}</span>
                      </div>
                      <span className="text-[14px] tabular-nums font-bold text-foreground">
                        {isAuthenticated ? creditsRemaining.toLocaleString() : "0"}
                        <span className="text-[10px] font-normal text-muted-foreground ml-1">/ 3,000</span>
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-[5px] rounded-full bg-foreground/4 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-primary/40 to-primary/70 transition-all duration-500"
                        style={{ width: `${Math.min((creditsRemaining / 3000) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[10px] text-muted-foreground">{t("menu.credits.perReport")}</span>
                      <button className="text-[10px] font-semibold text-primary hover:text-primary/80 transition-colors">
                        {t("menu.credits.buy")}
                      </button>
                    </div>
                  </div>

                  {/* ── Watchlist ── */}
                  {isAuthenticated && (
                    <div className="px-5 pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Bookmark className="size-3.5 text-primary" />
                          <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">{t("menu.watchlist.title")}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground px-2 py-3">
                        {t("menu.watchlist.empty")}
                      </p>
                    </div>
                  )}

                  {/* ── Recent Analyses ── */}
                  {isAuthenticated && (
                    <div className="px-5 pt-5">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <FileText className="size-3.5 text-primary" />
                          <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">{t("menu.recentAnalyses.title")}</span>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground px-2 py-3">
                        {t("menu.recentAnalyses.empty")}
                      </p>
                    </div>
                  )}

                  {/* ── Quick Links ── */}
                  <div className="px-5 pt-6 pb-2">
                    <div className="h-px bg-foreground/5 mb-4" />

                    {/* Search History — only for logged-in users */}
                    {isAuthenticated && (
                      <SheetClose asChild>
                        <Link
                          href="/search-history"
                          className="flex items-center gap-3 w-full py-2.5 px-2 rounded-lg hover:bg-foreground/2 transition-colors group"
                        >
                          <Clock className="size-4 text-muted-foreground transition-colors" />
                          <span className="flex-1 text-left text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">
                            {t("nav.searchHistory")}
                          </span>
                          <ChevronRight className="size-3.5 text-muted-foreground transition-colors" />
                        </Link>
                      </SheetClose>
                    )}

                    {[
                      { icon: Bell, label: "Notifications", badge: "3" },
                      { icon: Phone, label: "Contact Advisor", badge: null },
                      { icon: Settings, label: "Settings", badge: null },
                    ].map((item) => (
                      <button
                        key={item.label}
                        className="flex items-center gap-3 w-full py-2.5 px-2 rounded-lg hover:bg-foreground/2 transition-colors group"
                      >
                        <item.icon className="size-4 text-muted-foreground transition-colors" />
                        <span className="flex-1 text-left text-[13px] text-muted-foreground group-hover:text-foreground transition-colors">{item.label}</span>
                        {item.badge && (
                          <span className="size-4.5 flex items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground leading-none px-1.5 py-0.5">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="size-3.5 text-muted-foreground transition-colors" />
                      </button>
                    ))}

                    {/* Language in quick links */}
                    <div className="flex items-center gap-3 w-full py-2.5 px-2">
                      <Globe className="size-4 text-muted-foreground" />
                      <span className="flex-1 text-left text-[13px] text-muted-foreground">Language</span>
                      <InlineLanguageSwitcher />
                    </div>
                  </div>
                </div>

                {/* ── Footer: Sign Out (pinned) ── */}
                {isAuthenticated && (
                  <div className="shrink-0 px-5 py-4 border-t border-border">
                    <SheetClose asChild>
                      <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2.5 w-full py-2 px-2 rounded-lg text-[13px] text-muted-foreground hover:text-destructive hover:bg-foreground/2 transition-colors"
                      >
                        <LogOut className="size-4" />
                        {t('auth.signOut')}
                      </button>
                    </SheetClose>
                  </div>
                )}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* THE ORACLE OVERLAY */}
      <OracleOverlay
        isOpen={isOracleOpen}
        onClose={handleCloseOracle}
        query={submittedQuery}
      />

      {/* AUTH MODAL */}
      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
      />
    </>
  );
}
