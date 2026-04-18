"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Minus,
  Scale,
  Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useCurrency } from "@/lib/CurrencyContext";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CriticalQuestions } from "./CriticalQuestions";
import { RedFlags } from "./RedFlags";
import { OwnershipCosts } from "./OwnershipCosts";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type InvestmentGrade = "EXCELLENT" | "GOOD" | "FAIR" | "SPECULATIVE";
export type MarketTrend = "RISING" | "STABLE" | "DECLINING";

export interface BidTarget {
  low: number;
  high: number;
  currency?: string;
}

export interface InvestmentOutlook {
  grade: InvestmentGrade;
  summary: string;
  appreciationPotential?: string;
  liquidityRating?: string;
}

export interface OwnershipCostsData {
  yearlyMaintenance: number;
  insuranceEstimate: number;
  majorServiceCost: number;
  majorServiceDescription: string;
}

export interface AnalysisData {
  bidTarget: BidTarget;
  criticalQuestions: string[];
  redFlags: string[];
  keyStrengths: string[];
  ownershipCosts: OwnershipCostsData;
  investmentOutlook: InvestmentOutlook;
  confidenceScore?: number;
  marketTrend?: MarketTrend;
}

interface AnalysisReportProps {
  analysis: AnalysisData;
  className?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const GRADE_STYLES: Record<InvestmentGrade, string> = {
  EXCELLENT: "bg-amber-500/20 text-destructive border-amber-500/40",
  GOOD: "bg-positive/20 text-positive border-positive/40",
  FAIR: "bg-blue-500/20 text-blue-400 border-blue-500/40",
  SPECULATIVE: "bg-destructive/20 text-destructive border-destructive/40",
};

const TREND_CONFIG: Record<
  MarketTrend,
  { icon: typeof TrendingUp; label: string; color: string }
> = {
  RISING: {
    icon: TrendingUp,
    label: "Rising Market",
    color: "text-positive",
  },
  STABLE: { icon: Minus, label: "Stable Market", color: "text-blue-400" },
  DECLINING: {
    icon: TrendingDown,
    label: "Declining Market",
    color: "text-destructive",
  },
};

// ---------------------------------------------------------------------------
// Collapsible Section
// ---------------------------------------------------------------------------

function CollapsibleSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  count,
  accentClass,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  defaultOpen?: boolean;
  count?: number;
  accentClass?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="border border-zinc-800 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex w-full items-center justify-between gap-3 px-4 py-3",
          "text-left text-sm font-medium text-zinc-200",
          "hover:bg-zinc-800/60 transition-colors"
        )}
      >
        <span className="flex items-center gap-2">
          <Icon className={cn("size-4", accentClass ?? "text-destructive")} />
          {title}
          {count !== undefined && (
            <Badge
              variant="secondary"
              className="ml-1 bg-zinc-800 text-zinc-400 text-[10px] px-1.5"
            >
              {count}
            </Badge>
          )}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4 text-zinc-500" />
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="content"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Key Strengths sub-component
// ---------------------------------------------------------------------------

function KeyStrengthsList({ strengths }: { strengths: string[] }) {
  return (
    <ul className="space-y-2">
      {strengths.map((s, i) => (
        <li key={i} className="flex items-start gap-2 text-sm text-zinc-300">
          <Shield className="size-4 mt-0.5 shrink-0 text-positive" />
          <span>{s}</span>
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Investment Outlook sub-component
// ---------------------------------------------------------------------------

function InvestmentOutlookSection({
  outlook,
}: {
  outlook: InvestmentOutlook;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-zinc-300 leading-relaxed">
        {outlook.summary}
      </p>

      <div className="grid grid-cols-2 gap-3">
        {outlook.appreciationPotential && (
          <div className="rounded-md bg-zinc-800/50 border border-zinc-700/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              Appreciation
            </p>
            <p className="text-sm font-medium text-zinc-200">
              {outlook.appreciationPotential}
            </p>
          </div>
        )}
        {outlook.liquidityRating && (
          <div className="rounded-md bg-zinc-800/50 border border-zinc-700/50 p-3">
            <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">
              Liquidity
            </p>
            <p className="text-sm font-medium text-zinc-200">
              {outlook.liquidityRating}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function AnalysisReport({ analysis, className }: AnalysisReportProps) {
  const { formatPrice } = useCurrency();
  const {
    bidTarget,
    criticalQuestions,
    redFlags,
    keyStrengths,
    ownershipCosts,
    investmentOutlook,
    confidenceScore,
    marketTrend,
  } = analysis;

  const trend = marketTrend ? TREND_CONFIG[marketTrend] : null;
  const TrendIcon = trend?.icon;

  return (
    <Card
      className={cn(
        "bg-zinc-950 border-zinc-800 text-zinc-100 shadow-2xl shadow-black/40",
        className
      )}
    >
      {/* Header */}
      <CardHeader className="pb-0">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Brain className="size-5 text-destructive" />
            <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent font-bold">
              AI Analysis
            </span>
          </CardTitle>

          {confidenceScore !== undefined && (
            <Badge
              variant="outline"
              className={cn(
                "border-amber-500/40 text-destructive tabular-nums text-xs",
                confidenceScore >= 80 &&
                  "border-positive/40 text-positive",
                confidenceScore < 50 && "border-destructive/40 text-destructive"
              )}
            >
              {confidenceScore}% confidence
            </Badge>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Bid Target */}
        <div className="rounded-lg bg-gradient-to-br from-amber-500/10 via-zinc-900 to-zinc-900 border border-amber-500/20 p-5">
          <p className="text-[11px] uppercase tracking-widest text-destructive/80 mb-2 font-medium">
            Recommended Bid Range
          </p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              {formatPrice(bidTarget.low ?? 0)}
            </span>
            <span className="text-zinc-500 text-lg">&ndash;</span>
            <span className="text-3xl font-bold bg-gradient-to-r from-amber-300 to-amber-500 bg-clip-text text-transparent">
              {formatPrice(bidTarget.high ?? 0)}
            </span>
          </div>

          {/* Grade + Trend row */}
          <div className="flex items-center gap-3 mt-4">
            <Badge
              className={cn(
                "text-xs font-semibold border px-2.5 py-0.5",
                GRADE_STYLES[investmentOutlook.grade]
              )}
            >
              {investmentOutlook.grade}
            </Badge>

            {trend && TrendIcon && (
              <span
                className={cn(
                  "flex items-center gap-1 text-xs font-medium",
                  trend.color
                )}
              >
                <TrendIcon className="size-3.5" />
                {trend.label}
              </span>
            )}
          </div>
        </div>

        <Separator className="bg-zinc-800" />

        {/* Collapsible Sections */}
        <div className="space-y-3">
          {criticalQuestions.length > 0 && (
            <CollapsibleSection
              title="Critical Questions to Ask"
              icon={Scale}
              defaultOpen
              count={criticalQuestions.length}
              accentClass="text-destructive"
            >
              <CriticalQuestions questions={criticalQuestions} />
            </CollapsibleSection>
          )}

          {redFlags.length > 0 && (
            <CollapsibleSection
              title="Red Flags"
              icon={({ className: c }) => (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className={c}
                >
                  <path d="m21.73 18-8-14a2 2 0 0 0-3.46 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
                  <path d="M12 9v4" />
                  <path d="M12 17h.01" />
                </svg>
              )}
              defaultOpen={redFlags.length > 0}
              count={redFlags.length}
              accentClass="text-destructive"
            >
              <RedFlags redFlags={redFlags} />
            </CollapsibleSection>
          )}

          {keyStrengths.length > 0 && (
            <CollapsibleSection
              title="Key Strengths"
              icon={Shield}
              count={keyStrengths.length}
              accentClass="text-positive"
            >
              <KeyStrengthsList strengths={keyStrengths} />
            </CollapsibleSection>
          )}

          <CollapsibleSection
            title="Ownership Costs"
            icon={({ className: c }) => (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className={c}
              >
                <line x1="12" x2="12" y1="2" y2="22" />
                <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
              </svg>
            )}
            accentClass="text-destructive"
          >
            <OwnershipCosts {...ownershipCosts} />
          </CollapsibleSection>

          <CollapsibleSection
            title="Investment Outlook"
            icon={TrendingUp}
            accentClass="text-destructive"
          >
            <InvestmentOutlookSection outlook={investmentOutlook} />
          </CollapsibleSection>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center pt-2">
          <Badge
            variant="outline"
            className="border-zinc-700 text-zinc-500 text-[10px] gap-1.5 font-normal"
          >
            <Scale className="size-3 text-destructive" />
            Powered by Claude AI
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}
