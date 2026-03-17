"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  Search, SlidersHorizontal, X, Car, DollarSign,
  Loader2, Clock, ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useSearch } from "@/hooks/useSearch";
import { useCurrency } from "@/lib/CurrencyContext";

import { useLocale, useTranslations } from "next-intl";

const ALL = "__all__";

const MAKE_VALUES = [
  "Porsche",
  "Ferrari",
  "Lamborghini",
  "McLaren",
  "BMW",
  "Mercedes-Benz",
  "Aston Martin",
  "Bugatti",
  "Pagani",
  "Koenigsegg",
  "Toyota",
  "Nissan",
  "Honda",
  "Lexus",
  "Mazda",
  "Mitsubishi",
  "Subaru",
  "Ford",
  "Jaguar",
  "Maserati",
  "Lancia",
  "Audi",
  "Alpine",
  "De Tomaso",
];

const PLATFORMS = [
  { value: "BRING_A_TRAILER", label: "Bring a Trailer" },
  { value: "RM_SOTHEBYS", label: "RM Sotheby's" },
  { value: "GOODING", label: "Gooding & Co" },
  { value: "BONHAMS", label: "Bonhams" },
  { value: "CARS_AND_BIDS", label: "Cars & Bids" },
  { value: "COLLECTING_CARS", label: "Collecting Cars" },
];

const STATUS_VALUES = [
  { value: "ACTIVE", key: "live" as const },
  { value: "ENDED", key: "completed" as const },
];

const SORT_OPTIONS = [
  { value: "createdAt_desc", key: "newestFirst" as const },
  { value: "createdAt_asc", key: "oldestFirst" as const },
  { value: "currentBid_desc", key: "priceHighToLow" as const },
  { value: "currentBid_asc", key: "priceLowToHigh" as const },
  { value: "endTime_asc", key: "endingSoon" as const },
];

const PLATFORM_SHORT: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  RM_SOTHEBYS: "RM",
  GOODING: "G&C",
  BONHAMS: "BON",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
};

interface AuctionResult {
  id: string; title: string; make: string; model: string; year: number;
  platform: string; currentBid: number | null; finalPrice: number | null;
  status: string; endTime: string | null; bidCount: number; images: string[];
}

function mapStatus(status: string): "live" | "completed" {
  if (status === "ACTIVE" || status === "ENDING_SOON") return "live";
  return "completed";
}

function timeLeft(
  dateStr: string | null,
  labels: {
    none: string;
    ended: string;
    day: string;
    hour: string;
    minute: string;
  }
): string {
  if (!dateStr) return labels.none;
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff < 0) return labels.ended;
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours >= 24) return `${Math.floor(hours / 24)}${labels.day} ${hours % 24}${labels.hour}`;
  return `${hours}${labels.hour} ${mins}${labels.minute}`;
}

export function SearchClient() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("search");
  const { formatPrice } = useCurrency();
  const { query, debouncedQuery, setQuery } = useSearch(300);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedMake, setSelectedMake] = useState(ALL);
  const [selectedPlatform, setSelectedPlatform] = useState(ALL);
  const [selectedStatus, setSelectedStatus] = useState(ALL);
  const [priceMin, setPriceMin] = useState("");
  const [priceMax, setPriceMax] = useState("");
  const [yearMin, setYearMin] = useState("");
  const [yearMax, setYearMax] = useState("");
  const [sortBy, setSortBy] = useState("createdAt_desc");
  const [results, setResults] = useState<AuctionResult[]>([]);
  const [total, setTotal] = useState(0);
  const [isSearching, setIsSearching] = useState(false);

  const fetchResults = useCallback(async () => {
    setIsSearching(true);
    try {
      const params = new URLSearchParams();
      params.set("limit", "120"); // Show all 120 cars
      if (debouncedQuery) params.set("query", debouncedQuery);
      if (selectedMake !== ALL) params.set("make", selectedMake);
      if (selectedPlatform !== ALL) params.set("platform", selectedPlatform);
      if (selectedStatus !== ALL) params.set("status", selectedStatus);
      const [sortField, sortDir] = sortBy.split("_");
      params.set("sortBy", sortField);
      params.set("sortOrder", sortDir);

      // Use mock-auctions API for the 120+ investment-grade cars
      const res = await fetch(`/api/mock-auctions?${params.toString()}`);
      if (!res.ok) throw new Error("Failed");
      const json = await res.json();
      setResults(json.auctions ?? []);
      setTotal(json.total ?? 0);
    } catch { setResults([]); setTotal(0); }
    finally { setIsSearching(false); }
  }, [debouncedQuery, selectedMake, selectedPlatform, selectedStatus, sortBy]);

  useEffect(() => { fetchResults(); }, [fetchResults]);

  const activeFilterCount = [
    selectedMake !== ALL,
    selectedPlatform !== ALL,
    selectedStatus !== ALL,
    !!priceMin,
    !!priceMax,
    !!yearMin,
    !!yearMax,
  ].filter(Boolean).length;

  const clearFilters = () => {
    setSelectedMake(ALL);
    setSelectedPlatform(ALL);
    setSelectedStatus(ALL);
    setPriceMin("");
    setPriceMax("");
    setYearMin("");
    setYearMax("");
  };

  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* ═══════════════════════════════════════════════════════════════════════
          COMPACT HEADER — Search + Title + Filters inline
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-none px-6 py-4 border-b border-border">
        {/* Top Row: Title + Search + Sort */}
        <div className="flex items-center gap-6">
          {/* Title */}
          <div className="shrink-0">
            <h1 className="text-xl font-semibold text-foreground tracking-tight">
              {t("header.title")} <span className="text-gradient">{t("header.titleAccent")}</span>
            </h1>
          </div>

          {/* Search Bar */}
          <div className="relative flex-1 max-w-xl">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              type="search"
              placeholder={t("header.searchPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-10 rounded-full border-border bg-card pl-10 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus-visible:border-primary/25 focus-visible:ring-primary/10 backdrop-blur-xl"
            />
            {query && (
              <button onClick={() => setQuery("")} className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="size-4" />
              </button>
            )}
            {isSearching && (
              <div className="absolute right-10 top-1/2 -translate-y-1/2">
                <Loader2 className="size-4 animate-spin text-primary" />
              </div>
            )}
          </div>

          {/* Results Count + Sort */}
          <div className="flex items-center gap-4 shrink-0 ml-auto">
            <span className="text-[11px] tracking-[0.1em] text-muted-foreground tabular-nums">
              {t("header.results", { count: total })}
            </span>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="h-8 w-[150px] rounded-full border-border bg-card text-muted-foreground text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {t(`sort.${o.key}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Bottom Row: Quick Filters */}
        <div className="flex items-center gap-2 mt-3">
          <Button
            variant="outline"
            size="sm"
            className={cn(
              "h-7 gap-1.5 rounded-full border-border text-[10px] tracking-[0.05em] text-muted-foreground hover:bg-primary/6 hover:text-foreground",
              filtersOpen && "border-primary/25 bg-primary/8 text-primary"
            )}
            onClick={() => setFiltersOpen(!filtersOpen)}
          >
            <SlidersHorizontal className="size-3" />
            {t("filters.button")}
            {activeFilterCount > 0 && (
              <Badge className="ml-1 size-4 items-center justify-center rounded-full bg-primary p-0 text-[9px] text-primary-foreground">
                {activeFilterCount}
              </Badge>
            )}
            <ChevronDown className={cn("size-3 transition-transform", filtersOpen && "rotate-180")} />
          </Button>

          {/* Quick Filter Chips */}
          {STATUS_VALUES.map((status) => (
            <button
              key={status.value}
              onClick={() => setSelectedStatus(selectedStatus === status.value ? ALL : status.value)}
              className={cn(
                "h-7 px-3 rounded-full text-[10px] font-medium tracking-[0.05em] transition-all border",
                selectedStatus === status.value
                  ? "bg-primary text-primary-foreground border-transparent"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/20 hover:text-foreground"
              )}
            >
              {t(`statuses.${status.key}`)}
            </button>
          ))}

          {/* Make Chip */}
          <Select value={selectedMake} onValueChange={setSelectedMake}>
            <SelectTrigger className="h-7 w-auto min-w-[100px] rounded-full border-border bg-transparent text-[10px] tracking-[0.05em] text-muted-foreground hover:border-primary/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={ALL} value={ALL}>
                {t("filters.allMakes")}
              </SelectItem>
              {MAKE_VALUES.map((m) => (
                <SelectItem key={m} value={m}>
                  {m}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Platform Chip */}
          <Select value={selectedPlatform} onValueChange={setSelectedPlatform}>
            <SelectTrigger className="h-7 w-auto min-w-[110px] rounded-full border-border bg-transparent text-[10px] tracking-[0.05em] text-muted-foreground hover:border-primary/20">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem key={ALL} value={ALL}>
                {t("filters.allPlatforms")}
              </SelectItem>
              {PLATFORMS.map((p) => (
                <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeFilterCount > 0 && (
            <button
              onClick={clearFilters}
              className="h-7 px-3 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {t("filters.clearAll")}
            </button>
          )}
        </div>

        {/* Advanced Filters Panel */}
        {filtersOpen && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <div>
                <label className="mb-1.5 block text-[9px] font-medium tracking-[0.2em] uppercase text-muted-foreground">{t("filters.yearRange")}</label>
                <div className="flex items-center gap-2">
                  <Input type="number" placeholder={t("filters.from")} value={yearMin} onChange={(e) => setYearMin(e.target.value)} className="h-8 rounded-lg border-border bg-card text-sm text-muted-foreground placeholder:text-muted-foreground" />
                  <span className="text-muted-foreground">-</span>
                  <Input type="number" placeholder={t("filters.to")} value={yearMax} onChange={(e) => setYearMax(e.target.value)} className="h-8 rounded-lg border-border bg-card text-sm text-muted-foreground placeholder:text-muted-foreground" />
                </div>
              </div>
              <div className="sm:col-span-2 lg:col-span-2">
                <label className="mb-1.5 block text-[9px] font-medium tracking-[0.2em] uppercase text-muted-foreground">{t("filters.priceRange")}</label>
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" placeholder={t("filters.min")} value={priceMin} onChange={(e) => setPriceMin(e.target.value)} className="h-8 rounded-lg border-border bg-card pl-7 text-sm text-muted-foreground placeholder:text-muted-foreground" />
                  </div>
                  <span className="text-muted-foreground">-</span>
                  <div className="relative flex-1">
                    <DollarSign className="absolute left-2.5 top-1/2 size-3 -translate-y-1/2 text-muted-foreground" />
                    <Input type="number" placeholder={t("filters.max")} value={priceMax} onChange={(e) => setPriceMax(e.target.value)} className="h-8 rounded-lg border-border bg-card pl-7 text-sm text-muted-foreground placeholder:text-muted-foreground" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ═══════════════════════════════════════════════════════════════════════
          SCROLLABLE RESULTS GRID — The Trading Floor
          ═══════════════════════════════════════════════════════════════════════ */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="px-6 py-4">
          {isSearching ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 animate-spin text-primary" />
            </div>
          ) : results.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {results.map((result) => (
                <InvestmentCard
                  key={result.id}
                  result={result}
                  onClick={() => router.push(`/auctions/${result.id}`)}
                  formatCurrency={(amount: number) => formatPrice(amount)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card">
              <div className="flex flex-col items-center justify-center py-20">
                <Search className="size-10 text-muted-foreground/30" />
                <p className="mt-4 text-sm font-medium text-muted-foreground">{t("empty.title")}</p>
                <p className="mt-1 max-w-sm text-center text-[11px] text-muted-foreground">
                  {t("empty.subtitle")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-6 rounded-full border-border text-muted-foreground"
                  onClick={() => { setQuery(""); clearFilters(); }}
                >
                  {t("empty.clearSearch")}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PREMIUM INVESTMENT CARD — Full-bleed image with overlay data
// ─────────────────────────────────────────────────────────────────────────────
function InvestmentCard({
  result,
  onClick,
  formatCurrency,
}: {
  result: AuctionResult;
  onClick: () => void;
  formatCurrency: (amount: number) => string;
}) {
  const t = useTranslations("search");
  const tStatus = useTranslations("status");
  const isLive = mapStatus(result.status) === "live";
  const price = result.finalPrice ?? result.currentBid;
  const imageUrl = result.images?.[0] ?? null;

  return (
    <div
      onClick={onClick}
      className="group relative cursor-pointer overflow-hidden rounded-2xl border border-border bg-card transition-all duration-300 hover:border-primary/40 hover:shadow-2xl hover:shadow-primary/8 hover:-translate-y-1"
    >
      {/* Full-bleed Image */}
      <div className="relative aspect-[16/10] overflow-hidden">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={result.title}
            className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full items-center justify-center bg-background">
            <Car className="size-12 text-muted-foreground/30" />
          </div>
        )}

        {/* Heavy bottom gradient for text readability */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent" />

        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-start justify-between">
          {/* Status Badge */}
          <span
            className={cn(
              "flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] uppercase backdrop-blur-md",
              isLive
                ? "bg-positive/20 text-positive"
                : "bg-foreground/10 text-muted-foreground"
            )}
          >
            {isLive && (
              <span className="relative flex size-1.5">
                <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-75" />
                <span className="relative inline-flex size-1.5 rounded-full bg-positive" />
              </span>
            )}
            {isLive ? tStatus("live") : tStatus("sold")}
          </span>

          {/* Platform Badge */}
          <span className="rounded-full bg-black/50 backdrop-blur-md px-2.5 py-1 text-[10px] font-medium tracking-[0.08em] uppercase text-foreground">
            {PLATFORM_SHORT[result.platform] ?? result.platform}
          </span>
        </div>

        {/* Bottom overlay content */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Title */}
          <h3 className="text-[15px] font-semibold text-foreground leading-tight line-clamp-2 group-hover:text-primary transition-colors">
            {result.year} {result.make} {result.model}
          </h3>

          {/* Price + Time Row */}
          <div className="flex items-end justify-between mt-2">
            <div>
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                {isLive ? t("card.currentBid") : t("card.soldFor")}
              </p>
              <p className="text-xl font-bold text-primary tabular-nums">
                {price ? formatCurrency(price) : t("common.none")}
              </p>
            </div>

            <div className="text-right">
              {isLive && result.endTime && (
                <div className="flex items-center gap-1 text-foreground">
                  <Clock className="size-3" />
                  <span className="text-[12px] font-mono font-medium tabular-nums">
                    {timeLeft(result.endTime, {
                      none: t("common.none"),
                      ended: t("time.ended"),
                      day: t("time.units.day"),
                      hour: t("time.units.hour"),
                      minute: t("time.units.minute"),
                    })}
                  </span>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {result.bidCount > 0
                  ? t("card.bids", { count: result.bidCount })
                  : t("card.noBids")}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
