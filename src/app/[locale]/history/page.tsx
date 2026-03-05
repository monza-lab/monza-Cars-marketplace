import type { Metadata } from "next";
import { TrendingUp, BarChart3, Calendar } from "lucide-react";
import { dbQuery } from "@/lib/db/sql";
import { MarketTrendsClient } from "./MarketTrendsClient";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "pages" });

  return {
    title: t("history.meta.title"),
    description: t("history.meta.description"),
  };
}

export default async function HistoryPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "history" });

  let stats = { totalAuctions: 0, makesCovered: 0, platformsActive: 0, dataPoints: 0 };
  let trends: { make: string; model: string; avgPrice: number | null; totalSales: number; trend: string | null; }[] = [];

  try {
    const [totalAuctions, makes, platforms, dataPoints, marketData] = await Promise.all([
      dbQuery<{ total: string }>('SELECT COUNT(*)::bigint AS total FROM "Auction" WHERE status IN (\'ENDED\', \'SOLD\')'),
      dbQuery<{ make: string }>('SELECT DISTINCT make FROM "Auction"'),
      dbQuery<{ platform: string }>('SELECT DISTINCT platform FROM "Auction"'),
      dbQuery<{ total: string }>('SELECT COUNT(*)::bigint AS total FROM "PriceHistory"'),
      dbQuery<{ make: string; model: string; avgPrice: number | null; totalSales: number; trend: string | null }>('SELECT make, model, "avgPrice", "totalSales", trend FROM "MarketData" ORDER BY "totalSales" DESC LIMIT 6'),
    ]);
    stats = {
      totalAuctions: Number(totalAuctions.rows[0]?.total ?? 0),
      makesCovered: makes.rows.length,
      platformsActive: platforms.rows.length,
      dataPoints: Number(dataPoints.rows[0]?.total ?? 0),
    };
    trends = marketData.rows.map((m) => ({ make: m.make, model: m.model, avgPrice: m.avgPrice, totalSales: m.totalSales, trend: m.trend }));
  } catch {}

  return (
    <div className="min-h-screen">
      <section className="relative border-b border-primary/6 bg-background pt-28">
        <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(60% 40% at 50% 0%, rgba(var(--glow-color), 0.08) 0%, transparent 60%)" }} />
        <div className="relative mx-auto max-w-7xl px-4 pb-10 sm:px-6 lg:px-8">
          <div className="flex items-center gap-2 text-primary">
            <TrendingUp className="size-4" />
            <span className="text-[11px] font-medium tracking-[0.2em] uppercase">{t("kicker")}</span>
          </div>
          <h1 className="mt-4 text-3xl font-light tracking-tight text-foreground sm:text-4xl">
            {t("title1")} <span className="font-semibold text-gradient">{t("title2")}</span>
          </h1>
          <p className="mt-3 max-w-2xl text-sm text-[rgba(232,226,222,0.45)] font-light">
            {t("subtitle")}
          </p>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[
              { id: "auctionsTracked", value: stats.totalAuctions.toLocaleString(), icon: BarChart3 },
              { id: "makesCovered", value: stats.makesCovered.toString(), icon: Calendar },
              { id: "platforms", value: stats.platformsActive.toString(), icon: TrendingUp },
              { id: "dataPoints", value: stats.dataPoints.toLocaleString(), icon: BarChart3 },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <div key={stat.id} className="rounded-2xl border border-primary/8 bg-card px-4 py-3">
                  <div className="flex items-center gap-2">
                    <Icon className="size-3 text-primary" />
                    <span className="text-[10px] font-medium tracking-[0.2em] uppercase text-[rgba(232,226,222,0.35)]">{t(`stats.${stat.id}`)}</span>
                  </div>
                  <p className="mt-1.5 text-xl font-light text-foreground">{stat.value}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <MarketTrendsClient initialTrends={trends} />
    </div>
  );
}
