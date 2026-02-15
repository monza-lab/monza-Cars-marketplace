"use client";

import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

type Trend = {
  make: string;
  model: string;
  avgPrice: number | null;
  totalSales: number;
  trend: string | null;
};

function formatPrice(n: number | null, locale: string, naLabel: string): string {
  if (n === null) return naLabel;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
}

function TrendIcon({ trend }: { trend: string | null }) {
  if (!trend) return <Minus className="size-4 text-[#6B7280]" />;
  if (trend.includes("+") || trend.toLowerCase().includes("up")) {
    return <TrendingUp className="size-4 text-positive" />;
  }
  if (trend.includes("-") || trend.toLowerCase().includes("down")) {
    return <TrendingDown className="size-4 text-negative" />;
  }
  return <Minus className="size-4 text-[#6B7280]" />;
}

export function MarketTrendsClient({ initialTrends }: { initialTrends: Trend[] }) {
  const locale = useLocale();
  const t = useTranslations("history");

  if (initialTrends.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.4)] p-8 text-center">
          <p className="text-[#9CA3AF]">{t("empty.title")}</p>
          <p className="mt-2 text-sm text-[#6B7280]">{t("empty.subtitle")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 className="text-lg font-semibold text-[#FFFCF7] mb-6">{t("topPerformers")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialTrends.map((trend, i) => (
          <div
            key={`${trend.make}-${trend.model}-${i}`}
            className="rounded-2xl border border-[rgba(248,180,217,0.08)] bg-[rgba(15,14,22,0.4)] p-5 hover:border-[rgba(248,180,217,0.15)] transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-[#FFFCF7]">
                  {trend.make} {trend.model}
                </h3>
                <p className="text-[12px] text-[#6B7280] mt-1">
                  {t("salesRecorded", { count: trend.totalSales })}
                </p>
              </div>
              <TrendIcon trend={trend.trend} />
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-xl font-bold font-mono text-[#F8B4D9]">
                {formatPrice(trend.avgPrice, locale, t("na"))}
              </span>
              {trend.trend && (
                <span className={`text-[12px] font-medium ${
                  trend.trend.includes("+") ? "text-positive" :
                  trend.trend.includes("-") ? "text-negative" : "text-[#9CA3AF]"
                }`}>
                  {trend.trend}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
