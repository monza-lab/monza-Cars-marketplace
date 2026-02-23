"use client";

import { useEffect, useState, Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { useTranslations } from "next-intl";

const SUPPORTED_LOCALES = new Set(["en", "es", "de", "ja"]);

function getLocalePrefixFromPathname(pathname: string): string {
  const firstSegment = pathname.split("/").filter(Boolean)[0];
  if (!firstSegment || !SUPPORTED_LOCALES.has(firstSegment)) {
    return "";
  }
  return `/${firstSegment}`;
}

type LiveRegionTotals = {
  all: number;
  US: number;
  UK: number;
  EU: number;
  JP: number;
};

type HomeAggregates = {
  liveNow: number;
  regionTotals: LiveRegionTotals;
};

type HomeAuctionPayload = {
  auctions: Auction[];
  aggregates?: HomeAggregates;
};

function normalizeAuctionPayload(payload: any): HomeAuctionPayload {
  const rows = Array.isArray(payload?.auctions)
    ? payload.auctions
    : Array.isArray(payload?.data)
      ? payload.data
      : [];

  const auctions = rows.map((a: any) => ({
    ...a,
    viewCount: typeof a.viewCount === "number" ? a.viewCount : 0,
    watchCount: typeof a.watchCount === "number" ? a.watchCount : 0,
    exteriorColor: a.exteriorColor ?? null,
    description: a.description ?? null,
    analysis: a.investmentGrade
      ? {
          bidTargetLow: null,
          bidTargetHigh: null,
          confidence: null,
          investmentGrade: a.investmentGrade,
          appreciationPotential: a.trend,
          keyStrengths: [],
          redFlags: [],
        }
      : null,
    priceHistory: Array.isArray(a.priceHistory) ? a.priceHistory : [],
    fairValueByRegion: a.fairValueByRegion,
    category: a.category,
    region: a.region,
  }));

  const aggregatePayload = payload?.aggregates;
  const aggregates = aggregatePayload
    ? {
        liveNow: typeof aggregatePayload.liveNow === "number" ? aggregatePayload.liveNow : auctions.length,
        regionTotals: {
          all: Number(aggregatePayload?.regionTotals?.all ?? auctions.length),
          US: Number(aggregatePayload?.regionTotals?.US ?? 0),
          UK: Number(aggregatePayload?.regionTotals?.UK ?? auctions.length),
          EU: Number(aggregatePayload?.regionTotals?.EU ?? 0),
          JP: Number(aggregatePayload?.regionTotals?.JP ?? auctions.length),
        },
      }
    : undefined;

  return { auctions, aggregates };
}

async function fetchAuctionsWithFallback(): Promise<HomeAuctionPayload> {
  const localePrefix = typeof window === "undefined"
    ? ""
    : getLocalePrefixFromPathname(window.location.pathname);

  const candidates = [
    `${localePrefix}/api/mock-auctions?limit=2000`,
    "/api/mock-auctions?limit=2000",
    `${localePrefix}/api/auctions?limit=2000`,
    "/api/auctions?limit=2000",
  ];

  for (const endpoint of candidates) {
    try {
      const response = await fetch(endpoint, { cache: "no-store" });
      if (!response.ok) {
        continue;
      }
      const payload = await response.json();
      const normalized = normalizeAuctionPayload(payload);
      if (normalized.auctions.length > 0) {
        return normalized;
      }
    } catch {
      // Try next endpoint.
    }
  }

  return { auctions: [] };
}

type RegionalPricing = {
  currency: "$" | "€" | "£" | "¥";
  low: number;
  high: number;
};

type FairValueByRegion = {
  US: RegionalPricing;
  EU: RegionalPricing;
  UK: RegionalPricing;
  JP: RegionalPricing;
};

type Auction = {
  id: string;
  title: string;
  make: string;
  model: string;
  year: number;
  trim: string | null;
  currentBid: number;
  bidCount: number;
  viewCount: number;
  watchCount: number;
  status: string;
  endTime: string;
  platform: string;
  engine: string | null;
  transmission: string | null;
  exteriorColor: string | null;
  mileage: number | null;
  mileageUnit: string | null;
  location: string | null;
  region?: string | null;
  description: string | null;
  images: string[];
  analysis: {
    bidTargetLow: number | null;
    bidTargetHigh: number | null;
    confidence: string | null;
    investmentGrade: string | null;
    appreciationPotential: string | null;
    keyStrengths: string[];
    redFlags: string[];
  } | null;
  priceHistory: { price: number; timestamp: string }[];
  fairValueByRegion?: FairValueByRegion;
  category?: string;
};

function LoadingSpinner({ label }: { label: string }) {
  return (
    <div className="h-screen w-full flex items-center justify-center bg-[#0b0b10]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-2 border-[#F8B4D9] border-t-transparent rounded-full animate-spin" />
        <span className="text-[#9CA3AF] text-sm tracking-wide">{label}</span>
      </div>
    </div>
  );
}

function HomeContent({
  loadingLabel,
  emptyLabel,
}: {
  loadingLabel: string;
  emptyLabel: string;
}) {
  const [auctions, setAuctions] = useState<Auction[]>([]);
  const [aggregates, setAggregates] = useState<HomeAggregates | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAuctions() {
      try {
        const fetched = await fetchAuctionsWithFallback();
        setAuctions(fetched.auctions);
        setAggregates(fetched.aggregates);
      } catch (error) {
        console.error("Failed to fetch auctions:", error);
      } finally {
        setLoading(false);
      }
    }
    fetchAuctions();
  }, []);

  if (loading) {
    return <LoadingSpinner label={loadingLabel} />;
  }

  if (auctions.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0b0b10]">
        <span className="text-[#9CA3AF] text-sm">{emptyLabel}</span>
      </div>
    );
  }

  return <DashboardClient auctions={auctions} liveRegionTotals={aggregates?.regionTotals} />;
}

export default function Home() {
  const t = useTranslations("home");

  return (
    <Suspense fallback={<LoadingSpinner label={t("loadingAssets")} />}>
      <HomeContent loadingLabel={t("loadingAssets")} emptyLabel={t("noAuctionsFound")} />
    </Suspense>
  );
}
