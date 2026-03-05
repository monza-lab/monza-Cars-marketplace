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
  if (!trend) return <Minus className="size-4 text-muted-foreground" />;
  if (trend.includes("+") || trend.toLowerCase().includes("up")) {
    return <TrendingUp className="size-4 text-positive" />;
  }
  if (trend.includes("-") || trend.toLowerCase().includes("down")) {
    return <TrendingDown className="size-4 text-negative" />;
  }
  return <Minus className="size-4 text-muted-foreground" />;
}

export function MarketTrendsClient({ initialTrends }: { initialTrends: Trend[] }) {
  const locale = useLocale();
  const t = useTranslations("history");

  if (initialTrends.length === 0) {
    return (
      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="rounded-2xl border border-primary/8 bg-card p-8 text-center">
          <p className="text-muted-foreground">{t("empty.title")}</p>
          <p className="mt-2 text-sm text-muted-foreground">{t("empty.subtitle")}</p>
        </div>
      </section>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      <h2 className="text-lg font-semibold text-foreground mb-6">{t("topPerformers")}</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {initialTrends.map((trend, i) => (
          <div
            key={`${trend.make}-${trend.model}-${i}`}
            className="rounded-2xl border border-primary/8 bg-card p-5 hover:border-primary/15 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-[15px] font-semibold text-foreground">
                  {trend.make} {trend.model}
                </h3>
                <p className="text-[12px] text-muted-foreground mt-1">
                  {t("salesRecorded", { count: trend.totalSales })}
                </p>
              </div>
              <TrendIcon trend={trend.trend} />
            </div>
            <div className="mt-4 flex items-baseline justify-between">
              <span className="text-xl font-display font-medium text-primary">
                {formatPrice(trend.avgPrice, locale, t("na"))}
              </span>
              {trend.trend && (
                <span className={`text-[12px] font-medium ${
                  trend.trend.includes("+") ? "text-positive" :
                  trend.trend.includes("-") ? "text-negative" : "text-muted-foreground"
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
