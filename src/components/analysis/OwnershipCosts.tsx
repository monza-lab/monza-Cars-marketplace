"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
import { Wrench, ShieldCheck, Settings, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/CurrencyContext";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface OwnershipCostsProps {
  yearlyMaintenance: number;
  insuranceEstimate: number;
  majorServiceCost: number;
  majorServiceDescription: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface CostItem {
  label: string;
  amount: number;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  barColor: string;
}

// ---------------------------------------------------------------------------
// Cost Bar
// ---------------------------------------------------------------------------

function CostBar({
  item,
  maxAmount,
  index,
}: {
  item: CostItem;
  maxAmount: number;
  index: number;
}) {
  const { formatPrice } = useCurrency();
  const widthPct = maxAmount > 0 ? (item.amount / maxAmount) * 100 : 0;
  const Icon = item.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.08, duration: 0.25 }}
      className="space-y-1.5"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-2 text-sm text-zinc-300">
          <Icon className={cn("size-4", item.color)} />
          {item.label}
        </span>
        <span className="text-sm font-semibold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
          {formatPrice(item.amount ?? 0)}
        </span>
      </div>

      {/* Bar */}
      <div className="h-2 w-full rounded-full bg-zinc-800/80 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${widthPct}%` }}
          transition={{ delay: index * 0.08 + 0.15, duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
          className={cn("h-full rounded-full", item.barColor)}
        />
      </div>
    </motion.div>
  );
}

// ---------------------------------------------------------------------------
// 5-Year Projection
// ---------------------------------------------------------------------------

function FiveYearProjection({
  annualTotal,
  majorServiceCost,
}: {
  annualTotal: number;
  majorServiceCost: number;
}) {
  const { formatPrice } = useCurrency();
  const years = [1, 2, 3, 4, 5];
  // Assume major service hits in year 3
  const projections = years.map((y) => {
    const base = annualTotal * y;
    const withMajor = y >= 3 ? base + majorServiceCost : base;
    return { year: y, cost: withMajor };
  });

  const maxCost = projections[projections.length - 1].cost;

  return (
    <div className="space-y-3">
      <p className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
        5-Year Ownership Projection
      </p>

      <div className="flex items-end gap-2 h-28">
        {projections.map((p, i) => {
          const heightPct = maxCost > 0 ? (p.cost / maxCost) * 100 : 0;
          const hasMajorService = p.year >= 3;

          return (
            <div key={p.year} className="flex-1 flex flex-col items-center gap-1">
              {/* Amount label */}
              <span className="text-[10px] font-medium text-zinc-400 tabular-nums">
                {formatPrice(p.cost ?? 0)}
              </span>

              {/* Bar */}
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${heightPct}%` }}
                transition={{
                  delay: 0.3 + i * 0.08,
                  duration: 0.4,
                  ease: [0.4, 0, 0.2, 1],
                }}
                className={cn(
                  "w-full rounded-t-sm min-h-[4px]",
                  hasMajorService
                    ? "bg-gradient-to-t from-amber-600 to-amber-400"
                    : "bg-gradient-to-t from-amber-700/80 to-amber-500/80"
                )}
              />

              {/* Year label */}
              <span className="text-[10px] text-zinc-500 font-medium">
                Y{p.year}
              </span>
            </div>
          );
        })}
      </div>

      <p className="text-[10px] text-zinc-600 text-center">
        * Major service estimated in Year 3
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OwnershipCosts({
  yearlyMaintenance,
  insuranceEstimate,
  majorServiceCost,
  majorServiceDescription,
  className,
}: OwnershipCostsProps) {
  const { formatPrice } = useCurrency();
  const costItems: CostItem[] = useMemo(
    () => [
      {
        label: "Annual Maintenance",
        amount: yearlyMaintenance,
        icon: Wrench,
        color: "text-destructive",
        barColor: "bg-gradient-to-r from-amber-600 to-amber-400",
      },
      {
        label: "Insurance (est.)",
        amount: insuranceEstimate,
        icon: ShieldCheck,
        color: "text-blue-400",
        barColor: "bg-gradient-to-r from-blue-600 to-blue-400",
      },
      {
        label: "Major Service",
        amount: majorServiceCost,
        icon: Settings,
        color: "text-destructive",
        barColor: "bg-gradient-to-r from-orange-600 to-orange-400",
      },
    ],
    [yearlyMaintenance, insuranceEstimate, majorServiceCost]
  );

  const maxAmount = Math.max(...costItems.map((c) => c.amount));
  const annualTotal = yearlyMaintenance + insuranceEstimate;

  return (
    <div className={cn("space-y-5", className)}>
      {/* Cost breakdown bars */}
      <div className="space-y-4">
        {costItems.map((item, i) => (
          <CostBar key={item.label} item={item} maxAmount={maxAmount} index={i} />
        ))}
      </div>

      {/* Major service description */}
      {majorServiceDescription && (
        <div className="rounded-md bg-zinc-800/40 border border-zinc-700/40 p-3">
          <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
            Major Service Details
          </p>
          <p className="text-xs text-zinc-400 leading-relaxed">
            {majorServiceDescription}
          </p>
        </div>
      )}

      {/* Annual total */}
      <div className="flex items-center justify-between rounded-md bg-amber-500/8 border border-amber-500/20 p-3">
        <span className="flex items-center gap-2 text-sm font-medium text-zinc-200">
          <DollarSign className="size-4 text-destructive" />
          Total Annual Cost
        </span>
        <span className="text-lg font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
          {formatPrice(annualTotal ?? 0)}
        </span>
      </div>

      {/* 5-year projection chart */}
      <FiveYearProjection
        annualTotal={annualTotal}
        majorServiceCost={majorServiceCost}
      />
    </div>
  );
}
