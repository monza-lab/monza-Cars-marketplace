"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, User, Sparkles, X, TrendingUp, BarChart3, Car, LogOut, Zap, Star, FileText, Bell, Settings, Phone, ChevronRight, Clock, Globe } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import Image from "next/image";
import { CURATED_CARS, searchCars, type CollectorCar } from "@/lib/curatedCars";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { useRegion } from "@/lib/RegionContext";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { saveSearchQuery } from "@/lib/searchHistory";

const REGIONS = [
  { id: "all", label: "All", flag: "\u{1F30D}" },
  { id: "US", label: "US", flag: "\u{1F1FA}\u{1F1F8}" },
  { id: "UK", label: "UK", flag: "\u{1F1EC}\u{1F1E7}" },
  { id: "EU", label: "EU", flag: "\u{1F1EA}\u{1F1FA}" },
  { id: "JP", label: "JP", flag: "\u{1F1EF}\u{1F1F5}" },
];

// Menu links - labels will be translated in the component
const menuLinkKeys = [
  { href: "/auctions", key: "liveAuctions" },
  { href: "/search", key: "marketSearch" },
  { href: "/history", key: "priceHistory" },
  { href: "/about", key: "about" },
] as const;


// Format USD price
function formatPrice(value: number): string {
  if (value >= 1000000) {
    return `$${(value / 1000000).toFixed(1)}M`;
  }
  return `$${(value / 1000).toFixed(0)}K`;
}

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
  | "viewLiveAuctions"
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

// Generate intelligent response based on query and car data
function getResponseForQuery(
  query: string,
  t: (key: string, values?: any) => string
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
${car.status === "ACTIVE" || car.status === "ENDING_SOON"
  ? `• Current bid: **${formatPrice(car.currentBid)}** with ${car.bidCount} bids`
  : `• Sold for: **${formatPrice(car.currentBid)}**`}
• Platform: ${car.platform.replace(/_/g, " ")}
• Mileage: ${car.mileage.toLocaleString()} ${car.mileageUnit}
• Location: ${car.location}

**Vehicle Specs:**
• Engine: ${car.engine}
• Transmission: ${car.transmission}
• Year: ${car.year}

**About this Vehicle** _(Editorial)_
${car.thesis}

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
      answer: `**Most Active Auctions Right Now**

${carList}

**Market Activity:**
• ${liveCars.length} live auctions being tracked
• Total collection: ${CURATED_CARS.filter(c => c.make !== "Ferrari").length} vehicles
• Platforms: Bring a Trailer, Cars & Bids, Collecting Cars

**What's Hot** _(Editorial)_
JDM vehicles and analog supercars continue to attract strong bidding activity. Manual transmission examples consistently generate more competition.

_Note: Data from real auction results. Past performance not indicative of future results._`,
      chips: [{ id: "viewLiveAuctions" }, { id: "setAlerts" }, { id: "browseAll" }],
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
${car.status === "ACTIVE" || car.status === "ENDING_SOON"
  ? `• Current bid: **${formatPrice(car.currentBid)}** with ${car.bidCount} bids`
  : `• Sold for: **${formatPrice(car.currentBid)}**`}
• Platform: ${car.platform.replace(/_/g, " ")}
• Location: ${car.location}

**Vehicle Specs:**
• Engine: ${car.engine}
• Transmission: ${car.transmission}
• Mileage: ${car.mileage.toLocaleString()} ${car.mileageUnit}

**Seller's Notes:** ${car.history}

**About this Model** _(Editorial)_
${car.thesis}`,
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

_All prices from real auction results._`,
    chips: [{ id: "viewLiveAuctions" }, { id: "browseByBrand" }, { id: "setAlerts" }],
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
    viewLiveAuctions: "/auctions",
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
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-3 rounded-full bg-[#0F1012] border border-[rgba(248,180,217,0.2)] px-5 py-3 shadow-2xl shadow-black/50 backdrop-blur-xl"
        >
          <Sparkles className="size-4 text-[#F8B4D9]" />
          <span className="text-[13px] font-medium text-[#FFFCF7]">{message}</span>
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
    const result = getResponseForQuery(query, t);
    const timer = setTimeout(() => {
      setResponse(result);
      setPhase("ready");
    }, 600);

    return () => clearTimeout(timer);
  }, [isOpen, query, t]);

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
            className="fixed inset-0 z-40 bg-[#0b0b10]/60 backdrop-blur-sm"
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
            <div className="bg-[#0b0b10]/95 backdrop-blur-xl border border-[rgba(255,255,255,0.1)] rounded-2xl shadow-2xl shadow-black/50 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-[rgba(248,180,217,0.1)]">
                <div className="flex items-center gap-2">
                  <Sparkles className="size-4 text-[#F8B4D9]" />
                  <span className="text-[10px] font-semibold tracking-[0.25em] uppercase text-[#F8B4D9]">
                    {t("oracle.aiAnalysis")}
                  </span>
                </div>
                <button
                  onClick={onClose}
                  className="size-8 flex items-center justify-center rounded-full hover:bg-[rgba(255,255,255,0.05)] text-[rgba(255,252,247,0.5)] hover:text-[#FFFCF7] transition-colors"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Query Echo */}
              <div className="px-6 pt-4">
                <p className="text-[13px] text-[rgba(255,252,247,0.5)]">
                  <span className="text-[rgba(255,252,247,0.3)]">{t("oracle.youAsked")}</span>{" "}
                  <span className="text-[#FFFCF7]">"{query}"</span>
                </p>
              </div>

              {/* Content */}
              <div className="px-6 py-5 max-h-[50vh] overflow-y-auto no-scrollbar">
                {phase === "loading" ? (
                  // Loading State
                  <div className="space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="size-2 rounded-full bg-[#F8B4D9] animate-pulse" />
                      <span className="text-[14px] text-[rgba(255,252,247,0.6)]">
                        {t("oracle.analyzingMarket")}
                      </span>
                    </div>
                    <div className="space-y-3">
                      <div className="h-4 bg-[rgba(248,180,217,0.08)] rounded animate-pulse w-full" />
                      <div className="h-4 bg-[rgba(248,180,217,0.08)] rounded animate-pulse w-5/6" />
                      <div className="h-4 bg-[rgba(248,180,217,0.08)] rounded animate-pulse w-4/6" />
                    </div>
                  </div>
                ) : response ? (
                  // Answer - simple text display (no typewriter)
                  <div className="prose prose-invert prose-sm max-w-none">
                    <div className="text-[15px] leading-relaxed text-[#FFFCF7] whitespace-pre-wrap">
                      {response.answer.split("\n").map((line, i) => {
                        const parts = line.split(/(\*\*[^*]+\*\*)/g);
                        return (
                          <p key={i} className={line.startsWith("•") ? "pl-4 my-1" : "my-3"}>
                            {parts.map((part, j) => {
                              if (part.startsWith("**") && part.endsWith("**")) {
                                return (
                                  <span key={j} className="font-semibold text-[#F8B4D9]">
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
                <div className="px-6 pb-5 pt-2 border-t border-[rgba(248,180,217,0.08)]">
                  <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-[rgba(255,252,247,0.4)] mb-3">
                    {t("oracle.relatedActions")}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {response.chips.map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => handleChipClick(chip)}
                        className="flex items-center gap-1.5 rounded-full bg-[rgba(248,180,217,0.08)] border border-[rgba(248,180,217,0.15)] px-4 py-2 text-[11px] font-medium text-[#F8B4D9] cursor-pointer hover:bg-[rgba(248,180,217,0.2)] hover:border-[rgba(248,180,217,0.3)] active:scale-95 transition-all duration-150"
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
          {i > 0 && <div className="w-px h-3 bg-white/10 mx-0.5" />}
          <button
            onClick={() => handleChange(loc)}
            className={`px-2 py-0.5 rounded-full text-[11px] font-medium transition-all ${
              loc === locale
                ? "bg-[#F8B4D9]/15 text-[#F8B4D9]"
                : "text-[#4B5563] hover:text-[#9CA3AF]"
            }`}
          >
            {LOCALE_LABELS[loc]}
          </button>
        </div>
      ))}
    </div>
  )
}

// ─── MAIN HEADER COMPONENT ───
export function Header() {
  const t = useTranslations();
  const { selectedRegion, setSelectedRegion } = useRegion();
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOracleOpen, setIsOracleOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auth state
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const creditsRemaining = profile?.creditsBalance ?? 0;
  const isAuthenticated = !!user;

  // Translated menu links
  const menuLinks = menuLinkKeys.map((link) => ({
    href: link.href,
    label: t(`nav.${link.key}`),
  }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      saveSearchQuery(query.trim());
      setSubmittedQuery(query);
      setIsOracleOpen(true);
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
        <div className="absolute inset-0 h-full bg-[rgba(11,11,16,0.85)] backdrop-blur-xl border-b border-white/5" />

        {/* COMPACT HEADER — Single Row (smaller on mobile) */}
        <div className="relative h-14 md:h-20 px-4 md:px-6 flex items-center gap-4 md:gap-6">
          {/* Left: Logo */}
          <Link href="/" className="shrink-0 hover:opacity-80 transition-opacity">
            <Image src="/logo-crema.png" alt="Monza Lab" width={992} height={260} className="h-7 md:h-8 w-auto" priority />
          </Link>

          {/* Center: Search Input (hidden on mobile) */}
          <form onSubmit={handleSubmit} className="hidden md:block flex-1 max-w-xl">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder="Ask Anything About The Automotive Market"
                className="w-full bg-transparent text-[15px] font-light text-[#FFFCF7] placeholder:text-[#6B7280] focus:outline-none tracking-tight"
              />
              {query.trim() && (
                <button
                  type="submit"
                  className="absolute right-0 flex size-8 items-center justify-center rounded-full bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde] transition-colors"
                >
                  <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          </form>

          {/* Region Filter — with pink separators */}
          <div className="hidden md:flex items-center shrink-0">
            {REGIONS.map((region, i) => {
              const isActive = (region.id === "all" && !selectedRegion) || selectedRegion === region.id
              return (
                <div key={region.id} className="flex items-center">
                  {i > 0 && (
                    <div className="w-px h-3.5 bg-[#F8B4D9]/20 mx-0.5" />
                  )}
                  <button
                    onClick={() => setSelectedRegion(region.id === "all" ? null : region.id)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                      isActive
                        ? "bg-[#F8B4D9]/15 text-[#F8B4D9] border border-[#F8B4D9]/25"
                        : "text-[#6B7280] hover:text-[#9CA3AF] hover:bg-white/[0.03]"
                    }`}
                  >
                    <span className="text-[12px] leading-none">{region.flag}</span>
                    <span>{region.label}</span>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Right: Actions — anchored to far right */}
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            {/* Credits - only show when authenticated */}
            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                <Zap className={`size-3 ${creditsRemaining > 0 ? 'text-[#F8B4D9]' : 'text-[#FB923C]'}`} />
                <span className="text-[12px] font-medium tabular-nums text-[#FFFCF7]">{creditsRemaining}</span>
                <span className="text-[10px] text-[#4B5563]">{t('auth.credits')}</span>
              </div>
            )}

            {/* Account / Sign In */}
            {authLoading ? (
              <div className="hidden md:flex size-8 items-center justify-center">
                <div className="size-4 border-2 border-[#4B5563] border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isAuthenticated ? (
                <button
                  onClick={() => signOut()}
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[#9CA3AF] hover:text-[#FFFCF7] hover:bg-white/5 transition-colors"
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
                className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde] transition-colors text-[11px] font-semibold tracking-wide"
              >
                {t('auth.signIn')}
              </button>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] uppercase text-[#9CA3AF] hover:text-[#FFFCF7] transition-colors">
                  <Menu className="size-4" />
                  <span className="hidden md:inline">{t('nav.menu')}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="border-l border-[rgba(248,180,217,0.08)] bg-[#0b0b10] w-[340px] p-0 flex flex-col overflow-hidden">
                <SheetHeader className="sr-only">
                  <SheetTitle>Menu</SheetTitle>
                </SheetHeader>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto no-scrollbar">

                  {/* ── Profile Card ── */}
                  {isAuthenticated ? (
                    <div className="px-6 pt-6 pb-5">
                      <div className="flex items-center gap-3.5">
                        <div className="size-11 rounded-full bg-gradient-to-br from-[#F8B4D9]/30 to-[#F8B4D9]/10 border border-[#F8B4D9]/20 flex items-center justify-center">
                          <User className="size-5 text-[#F8B4D9]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-[#FFFCF7] truncate">
                            {profile?.name || "Collector"}
                          </p>
                          <p className="text-[11px] text-[#6B7280] truncate">
                            {user?.email || "member@monza.com"}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="px-6 pt-6 pb-5">
                      <div className="flex items-center gap-3.5">
                        <div className="size-11 rounded-full bg-white/[0.04] border border-white/5 flex items-center justify-center">
                          <User className="size-5 text-[#4B5563]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[14px] font-semibold text-[#FFFCF7]">Welcome</p>
                          <p className="text-[11px] text-[#6B7280]">Sign in to track your portfolio</p>
                        </div>
                      </div>
                      <button
                        onClick={() => setShowAuthModal(true)}
                        className="mt-4 w-full rounded-xl bg-[#F8B4D9] py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-colors"
                      >
                        {t('auth.signIn')}
                      </button>
                    </div>
                  )}

                  {/* ── Credits ── */}
                  <div className="mx-5 rounded-xl bg-[rgba(248,180,217,0.04)] border border-[rgba(248,180,217,0.08)] p-4">
                    <div className="flex items-center justify-between mb-2.5">
                      <div className="flex items-center gap-2">
                        <Zap className={`size-3.5 ${creditsRemaining > 0 ? "text-[#F8B4D9]" : "text-[#FB923C]"}`} />
                        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">Credits</span>
                      </div>
                      <span className="text-[14px] font-mono font-bold text-[#FFFCF7]">
                        {isAuthenticated ? creditsRemaining.toLocaleString() : "0"}
                        <span className="text-[10px] font-normal text-[#4B5563] ml-1">/ 3,000</span>
                      </span>
                    </div>
                    {/* Progress bar */}
                    <div className="h-[5px] rounded-full bg-white/[0.04] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-[#F8B4D9]/40 to-[#F8B4D9]/70 transition-all duration-500"
                        style={{ width: `${Math.min((creditsRemaining / 3000) * 100, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2.5">
                      <span className="text-[10px] text-[#4B5563]">1 report = 1,000 credits</span>
                      <button className="text-[10px] font-semibold text-[#F8B4D9] hover:text-[#f4cbde] transition-colors">
                        {t('auth.buyCredits')}
                      </button>
                    </div>
                  </div>

                  {/* ── Watchlist ── */}
                  <div className="px-5 pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Star className="size-3.5 text-[#F8B4D9]" />
                        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">Watchlist</span>
                      </div>
                      <span className="text-[10px] font-mono text-[#4B5563]">3 cars</span>
                    </div>
                    <div className="space-y-1">
                      {[
                        { name: "Ferrari F40", price: "$1.35M", trend: "+12%", grade: "AAA" },
                        { name: "Porsche 959", price: "$890K", trend: "+8%", grade: "AA" },
                        { name: "Toyota Supra MK4", price: "$185K", trend: "+22%", grade: "A" },
                      ].map((car) => (
                        <div key={car.name} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer group">
                          <Star className="size-3 text-[#F8B4D9]/40 shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">{car.name}</p>
                          </div>
                          <span className="text-[11px] font-mono text-[#FFFCF7] shrink-0">{car.price}</span>
                          <span className="text-[9px] font-mono text-emerald-400 shrink-0 w-8 text-right">{car.trend}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Recent Analyses ── */}
                  <div className="px-5 pt-5">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <FileText className="size-3.5 text-[#F8B4D9]" />
                        <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">Recent Analyses</span>
                      </div>
                    </div>
                    <div className="space-y-1">
                      {[
                        { name: "Ferrari 250 GTO", time: "2d ago", cost: "1,000 cr" },
                        { name: "McLaren F1", time: "5d ago", cost: "1,000 cr" },
                        { name: "Porsche 911 GT1", time: "1w ago", cost: "1,000 cr" },
                      ].map((report) => (
                        <div key={report.name} className="flex items-center gap-3 py-2 px-2 rounded-lg hover:bg-white/[0.02] transition-colors cursor-pointer group">
                          <div className="size-7 rounded-lg bg-[rgba(248,180,217,0.06)] flex items-center justify-center shrink-0">
                            <BarChart3 className="size-3 text-[#F8B4D9]/60" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12px] font-medium text-[#FFFCF7] truncate group-hover:text-[#F8B4D9] transition-colors">{report.name}</p>
                            <p className="text-[10px] text-[#4B5563]">{report.cost}</p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Clock className="size-2.5 text-[#4B5563]" />
                            <span className="text-[10px] text-[#4B5563]">{report.time}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* ── Quick Links ── */}
                  <div className="px-5 pt-6 pb-2">
                    <div className="h-px bg-white/5 mb-4" />

                    {/* Search History — only for logged-in users */}
                    {isAuthenticated && (
                      <SheetClose asChild>
                        <Link
                          href="/search-history"
                          className="flex items-center gap-3 w-full py-2.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors group"
                        >
                          <Clock className="size-4 text-[#4B5563] group-hover:text-[#9CA3AF] transition-colors" />
                          <span className="flex-1 text-left text-[13px] text-[#9CA3AF] group-hover:text-[#FFFCF7] transition-colors">
                            {t("nav.searchHistory")}
                          </span>
                          <ChevronRight className="size-3.5 text-[#4B5563] group-hover:text-[#6B7280] transition-colors" />
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
                        className="flex items-center gap-3 w-full py-2.5 px-2 rounded-lg hover:bg-white/[0.02] transition-colors group"
                      >
                        <item.icon className="size-4 text-[#4B5563] group-hover:text-[#9CA3AF] transition-colors" />
                        <span className="flex-1 text-left text-[13px] text-[#9CA3AF] group-hover:text-[#FFFCF7] transition-colors">{item.label}</span>
                        {item.badge && (
                          <span className="size-4.5 flex items-center justify-center rounded-full bg-[#F8B4D9] text-[9px] font-bold text-[#0b0b10] leading-none px-1.5 py-0.5">
                            {item.badge}
                          </span>
                        )}
                        <ChevronRight className="size-3.5 text-[#4B5563] group-hover:text-[#6B7280] transition-colors" />
                      </button>
                    ))}

                    {/* Language in quick links */}
                    <div className="flex items-center gap-3 w-full py-2.5 px-2">
                      <Globe className="size-4 text-[#4B5563]" />
                      <span className="flex-1 text-left text-[13px] text-[#9CA3AF]">Language</span>
                      <InlineLanguageSwitcher />
                    </div>
                  </div>
                </div>

                {/* ── Footer: Sign Out (pinned) ── */}
                {isAuthenticated && (
                  <div className="shrink-0 px-5 py-4 border-t border-white/5">
                    <SheetClose asChild>
                      <button
                        onClick={() => signOut()}
                        className="flex items-center gap-2.5 w-full py-2 px-2 rounded-lg text-[13px] text-[#6B7280] hover:text-[#FB923C] hover:bg-white/[0.02] transition-colors"
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
