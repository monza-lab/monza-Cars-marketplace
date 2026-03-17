"use client";

import { useMemo } from "react";
import { format } from "date-fns";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/CurrencyContext";
import type { PriceHistoryEntry } from "@/types/auction";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ComparablePrice {
  label: string;
  price: number;
  color?: string;
}

interface PriceChartProps {
  priceHistory: PriceHistoryEntry[];
  comparables?: ComparablePrice[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatTime(iso: string): string {
  try {
    return format(new Date(iso), "MMM d, h:mm a");
  } catch {
    return iso;
  }
}

// ---------------------------------------------------------------------------
// Custom tooltip
// ---------------------------------------------------------------------------

interface TooltipPayloadEntry {
  value: number;
  payload: { bid: number; timestamp: string; formattedTime: string };
}

function CustomTooltip({
  active,
  payload,
  formatPrice,
}: {
  active?: boolean;
  payload?: TooltipPayloadEntry[];
  label?: string;
  formatPrice: (amount: number) => string;
}) {
  if (!active || !payload?.length) return null;

  const entry = payload[0];
  return (
    <div className="rounded-lg border border-zinc-700/60 bg-zinc-900/95 px-3 py-2 shadow-xl shadow-black/40 backdrop-blur-sm">
      <p className="text-sm font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
        {formatPrice(entry.value ?? 0)}
      </p>
      <p className="mt-0.5 text-[11px] text-zinc-400">
        {entry.payload.formattedTime}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function PriceChart({
  priceHistory,
  comparables,
  className,
}: PriceChartProps) {
  const { formatPrice } = useCurrency();

  const formatAxisTick = (value: number): string => formatPrice(value ?? 0);

  // Prepare data sorted ascending by time
  const data = useMemo(() => {
    return [...priceHistory]
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )
      .map((entry) => ({
        ...entry,
        formattedTime: formatTime(entry.timestamp),
        ts: new Date(entry.timestamp).getTime(),
      }));
  }, [priceHistory]);

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-zinc-800/60 bg-zinc-900/30 py-16",
          className
        )}
      >
        <p className="text-sm text-zinc-500">No bid data available</p>
      </div>
    );
  }

  // Unique amber gradient id to avoid collisions if multiple charts render
  const gradientId = "auctionPriceGradient";

  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.35} />
              <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.1} />
              <stop offset="100%" stopColor="#f59e0b" stopOpacity={0} />
            </linearGradient>
          </defs>

          <CartesianGrid
            strokeDasharray="3 3"
            stroke="#27272a"
            vertical={false}
          />

          <XAxis
            dataKey="formattedTime"
            tick={{ fill: "#71717a", fontSize: 10 }}
            tickLine={false}
            axisLine={{ stroke: "#3f3f46" }}
            minTickGap={40}
          />

          <YAxis
            tickFormatter={formatAxisTick}
            tick={{ fill: "#71717a", fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            width={60}
          />

          <Tooltip content={<CustomTooltip formatPrice={formatPrice} />} />

          {/* Comparable reference lines */}
          {comparables?.map((comp) => (
            <ReferenceLine
              key={comp.label}
              y={comp.price}
              stroke={comp.color ?? "#a78bfa"}
              strokeDasharray="6 4"
              strokeWidth={1.5}
              label={{
                value: `${comp.label} ${formatPrice(comp.price ?? 0)}`,
                fill: comp.color ?? "#a78bfa",
                fontSize: 10,
                position: "right",
              }}
            />
          ))}

          <Area
            type="stepAfter"
            dataKey="bid"
            stroke="#f59e0b"
            strokeWidth={2}
            fill={`url(#${gradientId})`}
            dot={{
              r: 3,
              fill: "#f59e0b",
              stroke: "#18181b",
              strokeWidth: 2,
            }}
            activeDot={{
              r: 5,
              fill: "#fbbf24",
              stroke: "#18181b",
              strokeWidth: 2,
            }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
