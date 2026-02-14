import { setRequestLocale, getTranslations } from "next-intl/server";
import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { fetchLiveListingsAsCollectorCars } from "@/lib/supabaseLiveListings";

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

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const t = await getTranslations("home");

  // Fetch data server-side — no client-side waterfall
  const live = await fetchLiveListingsAsCollectorCars();
  const ferraris = live.filter(car => car.make.toLowerCase() === "ferrari");

  // Transform to match the Auction type expected by DashboardClient
  const auctions: Auction[] = ferraris.map(car => ({
    id: car.id,
    title: car.title,
    make: car.make,
    model: car.model,
    year: car.year,
    trim: car.trim,
    currentBid: car.currentBid,
    bidCount: car.bidCount,
    viewCount: 0,
    watchCount: 0,
    status: car.status,
    endTime: car.endTime.toISOString(),
    platform: car.platform,
    engine: car.engine,
    transmission: car.transmission,
    exteriorColor: null,
    mileage: car.mileage,
    mileageUnit: car.mileageUnit,
    location: car.location,
    description: null,
    images: car.images,
    analysis: car.investmentGrade ? {
      bidTargetLow: null,
      bidTargetHigh: null,
      confidence: null,
      investmentGrade: car.investmentGrade,
      appreciationPotential: car.trend,
      keyStrengths: [],
      redFlags: [],
    } : null,
    priceHistory: [],
    fairValueByRegion: car.fairValueByRegion,
    category: car.category,
  }));

  if (auctions.length === 0) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#050505]">
        <span className="text-[#9CA3AF] text-sm">{t("noAuctionsFound")}</span>
      </div>
    );
  }

  return <DashboardClient auctions={auctions} />;
}
