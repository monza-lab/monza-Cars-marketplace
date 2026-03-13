"use client";

import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Minus, Activity } from "lucide-react";

type TickerItem = {
  id: string;
  model: string;
  make: string;
  price: number;
  trend: "up" | "neutral" | "hot";
  platform: string;
};

// Sample ticker data - in production this would come from props or API
const tickerData: TickerItem[] = [
  { id: "1", make: "MCLAREN", model: "F1", price: 18_500_000, trend: "hot", platform: "BaT" },
  { id: "2", make: "FERRARI", model: "275 GTB", price: 2_800_000, trend: "up", platform: "BaT" },
  { id: "3", make: "LAMBORGHINI", model: "MIURA SV", price: 2_100_000, trend: "up", platform: "BaT" },
  { id: "4", make: "PORSCHE", model: "959", price: 1_650_000, trend: "up", platform: "C&B" },
  { id: "5", make: "MERCEDES", model: "300SL", price: 1_450_000, trend: "neutral", platform: "C&B" },
  { id: "6", make: "PORSCHE", model: "911 RS", price: 1_250_000, trend: "neutral", platform: "BaT" },
  { id: "7", make: "ASTON MARTIN", model: "DB5", price: 780_000, trend: "up", platform: "CC" },
  { id: "8", make: "NISSAN", model: "R34 GT-R", price: 385_000, trend: "hot", platform: "BaT" },
  { id: "9", make: "JAGUAR", model: "E-TYPE", price: 185_000, trend: "neutral", platform: "CC" },
  { id: "10", make: "TOYOTA", model: "SUPRA MK4", price: 145_000, trend: "up", platform: "BaT" },
  { id: "11", make: "BMW", model: "M3 E30", price: 92_000, trend: "up", platform: "BaT" },
  { id: "12", make: "FORD", model: "GT40", price: 4_500_000, trend: "hot", platform: "C&B" },
];

function formatPrice(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toLocaleString()}`;
}

function TrendIndicator({ trend }: { trend: "up" | "neutral" | "hot" }) {
  if (trend === "hot") {
    return (
      <span className="inline-flex items-center gap-0.5 text-emerald-400">
        <Activity className="size-3 animate-pulse" />
        <span className="text-[10px] font-bold">LIVE</span>
      </span>
    );
  }
  if (trend === "up") {
    return <TrendingUp className="size-3 text-emerald-400" />;
  }
  return <Minus className="size-3 text-[rgba(232,226,222,0.3)]" />;
}

interface LiveTickerProps {
  onItemClick?: (item: TickerItem) => void;
}

export function LiveTicker({ onItemClick }: LiveTickerProps) {
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  // Duplicate items for seamless loop
  const items = [...tickerData, ...tickerData];

  const handleItemClick = (item: TickerItem) => {
    if (onItemClick) {
      onItemClick(item);
    }
  };

  return (
    <motion.div
      initial={{ y: 100, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 0.5, duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
      className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-5xl"
    >
      <div
        ref={containerRef}
        onMouseEnter={() => setIsPaused(true)}
        onMouseLeave={() => setIsPaused(false)}
        className="relative h-11 rounded-full bg-background/85 backdrop-blur-xl border border-primary/8 shadow-2xl shadow-black/40 overflow-hidden flex items-center"
      >
        {/* Left fade gradient */}
        <div className="absolute left-0 top-0 bottom-0 w-16 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />

        {/* Right fade gradient */}
        <div className="absolute right-0 top-0 bottom-0 w-16 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

        {/* Live indicator pill */}
        <div className="absolute left-3 z-20 flex items-center gap-1.5 rounded-full bg-primary/10 border border-primary/15 px-2.5 py-1">
          <span className="relative flex size-1.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex size-1.5 rounded-full bg-emerald-400" />
          </span>
          <span className="text-[9px] font-semibold tracking-[0.15em] uppercase text-[rgba(232,226,222,0.6)]">
            Live
          </span>
        </div>

        {/* Scrolling content */}
        <div className="flex-1 overflow-hidden ml-20">
          <div
            className={`flex items-center gap-0 whitespace-nowrap ${
              isPaused ? "[animation-play-state:paused]" : ""
            }`}
            style={{
              animation: "ticker-scroll 60s linear infinite",
            }}
          >
            {items.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                onClick={() => handleItemClick(item)}
                className="inline-flex items-center gap-3 px-4 py-1 rounded-lg hover:bg-primary/6 transition-colors group"
              >
                {/* Make + Model */}
                <span className="text-[11px] font-medium tracking-[0.1em] uppercase text-[rgba(232,226,222,0.5)] group-hover:text-[rgba(232,226,222,0.8)] transition-colors">
                  {item.make}{" "}
                  <span className="text-foreground/70 group-hover:text-foreground">
                    {item.model}
                  </span>
                </span>

                {/* Trend */}
                <TrendIndicator trend={item.trend} />

                {/* Price */}
                <span className="text-[12px] font-mono font-medium tabular-nums text-foreground group-hover:text-primary transition-colors">
                  {formatPrice(item.price)}
                </span>

                {/* Separator */}
                <span className="text-[rgba(232,226,222,0.15)] mx-2">/</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* CSS for the marquee animation */}
      <style jsx>{`
        @keyframes ticker-scroll {
          0% {
            transform: translateX(0);
          }
          100% {
            transform: translateX(-50%);
          }
        }
      `}</style>
    </motion.div>
  );
}
