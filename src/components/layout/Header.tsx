"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, User, Sparkles, X, TrendingUp, BarChart3, Car, LogOut, Zap } from "lucide-react";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import type { CollectorCar } from "@/lib/curatedCars";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import { LanguageSwitcher, MobileLanguageSwitcher } from "./LanguageSwitcher";

// Menu links - labels will be translated in the component
const menuLinkKeys = [
  { href: "/auctions", key: "liveAuctions" },
  { href: "/search", key: "marketSearch" },
  { href: "/history", key: "priceHistory" },
  { href: "/about", key: "about" },
] as const;


const placeholderKeys = [
  "placeholders.askAnything",
  "placeholders.fairValue",
  "placeholders.appreciating",
  "placeholders.jdmTrending",
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

// Search results type from the API
type SearchResult = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  currentBid: number;
  image: string;
  status: string;
  platform: string;
  sourceUrl: string;
};

// Fetch search results from the API
async function fetchSearchResults(query: string): Promise<SearchResult[]> {
  try {
    const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&limit=8`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results ?? [];
  } catch {
    return [];
  }
}

// Generate intelligent response based on query and search results
function getResponseForQuery(
  query: string,
  matchingCars: SearchResult[],
  t: (key: string, values?: any) => string
): OracleResponse {
  // If multiple cars match (brand/category search)
  if (matchingCars.length > 1) {
    const sortedCars = [...matchingCars].sort((a, b) => b.currentBid - a.currentBid).slice(0, 5);
    const brandOrCategory = sortedCars[0].make;

    const carList = sortedCars.map(car =>
      `• **${car.title}** — ${formatPrice(car.currentBid)}`
    ).join("\n");

    return {
      answer: `**${brandOrCategory} Collection**

We found ${matchingCars.length} matching vehicles:

${carList}

**Platforms Tracked:**
• Bring a Trailer • Cars & Bids • Collecting Cars

_Data from real auction results._`,
      chips: [{ id: "viewAllBrand" }, { id: "viewLiveAuctions" }, { id: "setAlerts" }],
      brandContext: brandOrCategory,
    };
  }

  // Single car match
  if (matchingCars.length === 1) {
    const car = matchingCars[0];

    return {
      answer: `**${car.title}**

**Market Data:**
• Price: **${formatPrice(car.currentBid)}**
• Platform: ${car.platform.replace(/_/g, " ")}
• Status: ${car.status}`,
      chips: [{ id: "viewCarDetails" }, { id: "similarCars" }, { id: "browseBrand" }],
      carContext: { id: car.id, make: car.make },
    };
  }

  // Default: no results
  return {
    answer: `**Monza Lab Market Overview**

No exact matches found for "${query}".

**Try Asking:**
• A specific make like "Ferrari" or "Porsche"
• A model like "911" or "F40"

**Platforms Tracked:**
• Bring a Trailer • Cars & Bids • Collecting Cars

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
          <span className="text-[13px] font-medium text-[#F2F0E9]">{message}</span>
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

  // Fetch search results and generate response
  useEffect(() => {
    if (!isOpen) {
      setPhase("loading");
      setResponse(null);
      return;
    }

    let cancelled = false;
    setPhase("loading");

    fetchSearchResults(query).then((results) => {
      if (cancelled) return;
      const result = getResponseForQuery(query, results, t);
      setResponse(result);
      setPhase("ready");
    });

    return () => { cancelled = true; };
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

// ─── MAIN HEADER COMPONENT ───
export function Header() {
  const t = useTranslations();
  const placeholderTexts = useMemo(
    () => placeholderKeys.map((key) => t(key)),
    [t]
  );
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [placeholderIndex, setPlaceholderIndex] = useState(0);
  const [displayedPlaceholder, setDisplayedPlaceholder] = useState("");
  const [isTyping, setIsTyping] = useState(true);
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

  // Typing effect for placeholder - with proper cleanup
  useEffect(() => {
    if (isFocused || isOracleOpen) return;

    const currentText = placeholderTexts[placeholderIndex];
    let charIndex = 0;
    let timeoutId: NodeJS.Timeout | null = null;
    setIsTyping(true);

    const typeInterval = setInterval(() => {
      if (charIndex <= currentText.length) {
        setDisplayedPlaceholder(currentText.slice(0, charIndex));
        charIndex++;
      } else {
        clearInterval(typeInterval);
        setIsTyping(false);
        timeoutId = setTimeout(() => {
          setPlaceholderIndex((prev) => (prev + 1) % placeholderTexts.length);
        }, 3000);
      }
    }, 50);

    return () => {
      clearInterval(typeInterval);
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [placeholderIndex, isFocused, isOracleOpen, placeholderTexts]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
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
        <div className="absolute inset-0 h-full bg-[rgba(5,5,5,0.85)] backdrop-blur-xl border-b border-white/5" />

        {/* COMPACT HEADER — Single Row (smaller on mobile) */}
        <div className="relative h-14 md:h-20 px-4 md:px-6 flex items-center gap-4 md:gap-6">
          {/* Left: Logo */}
          <Link href="/" className="shrink-0 flex items-center gap-1.5 hover:opacity-80 transition-opacity">
            <span className="text-[18px] font-bold tracking-tight text-[#F2F0E9]">MONZA</span>
            <span className="text-[18px] font-light tracking-tight text-[#F8B4D9]">LAB</span>
          </Link>

          {/* Center: Search Input (hidden on mobile - chat is at bottom) */}
          <form onSubmit={handleSubmit} className="hidden md:block flex-1 max-w-2xl">
            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setIsFocused(true)}
                onBlur={() => setIsFocused(false)}
                placeholder=""
                className="w-full bg-transparent text-lg font-light text-[#F2F0E9] placeholder:text-transparent focus:outline-none tracking-tight"
              />

              {/* Custom placeholder with typing effect */}
              {!query && !isFocused && (
                <div className="absolute inset-0 flex items-center pointer-events-none">
                  <span className="text-lg font-light text-[#9CA3AF] tracking-tight">
                    {displayedPlaceholder}
                  </span>
                  <motion.span
                    animate={{ opacity: [1, 0, 1] }}
                    transition={{ duration: 1, repeat: Infinity }}
                    className="text-lg font-light text-[#F8B4D9] ml-0.5"
                  >
                    |
                  </motion.span>
                </div>
              )}

              {/* Focused placeholder */}
                {!query && isFocused && (
                  <div className="absolute inset-0 flex items-center pointer-events-none">
                    <span className="text-lg font-light text-[#4B5563] tracking-tight">
                      {t("placeholders.askAnything")}
                    </span>
                  </div>
                )}

              {/* Submit button */}
              {query.trim() && (
                <button
                  type="submit"
                  className="absolute right-0 flex size-8 items-center justify-center rounded-full bg-[#F8B4D9] text-[#050505] hover:bg-[#fce4ec] transition-colors"
                >
                  <ArrowRight className="size-4" />
                </button>
              )}
            </div>
          </form>

          {/* Right: Actions — anchored to far right */}
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            {/* Credits - only show when authenticated */}
            {isAuthenticated && (
              <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/5">
                <Zap className={`size-3 ${creditsRemaining > 0 ? 'text-[#F8B4D9]' : 'text-[#FB923C]'}`} />
                <span className="text-[12px] font-medium tabular-nums text-[#F2F0E9]">{creditsRemaining}</span>
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
                  className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-[#9CA3AF] hover:text-[#F2F0E9] hover:bg-white/5 transition-colors"
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
                className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#F8B4D9] text-[#050505] hover:bg-[#fce4ec] transition-colors text-[11px] font-semibold tracking-wide"
              >
                {t('auth.signIn')}
              </button>
            )}

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] uppercase text-[#9CA3AF] hover:text-[#F2F0E9] transition-colors">
                  <Menu className="size-4" />
                  <span className="hidden md:inline">{t('nav.menu')}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="border-white/5 bg-[#050505] w-80">
                <SheetHeader>
                  <SheetTitle className="text-left flex items-center gap-1">
                    <span className="text-[14px] font-bold tracking-tight text-[#F2F0E9]">MONZA</span>
                    <span className="text-[14px] font-light tracking-tight text-[#F8B4D9]">LAB</span>
                  </SheetTitle>
                </SheetHeader>
                <nav className="mt-8 flex flex-col gap-1">
                  {menuLinks.map((link) => (
                    <SheetClose asChild key={link.href}>
                      <Link href={link.href} className="flex items-center py-3 text-[14px] font-light text-[#9CA3AF] hover:text-[#F2F0E9] transition-colors">
                        {link.label}
                      </Link>
                    </SheetClose>
                  ))}
                </nav>
                <div className="mt-10">
                  {isAuthenticated ? (
                    <>
                      <div className="flex items-center justify-between py-4 border-t border-white/5">
                        <div>
                          <span className="text-[9px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">{t('auth.credits')}</span>
                          <p className={`text-xl font-light ${creditsRemaining > 0 ? 'text-[#F8B4D9]' : 'text-[#FB923C]'}`}>{creditsRemaining}</p>
                        </div>
                        <button className="rounded-full bg-[#F8B4D9] px-5 py-2 text-[10px] font-semibold tracking-[0.1em] uppercase text-[#050505] hover:bg-[#fce4ec] transition-colors">
                          {t('auth.buyCredits')}
                        </button>
                      </div>
                      <SheetClose asChild>
                        <button
                          onClick={() => signOut()}
                          className="flex items-center gap-2 w-full py-3 text-[14px] font-light text-[#9CA3AF] hover:text-[#FB923C] transition-colors border-t border-white/5"
                        >
                          <LogOut className="size-4" />
                          {t('auth.signOut')}
                        </button>
                      </SheetClose>
                    </>
                  ) : (
                    <div className="py-4 border-t border-white/5">
                      <p className="text-[11px] text-[#9CA3AF] mb-3">{t('auth.freeCredits')}</p>
                      <SheetClose asChild>
                        <button
                          onClick={() => setShowAuthModal(true)}
                          className="w-full rounded-full bg-[#F8B4D9] px-5 py-2.5 text-[11px] font-semibold tracking-[0.1em] uppercase text-[#050505] hover:bg-[#fce4ec] transition-colors"
                        >
                          {t('auth.signIn')}
                        </button>
                      </SheetClose>
                    </div>
                  )}
                </div>
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
