"use client";

import { useEffect, useState, Suspense } from "react";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { useTranslations } from "next-intl";

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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAuctions() {
      try {
        const response = await fetch(`/api/mock-auctions?limit=1000`);
        const data = await response.json();
        // Transform API response to match Auction type
        const transformed = data.auctions.map((a: any) => ({
          ...a,
          viewCount: 0,
          watchCount: 0,
          exteriorColor: null,
          description: null,
          analysis: a.investmentGrade ? {
            bidTargetLow: null,
            bidTargetHigh: null,
            confidence: null,
            investmentGrade: a.investmentGrade,
            appreciationPotential: a.trend,
            keyStrengths: [],
            redFlags: [],
          } : null,
          priceHistory: [],
          fairValueByRegion: a.fairValueByRegion,
          category: a.category,
          region: a.region,
        }));
        setAuctions(transformed);
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

  return <DashboardClient auctions={auctions} />;
}

export default function Home() {
  const t = useTranslations("home");

  return (
    <Suspense fallback={<LoadingSpinner label={t("loadingAssets")} />}>
      <HomeContent loadingLabel={t("loadingAssets")} emptyLabel={t("noAuctionsFound")} />
    </Suspense>
  );
}
