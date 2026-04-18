"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { Link } from "@/i18n/navigation";
import { Clock, Gavel } from "lucide-react";
import { useCurrency } from "@/lib/CurrencyContext";
import { useLocale } from "next-intl";
import { timeLeft } from "@/lib/makePageHelpers";
import type { DashboardAuction } from "@/lib/dashboardCache";

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

function isLiveStatus(status: string): boolean {
  return status === "ACTIVE" || status === "ENDING_SOON";
}

export function parseEndTimeMs(value: string): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

function formatTransmission(raw: string | null): string | null {
  if (!raw) return null;
  const low = raw.toLowerCase();
  if (low.includes("pdk")) return "PDK";
  if (low.includes("manual") || low.includes("m/t")) return "Manual";
  if (low.includes("tiptronic") || low.includes("automatic") || low.includes("auto")) return "Auto";
  return null;
}

function regionCode(region: string | null | undefined): string | null {
  if (!region) return null;
  return region;
}

export function BrowseCard({ car, index }: { car: DashboardAuction; index: number }) {
  const locale = useLocale();
  const { formatPrice } = useCurrency();
  const live = isLiveStatus(car.status);
  const platformLabel = PLATFORM_SHORT[car.platform] || car.platform;
  const image = car.images?.[0] || "/cars/placeholder.svg";
  const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-");
  const trans = formatTransmission(car.transmission);
  const region = regionCode(car.region);
  const grade = car.analysis?.investmentGrade ?? null;
  const fairUs = car.fairValueByRegion?.US;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.015, 0.2) }}
      layout
    >
      <Link
        href={`/cars/${makeSlug}/${car.id}`}
        className="group block rounded-xl bg-card border border-border overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-300"
      >
        <div className="relative aspect-[16/10] overflow-hidden bg-muted">
          <Image
            src={image}
            alt={car.title}
            fill
            className="object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, (max-width: 1280px) 33vw, 20vw"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/45 via-transparent to-transparent" />

          {live && (
            <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5 rounded-full bg-background/85 backdrop-blur-md px-2 py-0.5">
              <span className="size-1.5 rounded-full bg-positive animate-pulse" />
              <span className="text-[9px] font-medium text-positive tracking-wide">LIVE</span>
            </div>
          )}

          <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
            {grade && (
              <span className="rounded-full px-2 py-0.5 text-[9px] font-semibold bg-primary/15 text-primary border border-primary/25 backdrop-blur-md">
                {grade}
              </span>
            )}
            <span className="rounded-full px-2 py-0.5 text-[9px] font-medium bg-background/85 text-foreground/80 border border-border backdrop-blur-md">
              {platformLabel}
            </span>
          </div>
        </div>

        <div className="p-3">
          <h3 className="text-[13px] font-display font-normal text-foreground group-hover:text-primary transition-colors line-clamp-1">
            {car.title}
          </h3>

          <div className="mt-2 flex items-baseline justify-between gap-2">
            <div className="min-w-0">
              <p className="text-[9px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
                Price
              </p>
              <p className="text-[16px] font-display font-medium text-primary tabular-nums leading-tight">
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

          {fairUs && (
            <p className="mt-1.5 text-[10px] text-muted-foreground/80">
              Fair value {formatPrice(fairUs.low)}–{formatPrice(fairUs.high)}
            </p>
          )}

          <div className="mt-2.5 pt-2 border-t border-border flex items-center justify-between text-[10px] text-muted-foreground">
            <div className="flex items-center gap-2.5 min-w-0">
              {live && parseEndTimeMs(car.endTime) !== null && (
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
              <span className="flex items-center gap-1 shrink-0">
                <Gavel className="size-3" />
                {car.bidCount}
              </span>
              {trans && (
                <span className="shrink-0 font-medium text-foreground/70">{trans}</span>
              )}
            </div>
            {region && (
              <span className="font-medium text-muted-foreground tracking-wider">
                {region}
              </span>
            )}
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
