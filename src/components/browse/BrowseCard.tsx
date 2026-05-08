"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useRouter } from "@/i18n/navigation";
import { Clock, Gavel, ExternalLink } from "lucide-react";
import { useCurrency } from "@/lib/CurrencyContext";
import { useLocale } from "next-intl";
import { timeLeft } from "@/lib/makePageHelpers";
import type { DashboardAuction } from "@/lib/dashboardCache";
import { MarketDeltaPill } from "@/components/report/MarketDeltaPill";

const PLATFORM_SHORT: Record<string, string> = {
  BRING_A_TRAILER: "BaT",
  CARS_AND_BIDS: "C&B",
  COLLECTING_CARS: "CC",
  AUTO_SCOUT_24: "AS24",
  AUTO_TRADER: "AT",
  BE_FORWARD: "BF",
  CLASSIC_COM: "Cls",
  ELFERSPOT: "ES",
  RM_SOTHEBYS: "RM",
  BONHAMS: "BON",
  GOODING: "G&C",
};

export function parseEndTimeMs(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTransmission(raw: string | null): string | null {
  if (!raw || raw === "—") return null;
  const low = raw.toLowerCase();
  // Mirror applyFilters.normalizeTransmission — PDK first, auto before manual.
  if (low.includes("pdk") || low.includes("dual-clutch") || low.includes("dual clutch")) {
    return "PDK";
  }
  if (
    low.includes("automated") ||
    low.includes("automatic") ||
    low.includes("tiptronic") ||
    low.includes("semi-auto") ||
    low === "a/t" ||
    low === "auto"
  ) {
    return "Auto";
  }
  if (low.includes("manual") || low.includes("m/t") || low === "mt" || low.includes("-speed")) {
    return "Manual";
  }
  return null;
}

/**
 * The region label shown on a card MUST match the field the region filter
 * uses (canonicalMarket — normalized US/EU/UK/JP). The raw `region` column
 * is the physical car location and would mismatch the filter (e.g. a BaT
 * listing of a German car has canonicalMarket="US" but region="EU").
 */
function regionCode(car: DashboardAuction): string | null {
  return car.canonicalMarket ?? null;
}

export function BrowseCard({
  car,
  index,
  sourceUrl,
}: {
  car: DashboardAuction;
  index: number;
  sourceUrl?: string | null;
}) {
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const platformLabel = PLATFORM_SHORT[car.platform] || car.platform;
  const image = car.images?.[0] || "/cars/placeholder.svg";
  const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-");
  const trans = formatTransmission(car.transmission);
  const region = regionCode(car);
  const fairUs = car.fairValueByRegion?.US;
  // Honest-by-data: countdown only renders for active auctions (future
  // endTime + at least one bid). 4 of 5 marketplace scrapers hardcode
  // bidCount=0, so this combo only fires for real auctions.
  const endMs = parseEndTimeMs(car.endTime);
  // eslint-disable-next-line react-hooks/purity -- Date.now() is the only honest signal; React Compiler is not enabled.
  const showCountdown = car.bidCount > 0 && endMs !== null && endMs > Date.now();

  const router = useRouter();
  const reportHref = `/cars/${makeSlug}/${car.id}/report`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.2) }}
      layout
    >
      {/* Card is a div, not an anchor, so we can render the "View on
          {platform}" anchor inside without nesting <a> in <a> (which
          triggers a hydration warning and is invalid HTML). The whole
          card stays clickable via onClick + keyboard via onKeyDown. */}
      <div
        role="link"
        tabIndex={0}
        aria-label={`View MonzaHaus report — ${car.title}`}
        onClick={() => router.push(reportHref)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            router.push(reportHref);
          }
        }}
        className="group block rounded-xl bg-card border border-border overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-300 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        <div className="relative aspect-[4/3] sm:aspect-[16/10] overflow-hidden bg-muted">
          <Image
            src={image}
            alt={car.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            <MarketDeltaPill priceUsd={car.currentBid} medianUsd={null} />
            <span className="rounded-full px-2 py-0.5 text-[9px] font-medium bg-background/85 text-foreground/80 border border-border backdrop-blur-md">
              {platformLabel}
            </span>
          </div>
        </div>

        <div className="p-3 sm:p-3">
          <h3 className="text-[14px] sm:text-[13px] font-display font-normal text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {car.title}
          </h3>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                Price
              </p>
              <p className="text-[18px] sm:text-[16px] font-display font-medium text-primary tabular-nums leading-tight">
                {formatPrice(car.currentBid)}
              </p>
            </div>
            {car.mileage !== null && (
              <div className="text-right shrink-0">
                <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                  Mileage
                </p>
                <p className="text-[12px] font-medium text-muted-foreground tabular-nums leading-tight">
                  {car.mileage.toLocaleString(locale)} {car.mileageUnit || "mi"}
                </p>
              </div>
            )}
          </div>

          {fairUs && fairUs.low > 0 && fairUs.high > 0 && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/80">
              Fair value {formatPrice(fairUs.low)}–{formatPrice(fairUs.high)}
            </p>
          )}

          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              {showCountdown && (
                <span className="flex items-center gap-1 shrink-0">
                  <Clock className="size-3" />
                  {timeLeft(new Date(car.endTime), {
                    ended: "Ended",
                    day: "d",
                    hour: "h",
                    minute: "m",
                  })}
                </span>
              )}
              {car.bidCount > 0 && (
                <span className="flex items-center gap-1 shrink-0">
                  <Gavel className="size-3" />
                  {car.bidCount}
                </span>
              )}
              {trans && (
                <span className="shrink-0 font-medium text-foreground/70">{trans}</span>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {region && (
                <span className="font-medium text-muted-foreground tracking-wider">
                  {region}
                </span>
              )}
              {sourceUrl && (
                <a
                  href={sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-medium text-foreground/80 hover:border-primary/40 hover:text-primary transition-colors"
                  title={`View original listing on ${platformLabel}`}
                >
                  View on {platformLabel}
                  <ExternalLink className="size-2.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
