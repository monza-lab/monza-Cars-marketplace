"use client";

import { motion } from "framer-motion";
import {
  ExternalLink,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Gauge,
  Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/CurrencyContext";
import { Badge } from "@/components/ui/badge";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ComparableSale {
  title: string;
  platform: string;
  soldPrice: number;
  soldDate: string;
  mileage?: number;
  url?: string;
}

interface ComparableSalesProps {
  comparables: ComparableSale[];
  currentPrice?: number;
  currency?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMileage(miles: number) {
  return `${miles.toLocaleString("en-US")} mi`;
}

const PLATFORM_STYLES: Record<string, string> = {
  "Bring a Trailer": "bg-amber-500/15 text-destructive border-amber-500/30",
  BaT: "bg-amber-500/15 text-destructive border-amber-500/30",
  "Cars & Bids": "bg-blue-500/15 text-blue-400 border-blue-500/30",
  Hemmings: "bg-positive/15 text-positive border-positive/30",
  "RM Sotheby's": "bg-purple-500/15 text-purple-400 border-purple-500/30",
  Bonhams: "bg-rose-500/15 text-rose-400 border-rose-500/30",
  Mecum: "bg-destructive/15 text-destructive border-destructive/30",
  "Barrett-Jackson": "bg-destructive/15 text-destructive border-destructive/30",
  eBay: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
};

function getPlatformStyle(platform: string) {
  return (
    PLATFORM_STYLES[platform] ??
    "bg-zinc-500/15 text-zinc-400 border-zinc-500/30"
  );
}

// ---------------------------------------------------------------------------
// Price Comparison
// ---------------------------------------------------------------------------

function PriceComparison({
  soldPrice,
  currentPrice,
}: {
  soldPrice: number;
  currentPrice: number;
}) {
  const { formatPrice } = useCurrency();
  const diff = soldPrice - currentPrice;
  const pctDiff = ((diff / currentPrice) * 100).toFixed(1);

  if (Math.abs(diff) < currentPrice * 0.02) {
    // Within 2% - essentially the same
    return (
      <span className="flex items-center gap-1 text-xs text-zinc-500">
        <Minus className="size-3" />
        Similar
      </span>
    );
  }

  if (diff > 0) {
    return (
      <span className="flex items-center gap-1 text-xs text-positive">
        <ArrowUpRight className="size-3" />
        +{formatPrice(diff ?? 0)} ({pctDiff}%)
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs text-destructive">
      <ArrowDownRight className="size-3" />
      {formatPrice(diff ?? 0)} ({pctDiff}%)
    </span>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ComparableSales({
  comparables,
  currentPrice,
  currency = "$",
  className,
}: ComparableSalesProps) {
  const { formatPrice } = useCurrency();
  if (comparables.length === 0) return null;

  // Compute average
  const avgPrice =
    comparables.reduce((sum, c) => sum + c.soldPrice, 0) / comparables.length;

  return (
    <div className={cn("space-y-4", className)}>
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-md bg-zinc-800/50 border border-zinc-700/50 px-4 py-2.5">
        <div>
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Avg. Comparable Sale
          </p>
          <p className="text-lg font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
            {formatPrice(Math.round(avgPrice) ?? 0)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500">
            Comparables Found
          </p>
          <p className="text-lg font-bold text-zinc-200">
            {comparables.length}
          </p>
        </div>
      </div>

      {/* Cards */}
      <div className="space-y-2">
        {comparables.map((comp, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05, duration: 0.2 }}
            className={cn(
              "group rounded-md border border-zinc-800/60 bg-zinc-900/60 p-3",
              "hover:bg-zinc-800/50 hover:border-zinc-700/60 transition-colors"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              {/* Left: Title + meta */}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <Badge
                    className={cn(
                      "text-[10px] font-medium border px-1.5 py-0",
                      getPlatformStyle(comp.platform)
                    )}
                  >
                    {comp.platform}
                  </Badge>
                  {comp.url && (
                    <a
                      href={comp.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-500 hover:text-destructive"
                      title="View listing"
                    >
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>

                <p className="text-sm font-medium text-zinc-200 truncate">
                  {comp.title}
                </p>

                <div className="flex items-center gap-3 mt-1.5 text-xs text-zinc-500">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {comp.soldDate}
                  </span>
                  {comp.mileage !== undefined && (
                    <span className="flex items-center gap-1">
                      <Gauge className="size-3" />
                      {formatMileage(comp.mileage)}
                    </span>
                  )}
                </div>
              </div>

              {/* Right: Price + comparison */}
              <div className="text-right shrink-0">
                <p className="text-sm font-bold text-destructive">
                  {formatPrice(comp.soldPrice ?? 0)}
                </p>
                {currentPrice !== undefined && (
                  <PriceComparison
                    soldPrice={comp.soldPrice}
                    currentPrice={currentPrice}
                  />
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
