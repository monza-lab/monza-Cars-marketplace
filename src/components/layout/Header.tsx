"use client";

import { useState, useRef, useEffect, useLayoutEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Menu, User, X, TrendingUp, BarChart3, Car, FileText, ChevronRight, Award, Calendar, LinkIcon, ShieldCheck, Scale, BookOpen, Wrench, ScrollText, MessageCircle } from "lucide-react";
import { Piston } from "@/components/icons/Piston";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetClose,
} from "@/components/ui/sheet";
import { useAuth } from "@/lib/auth/AuthProvider";
import { AuthModal } from "@/components/auth/AuthModal";
import { useRegion } from "@/lib/RegionContext";
import { useCurrency } from "@/lib/CurrencyContext";
import { useTranslations, useLocale } from "next-intl";
import { Link, useRouter, usePathname } from "@/i18n/navigation";
import { useSearchParams } from "next/navigation";
import { MonzaHausWordmark } from "@/components/brand/MonzaHausWordmark";
import { AccountSheetContent } from "@/components/account/AccountSheetContent";
import { ViewToggle } from "./ViewToggle";
import { saveSearchQuery } from "@/lib/searchHistory";
import { getBrandConfig } from "@/lib/brandConfig";
import { CurrencyDropdown } from "./CurrencyDropdown";
import { useTheme } from "next-themes";
import { PistonsWalletModal } from "@/components/advisor/PistonsWalletModal";
import { AdvisorConversation } from "@/components/advisor/AdvisorConversation";
import { useAdvisorChatHandoffOptional } from "@/components/advisor/AdvisorHandoffContext";
import { REPORT_PISTON_COST } from "@/lib/reports/canAffordReport";

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
        subtitle: "Paste detected — get a Haus Report",
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
      subtitle: "Paste a link to get a Haus Report",
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


// ─── THE ORACLE OVERLAY ───
// Delegates to the shared AdvisorConversation component which streams a real
// AI answer from /api/advisor/message. A "Continue in chat" CTA hands the
// conversation off to the AdvisorChat modal via the handoff context.
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
  const locale = useLocale();
  const { profile } = useAuth();
  const overlayRef = useRef<HTMLDivElement>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const handoff = useAdvisorChatHandoffOptional();

  // Reset conversation state each time the overlay opens.
  useEffect(() => {
    if (isOpen) return;
    const timer = window.setTimeout(() => setConversationId(null), 0);
    return () => window.clearTimeout(timer);
  }, [isOpen]);

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

  const userTier: "FREE" | "PRO" = profile?.tier === "PRO" ? "PRO" : "FREE";

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
            <div className="bg-background/95 backdrop-blur-xl border border-border rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col max-h-[75vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-primary/10 shrink-0">
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
              <div className="px-6 pt-4 shrink-0">
                <p className="text-[13px] text-muted-foreground">
                  <span className="text-muted-foreground/60">{t("oracle.youAsked")}</span>{" "}
                  <span className="text-foreground">&ldquo;{query}&rdquo;</span>
                </p>
              </div>

              {/* AI-streamed conversation */}
              <div className="flex-1 min-h-[280px] max-h-[50vh]">
                <AdvisorConversation
                  conversationId={conversationId}
                  onConversationIdChanged={setConversationId}
                  surface="oracle"
                  locale={locale as "en" | "de" | "es" | "ja"}
                  userTier={userTier}
                  autoSendOnMount={query}
                  compact
                />
              </div>

              {/* Continue in chat CTA */}
              {conversationId && (
                <div className="px-6 pb-5 pt-2 border-t border-primary/8 shrink-0">
                  <button
                    onClick={() => {
                      onClose();
                      handoff?.startChatForConversation(conversationId);
                    }}
                    className="w-full py-2 rounded-xl bg-primary/15 border border-primary/25 text-[12px] font-medium text-primary hover:bg-primary/20 transition-colors"
                  >
                    {t("advisor.continueInChat")}
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

// ─── INLINE LANGUAGE SWITCHER (for hamburger menu) ───
const LOCALE_LABELS: Record<string, string> = { en: "EN", es: "ES", de: "DE", ja: "JA" }

// ─── MENU PRIMITIVES — used inside the right-side Sheet ───
function MenuSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section className="px-3 pt-4 pb-1">
      <p className="px-3 text-[10px] font-semibold tracking-[0.22em] uppercase text-muted-foreground/80 mb-1">
        {label}
      </p>
      <div className="space-y-0.5">{children}</div>
    </section>
  )
}

function MenuLink({
  href,
  icon: Icon,
  label,
}: {
  href: string
  icon: React.ComponentType<{ className?: string }>
  label: string
}) {
  return (
    <SheetClose asChild>
      <Link
        href={href}
        className="group flex items-center gap-3 w-full px-3 py-2.5 rounded-lg hover:bg-foreground/[0.04] active:bg-foreground/[0.07] transition-colors"
      >
        <Icon className="size-4 text-muted-foreground group-hover:text-primary transition-colors" />
        <span className="flex-1 text-left text-[13px] text-foreground/85 group-hover:text-foreground transition-colors">
          {label}
        </span>
        <ChevronRight className="size-3.5 text-muted-foreground/60 group-hover:text-muted-foreground transition-colors" />
      </Link>
    </SheetClose>
  )
}

function ThemeRow() {
  const t = useTranslations()
  const { theme, setTheme } = useTheme()
  const options: { value: "light" | "dark" | "system"; label: string }[] = [
    { value: "light", label: t("nav.preferencesThemeLight") },
    { value: "dark", label: t("nav.preferencesThemeDark") },
    { value: "system", label: t("nav.preferencesThemeSystem") },
  ]
  return (
    <div className="px-3 py-2">
      <p className="text-[12px] text-foreground/85 mb-2">{t("nav.preferencesTheme")}</p>
      <div className="flex items-center gap-0.5 rounded-full bg-foreground/[0.05] border border-border p-0.5">
        {options.map(opt => {
          const active = (theme ?? "system") === opt.value
          return (
            <button
              key={opt.value}
              onClick={() => setTheme(opt.value)}
              className={`flex-1 h-7 rounded-full text-[11px] font-medium transition-all ${
                active
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function LanguageRow() {
  const t = useTranslations()
  return (
    <div className="px-3 py-2 flex items-center justify-between">
      <p className="text-[12px] text-foreground/85">{t("nav.preferencesLanguage")}</p>
      <InlineLanguageSwitcher />
    </div>
  )
}

function CurrencyRow() {
  const t = useTranslations()
  return (
    <div className="px-3 py-2 flex items-center justify-between">
      <p className="text-[12px] text-foreground/85">{t("nav.preferencesCurrency")}</p>
      <CurrencyDropdown />
    </div>
  )
}

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
// Sourced from i18n (`nav.searchPhrases`) at render time so the typing
// animation speaks the user's locale. The English fallback below is a
// defensive net only — if a locale ever ships without `nav.searchPhrases`,
// we still get a non-empty array instead of breaking the animation.
const TYPING_PHRASES_FALLBACK = [
  "Search 992 GT3 RS, Turbo S, Targa...",
  "What's a 1995 Porsche 993 worth?",
  "Find a 997 GT3 with manual gearbox",
  "Compare 991 GT3 vs 992 GT3",
  "Porsche 964 Carrera RS investment outlook",
  "Search 718 Spyder, Boxster GTS...",
  "How much is a Porsche 930 Turbo?",
  "Best Porsche under $100K right now",
]

// ─── MAIN HEADER COMPONENT ───
export function Header() {
  const t = useTranslations();
  const locale = useLocale();
  const { selectedRegion, setSelectedRegion } = useRegion();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isMarketLocked = /^\/(?:[a-z]{2}\/)?cars\/[^/]+\/[^/]+$/.test(pathname);
  // True when the user is on the browse listing page. In that case clicking
  // a region pill must also write the choice into the URL — that's what
  // BrowseClient reads via useClassicFilters to filter its grid.
  const isBrowsePage = /^\/(?:[a-z]{2}\/)?browse$/.test(pathname);
  // Route-aware header — only show controls where they actually apply.
  // Listings pages (home, /browse, /cars/{make}) get both ViewToggle and
  // Region pills, because that's where the user is actually looking at
  // cars and may want to switch view OR filter by country. Everywhere
  // else (advisor, report, pricing, tools, knowledge…) the header stays
  // clean.
  const isHomePage = /^\/(?:[a-z]{2})?\/?$/.test(pathname);
  const isCarsListPage = /^\/(?:[a-z]{2}\/)?cars\/[^/]+\/?$/.test(pathname);
  const isListingsRoute = isHomePage || isBrowsePage || isCarsListPage;
  const showViewToggle = isListingsRoute;
  const showRegionPills = isListingsRoute;
  // On /browse the URL is the source of truth for the active region. Read
  // from the query param so the active pill matches the current filter
  // even when the user lands via direct URL like /browse?region=US.
  const urlRegion = isBrowsePage ? searchParams.get("region") : null;
  const effectiveRegion = isBrowsePage ? urlRegion : selectedRegion;
  const [query, setQuery] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isOracleOpen, setIsOracleOpen] = useState(false);
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [accountSheetOpen, setAccountSheetOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  // Smart search autocomplete state
  const [searchResults, setSearchResults] = useState<SearchItem[]>([])
  const [activeIndex, setActiveIndex] = useState(0)
  const [showDropdown, setShowDropdown] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Typing animation for placeholder — phrases come from i18n so the
  // animation speaks the user's locale. t.raw() returns the array as-is.
  const localizedPhrases = (() => {
    try {
      const raw = t.raw("nav.searchPhrases")
      if (Array.isArray(raw) && raw.length > 0 && raw.every(p => typeof p === "string")) {
        return raw as string[]
      }
    } catch {
      // i18n key missing — fall through to fallback below
    }
    return TYPING_PHRASES_FALLBACK
  })()

  const [typedPlaceholder, setTypedPlaceholder] = useState("")
  const [phraseIndex, setPhraseIndex] = useState(0)
  const [charIndex, setCharIndex] = useState(0)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    // Don't animate if user is focused or typing
    if (isFocused || query) return

    const currentPhrase = localizedPhrases[phraseIndex]

    const timeout = setTimeout(() => {
      if (!isDeleting) {
        // Typing forward — slower for editorial calm (was 25-55ms; now 35-75ms)
        if (charIndex < currentPhrase.length) {
          setTypedPlaceholder(currentPhrase.slice(0, charIndex + 1))
          setCharIndex(charIndex + 1)
        } else {
          // Pause at end longer so the user can read the full phrase
          // before it starts deleting (was 2000ms; now 4000ms)
          setTimeout(() => setIsDeleting(true), 4000)
        }
      } else {
        // Deleting
        if (charIndex > 0) {
          setTypedPlaceholder(currentPhrase.slice(0, charIndex - 1))
          setCharIndex(charIndex - 1)
        } else {
          // Move to next phrase
          setIsDeleting(false)
          setPhraseIndex((phraseIndex + 1) % localizedPhrases.length)
        }
      }
    }, isDeleting ? 35 : 75)

    return () => clearTimeout(timeout)
  }, [charIndex, isDeleting, phraseIndex, isFocused, query, localizedPhrases])

  // Auth state
  const { user, profile, loading: authLoading, signOut } = useAuth();
  const creditsRemaining = profile?.pistonsBalance ?? profile?.creditsBalance ?? 0;
  const isAuthenticated = !!user;
  const hasUnlimited = (profile?.unlimitedReports ?? false) || profile?.tier === "MONTHLY" || profile?.tier === "ANNUAL";
  const planName =
    profile?.subscriptionPlanKey ??
    (profile?.tier === "PACK_OWNER" ? "top_up" : profile?.tier ?? "FREE");
  const homeHref = "/";

  // Publish the fixed header's real height (banner + nav) as a CSS var on <html>
  // so page layouts/cards can size themselves around whatever top chrome is showing.
  // Effect re-runs when the free-user banner appears/disappears (tier/credits change)
  // so the measurement stays in sync with the current header composition.
  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el || typeof window === "undefined") return;
    const publish = () => {
      const h = Math.round(el.getBoundingClientRect().height);
      if (h > 0) {
        document.documentElement.style.setProperty("--app-header-h", `${h}px`);
      }
    };
    publish();
    window.addEventListener("resize", publish);
    return () => window.removeEventListener("resize", publish);
  }, [profile?.tier, creditsRemaining]);

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
      <div ref={headerRef} className="fixed top-0 left-0 right-0 z-50">
        {/* Glass background — Obsidian */}
        <div className="absolute inset-0 h-full bg-background/85 backdrop-blur-xl border-b border-border" />

        {/* Low-pistons CTA banner — shown when FREE user can't afford a single Haus Report */}
        {/* TODO: paid tiers with a low balance may also need a warning — out of scope for now */}
        {profile && profile.tier === "FREE" && creditsRemaining < REPORT_PISTON_COST && (
          <div className="relative bg-primary/[0.06] border-b border-primary/20 px-4 py-2 text-center">
            <span className="text-[11px] text-foreground">
              {creditsRemaining === 0
                ? "Out of pistons — top up to generate a Haus Report ·"
                : `Only ${creditsRemaining} pistons left — not enough for a report (100 needed) ·`}{" "}
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
          {/* Left: Logo — MonzaHaus wordmark (Saira 600 + helmet) */}
          <Link href={homeHref} className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer">
            <MonzaHausWordmark
              tone="lavender-deep"
              className="text-foreground text-[18px] md:text-[22px]"
            />
          </Link>

          {/* View Toggle: Monza | Classic — only on home (where the dual
              feed view is the actual UX). Off on cars list, advisor, report,
              tools etc. so the header stays calm. */}
          {showViewToggle && <ViewToggle />}

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
                  placeholder={isFocused ? "Search 992, GT3, Turbo, 993..." : ""}
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

          {/* Region Filter — only where filtering by region actually does
              something: /cars/{make} list and /browse. On other pages (home,
              advisor, report, tools…) the region pills were noise. */}
          {showRegionPills && (
          <div
            className={`hidden md:flex items-center shrink-0 transition-opacity ${isMarketLocked ? "opacity-55" : ""}`}
            aria-disabled={isMarketLocked}
            title={isMarketLocked ? "Locked to vehicle market on detail pages" : undefined}
          >
            {REGIONS.map((region, i) => {
              const isActive = (region.id === "all" && !effectiveRegion) || effectiveRegion === region.id
              return (
                <div key={region.id} className="flex items-center">
                  {i > 0 && (
                    <div className="w-px h-3.5 bg-primary/20 mx-0.5" />
                  )}
                  <button
                    onClick={() => {
                      if (isMarketLocked) return
                      const next = region.id === "all" ? null : region.id
                      setSelectedRegion(next)
                      // When on /browse, also write the choice to the URL so
                      // BrowseClient (which reads via useClassicFilters) recortea
                      // the grid. Without this, only the global context updates
                      // and the listings would stay unchanged.
                      if (isBrowsePage) {
                        const sp = new URLSearchParams(searchParams.toString())
                        if (next) sp.set("region", next)
                        else sp.delete("region")
                        const qs = sp.toString()
                        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
                      }
                    }}
                    disabled={isMarketLocked}
                    className={`px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-[0.1em] transition-all disabled:cursor-not-allowed disabled:opacity-100 ${
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

          )}

          {/* Currency moved to Menu › Preferences (header was overcrowded;
              currency is a personal preference, lives next to Theme/Language). */}

          {/* Right: Actions — anchored to far right */}
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            {/* Credits - only show when authenticated, click → Pistons Wallet modal */}
            {isAuthenticated && (
              <button
                onClick={() => setWalletOpen(true)}
                className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 border border-border hover:bg-foreground/10 transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                aria-label={t("auth.pistons.walletTitle")}
              >
                <Piston className={`size-3 ${hasUnlimited || creditsRemaining > 0 ? 'text-primary' : 'text-destructive'}`} />
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

            {/* Advisor lives in a floating bottom-right FAB now
                (see <AdvisorFab/> mounted in the locale layout). Frees
                top-nav real estate. */}

            {/* Account button (desktop) — opens the same AccountSheetContent
                used by the mobile bottom sheet. Click no longer signs out;
                sign-out lives inside the sheet. */}
            {authLoading ? (
              <div className="hidden md:flex size-8 items-center justify-center">
                <div className="size-4 border-2 border-muted-foreground border-t-transparent rounded-full animate-spin" />
              </div>
            ) : isAuthenticated ? (
              <button
                onClick={() => setAccountSheetOpen(true)}
                className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                title={t("nav.account")}
              >
                <div className="size-7 rounded-full bg-primary/15 border border-primary/20 flex items-center justify-center">
                  <User className="size-3.5 text-primary" />
                </div>
                <span className="text-[11px] font-medium">
                  {profile?.name?.split(" ")[0] || t("nav.account")}
                </span>
              </button>
            ) : (
              <button
                onClick={() => setShowAuthModal(true)}
                className="hidden md:flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary text-primary-foreground hover:bg-primary/80 transition-colors text-[11px] font-semibold tracking-wide focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                {t('auth.signIn')}
              </button>
            )}

            {/* Theme + Language moved to Menu › Preferences. Header was
                overcrowded; both already exist inside the Menu sheet, so
                having them outside was duplication. */}

            {/* Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <button className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground hover:text-foreground transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background rounded">
                  <Menu className="size-4" />
                  <span className="hidden md:inline">{t('nav.menu')}</span>
                </button>
              </SheetTrigger>
              <SheetContent side="right" className="border-l border-primary/8 bg-background w-[340px] p-0 flex flex-col overflow-hidden">
                <SheetHeader className="px-6 pt-6 pb-3 shrink-0">
                  <SheetTitle className="font-display text-[20px] font-medium text-foreground text-left">
                    {t("nav.menuTitle")}
                  </SheetTitle>
                </SheetHeader>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto no-scrollbar pb-4">

                  {/* (Profile + Pistons used to live here in `hidden md:block`.
                      They moved to the Account sheet — opened from the
                      [👤 Edgar] button in the header — to mirror the mobile
                      Account / Menu split. The Menu is now navigation +
                      preferences only, no personal data.) */}

                  {/* ─── DISCOVER ─── */}
                  <MenuSection label={t("nav.discover")}>
                    <MenuLink href="/cars/porsche" icon={Car} label={t("nav.discoverPorsche")} />
                    <MenuLink href="/knowledge" icon={BookOpen} label={t("nav.discoverKnowledge")} />
                    <MenuLink href="/indices" icon={BarChart3} label={t("nav.discoverIndices")} />
                    <MenuLink href="/history" icon={TrendingUp} label={t("nav.discoverTrends")} />
                    <MenuLink href="/tools/porsche-vin-decoder" icon={Wrench} label={t("nav.discoverVin")} />
                    <MenuLink href="/buy/porsche" icon={ScrollText} label={t("nav.discoverBuy")} />
                  </MenuSection>

                  {/* ─── PLANS & BILLING ─── */}
                  <MenuSection label={t("nav.plans")}>
                    <MenuLink href="/pricing" icon={Piston} label={t("nav.plansPricing")} />
                    {isAuthenticated && (
                      <MenuLink href="/account" icon={FileText} label={t("nav.plansBilling")} />
                    )}
                  </MenuSection>

                  {/* ─── PREFERENCES ─── */}
                  <MenuSection label={t("nav.preferences")}>
                    <ThemeRow />
                    <LanguageRow />
                    <CurrencyRow />
                  </MenuSection>

                  {/* ─── HELP & LEGAL ─── */}
                  <MenuSection label={t("nav.help")}>
                    <MenuLink href="/advisor" icon={MessageCircle} label={t("nav.helpAdvisor")} />
                    <MenuLink href="/legal/privacy" icon={ShieldCheck} label={t("nav.helpPrivacy")} />
                    <MenuLink href="/legal/terms" icon={ScrollText} label={t("nav.helpTerms")} />
                  </MenuSection>

                  {/* App version footer */}
                  <p className="px-6 pt-3 text-[10px] tracking-[0.2em] uppercase text-muted-foreground/60">
                    {t("nav.appVersion")}
                  </p>
                </div>

                {/* (Sign-out moved to the Account sheet so it lives next to
                    the rest of "TÚ" — same place on mobile and desktop.) */}
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>

      {/* ACCOUNT SHEET (desktop) — TÚ side. Mirror of mobile MobileProfileSheet,
          opened by the [👤 Edgar] button in the header. Sign-out lives inside. */}
      <Sheet open={accountSheetOpen} onOpenChange={setAccountSheetOpen}>
        <SheetContent
          side="right"
          className="border-l border-primary/8 bg-background w-[360px] p-0 flex flex-col overflow-hidden"
        >
          <SheetHeader className="px-6 pt-6 pb-3 shrink-0">
            <SheetTitle className="font-display text-[20px] font-medium text-foreground text-left">
              {t("nav.accountTitle")}
            </SheetTitle>
          </SheetHeader>
          <div className="flex-1 overflow-y-auto px-5 pb-6">
            <AccountSheetContent
              onClose={() => setAccountSheetOpen(false)}
              onOpenAuth={() => setShowAuthModal(true)}
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* PISTONS WALLET MODAL */}
      <PistonsWalletModal
        open={walletOpen}
        onOpenChange={setWalletOpen}
        balance={creditsRemaining}
        tier={profile?.tier === "FREE" ? "FREE" : "PRO"}
        planName={planName}
        nextResetDate={new Date(profile?.creditResetDate ?? new Date().toISOString())}
        todayUsage={profile?.wallet?.todayUsage ?? { chat: 0, oracle: 0, report: 0 }}
        graceUsage={null}
        recentDebits={(profile?.wallet?.recentDebits ?? []).map((row) => ({
          amount: row.amount,
          label: row.label,
          surface: row.surface,
          timestamp: new Date(row.timestamp),
        }))}
        onClose={() => setWalletOpen(false)}
        onUpgrade={() => router.push("/pricing")}
      />

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
