"use client";

import { useMemo } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import {
  MapPin,
  ChevronRight,
  Calendar,
  Gauge,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import type { CollectorCar, Platform } from "@/lib/curatedCars";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface ModelPageClientProps {
  make: string;
  model: string;
  cars: CollectorCar[];
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatCurrency(amount: number): string {
  if (amount >= 1_000_000) return `$${(amount / 1_000_000).toFixed(2)}M`;
  if (amount >= 1_000) return `$${(amount / 1_000).toFixed(0)}K`;
  return `$${amount.toLocaleString("en-US")}`;
}

function formatDate(date: Date): string {
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });
}

// Platform config - real platforms only
const PLATFORM_CONFIG: Record<Platform, { label: string; shortLabel: string; color: string; market: string }> = {
  BRING_A_TRAILER: {
    label: "Bring a Trailer",
    shortLabel: "BaT",
    color: "#F8B4D9",
    market: "US"
  },
  CARS_AND_BIDS: {
    label: "Cars & Bids",
    shortLabel: "C&B",
    color: "#c084fc",
    market: "US"
  },
  COLLECTING_CARS: {
    label: "Collecting Cars",
    shortLabel: "CC",
    color: "#67e8f9",
    market: "EU/UK"
  },
  RM_SOTHEBYS: {
    label: "RM Sotheby's",
    shortLabel: "RM",
    color: "#fbbf24",
    market: "Global"
  },
  GOODING: {
    label: "Gooding & Co",
    shortLabel: "Gooding",
    color: "#34d399",
    market: "US"
  },
  BONHAMS: {
    label: "Bonhams",
    shortLabel: "Bonhams",
    color: "#fb923c",
    market: "Global"
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// SALE CARD - Shows real verified sale data
// ═══════════════════════════════════════════════════════════════════════════

function SaleCard({ car, index }: { car: CollectorCar; index: number }) {
  const platformCfg = PLATFORM_CONFIG[car.platform];
  const makePath = car.make.toLowerCase().replace(/\s+/g, "-");
  const isEnded = car.status === "ENDED";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
    >
      <Link href={`/cars/${makePath}/${car.id}`} className="group block">
        <div className="overflow-hidden rounded-2xl border border-white/5 bg-[#0F1012]/80 transition-all hover:border-[#F8B4D9]/20 hover:shadow-xl hover:shadow-[#F8B4D9]/5">
          {/* Image */}
          <div className="relative aspect-[16/10] overflow-hidden bg-[#0b0b10]">
            <Image
              src={car.image}
              alt={car.title}
              fill
              sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
              className="object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-transparent to-transparent" />

            {/* Platform badge - real source */}
            <span
              className="absolute left-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-semibold tracking-[0.1em] backdrop-blur-sm"
              style={{
                backgroundColor: `${platformCfg.color}15`,
                borderColor: `${platformCfg.color}30`,
                color: platformCfg.color
              }}
            >
              {platformCfg.shortLabel}
            </span>

            {/* Status */}
            <span
              className={cn(
                "absolute right-3 top-3 rounded-full border px-2.5 py-0.5 text-[10px] font-medium backdrop-blur-sm",
                isEnded
                  ? "bg-white/5 border-white/10 text-[#9CA3AF]"
                  : "bg-[#34D399]/10 border-[#34D399]/20 text-[#34D399]"
              )}
            >
              {isEnded ? "Sold" : "Active"}
            </span>
          </div>

          {/* Body - Real data only */}
          <div className="p-4">
            <h3 className="text-sm font-medium text-[#FFFCF7] group-hover:text-[#F8B4D9] transition-colors line-clamp-1">
              {car.title}
            </h3>

            {/* Price - the real sale/bid price */}
            <div className="mt-3 flex items-baseline justify-between">
              <div>
                <span className="text-xl font-light text-[#F8B4D9]">
                  {formatCurrency(car.currentBid)}
                </span>
                <span className="ml-2 text-[10px] text-[#4B5563]">
                  {isEnded ? "sold" : "current bid"}
                </span>
              </div>
            </div>

            {/* Verified details */}
            <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-[#4B5563]">
              <span className="flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(car.endTime)}
              </span>
              <span className="flex items-center gap-1">
                <Gauge className="size-3" />
                {car.mileage.toLocaleString()} {car.mileageUnit}
              </span>
              <span className="flex items-center gap-1">
                <MapPin className="size-3" />
                {car.location}
              </span>
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PLATFORM SECTION - Groups sales by real market source
// ═══════════════════════════════════════════════════════════════════════════

function PlatformSection({
  platform,
  cars,
  isFirst
}: {
  platform: Platform;
  cars: CollectorCar[];
  isFirst: boolean;
}) {
  const cfg = PLATFORM_CONFIG[platform];

  // Calculate real stats from actual data
  const prices = cars.map(c => c.currentBid);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const soldCount = cars.filter(c => c.status === "ENDED").length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: isFirst ? 0.2 : 0.3 }}
      className="mb-12"
    >
      {/* Platform header */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="flex size-10 items-center justify-center rounded-xl"
            style={{ backgroundColor: `${cfg.color}15` }}
          >
            <span className="text-sm font-bold" style={{ color: cfg.color }}>
              {cfg.shortLabel}
            </span>
          </div>
          <div>
            <h3 className="text-lg font-medium text-[#FFFCF7]">
              {cfg.label}
            </h3>
            <p className="text-[11px] text-[#4B5563]">
              {cfg.market} Market · {soldCount} sold · {cars.length - soldCount} active
            </p>
          </div>
        </div>

        {/* Real price range from actual sales */}
        <div className="text-right hidden sm:block">
          <span className="text-[10px] font-medium tracking-[0.15em] uppercase text-[#4B5563]">
            Price Range
          </span>
          <p className="text-sm text-[#FFFCF7]">
            {formatCurrency(minPrice)} – {formatCurrency(maxPrice)}
          </p>
        </div>
      </div>

      {/* Sales grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cars.map((car, index) => (
          <SaleCard key={car.id} car={car} index={index} />
        ))}
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export function ModelPageClient({ make, model, cars }: ModelPageClientProps) {
  // Group cars by platform for real market segmentation
  const carsByPlatform = useMemo(() => {
    const grouped = cars.reduce((acc, car) => {
      if (!acc[car.platform]) acc[car.platform] = [];
      acc[car.platform].push(car);
      return acc;
    }, {} as Record<Platform, CollectorCar[]>);

    // Sort each platform's cars by date (most recent first)
    Object.values(grouped).forEach(platformCars => {
      platformCars.sort((a, b) =>
        new Date(b.endTime).getTime() - new Date(a.endTime).getTime()
      );
    });

    return grouped;
  }, [cars]);

  // Real aggregated stats (from actual data, not invented)
  const stats = useMemo(() => {
    const prices = cars.map(c => c.currentBid);
    const soldCars = cars.filter(c => c.status === "ENDED");

    return {
      totalSales: cars.length,
      soldCount: soldCars.length,
      activeCount: cars.length - soldCars.length,
      minPrice: Math.min(...prices),
      maxPrice: Math.max(...prices),
      platforms: Object.keys(carsByPlatform).length,
      heroImage: cars[0]?.image || "/cars/placeholder.jpg",
      // Date range of data
      oldestSale: new Date(Math.min(...cars.map(c => new Date(c.endTime).getTime()))),
      newestSale: new Date(Math.max(...cars.map(c => new Date(c.endTime).getTime()))),
    };
  }, [cars, carsByPlatform]);

  const platformOrder: Platform[] = [
    "BRING_A_TRAILER",
    "CARS_AND_BIDS",
    "COLLECTING_CARS",
    "RM_SOTHEBYS",
    "GOODING",
    "BONHAMS"
  ];

  return (
    <div className="min-h-screen bg-[#0b0b10]">
      {/* ═══════════════════════════════════════════════════════════════════
          HERO SECTION - Clean, factual
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="relative h-[50vh] min-h-[400px] overflow-hidden">
        {/* Background Image */}
        <div className="absolute inset-0">
          <Image
            src={stats.heroImage}
            alt={`${make} ${model}`}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/70 to-[#0b0b10]/30" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex h-full flex-col justify-end pb-10 px-6 md:px-12 lg:px-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="max-w-4xl"
          >
            {/* Breadcrumb */}
            <div className="flex items-center gap-2 text-[11px] text-[#9CA3AF] mb-4">
              <Link href="/" className="hover:text-[#F8B4D9] transition-colors">
                Market
              </Link>
              <ChevronRight className="size-3" />
              <Link
                href={`/cars/${make.toLowerCase().replace(/\s+/g, "-")}`}
                className="hover:text-[#F8B4D9] transition-colors"
              >
                {make}
              </Link>
              <ChevronRight className="size-3" />
              <span className="text-[#FFFCF7]">{model}</span>
            </div>

            {/* Title */}
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-tight text-[#FFFCF7]">
              {make}{" "}
              <span className="text-gradient font-normal">{model}</span>
            </h1>

            {/* Real stats only */}
            <div className="mt-6 flex flex-wrap items-center gap-6">
              <div>
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                  Sales Tracked
                </span>
                <p className="text-2xl font-light text-[#FFFCF7]">
                  {stats.totalSales}
                </p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                  Price Range
                </span>
                <p className="text-2xl font-light text-[#F8B4D9]">
                  {formatCurrency(stats.minPrice)} – {formatCurrency(stats.maxPrice)}
                </p>
              </div>
              <div className="h-10 w-px bg-white/10" />
              <div>
                <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[#4B5563]">
                  Platforms
                </span>
                <p className="text-2xl font-light text-[#FFFCF7]">
                  {stats.platforms}
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          DATA SOURCE NOTICE - Transparency
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-6 md:px-12 lg:px-20">
        <div className="flex items-start gap-3 rounded-xl border border-white/5 bg-white/[0.02] p-4">
          <Info className="size-4 text-[#4B5563] mt-0.5 shrink-0" />
          <div>
            <p className="text-[12px] text-[#9CA3AF]">
              Data from {formatDate(stats.oldestSale)} to {formatDate(stats.newestSale)} ·
              Sourced from {stats.platforms} auction platform{stats.platforms > 1 ? "s" : ""} ·
              {stats.soldCount} completed sale{stats.soldCount !== 1 ? "s" : ""}, {stats.activeCount} active listing{stats.activeCount !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════════
          SALES BY PLATFORM - Real market segmentation
          ═══════════════════════════════════════════════════════════════════ */}
      <section className="px-6 py-8 md:px-12 lg:px-20 pb-24">
        <div className="mb-8">
          <h2 className="text-2xl font-light text-[#FFFCF7]">
            Market Activity
          </h2>
          <p className="mt-1 text-[13px] text-[#9CA3AF]">
            Sales grouped by auction platform
          </p>
        </div>

        {platformOrder.map((platform, idx) => {
          const platformCars = carsByPlatform[platform];
          if (!platformCars || platformCars.length === 0) return null;

          return (
            <PlatformSection
              key={platform}
              platform={platform}
              cars={platformCars}
              isFirst={idx === 0}
            />
          );
        })}

        {/* No data message if somehow empty */}
        {Object.keys(carsByPlatform).length === 0 && (
          <div className="flex items-center justify-center py-20">
            <p className="text-[#4B5563]">No sales data available for this model</p>
          </div>
        )}
      </section>
    </div>
  );
}
