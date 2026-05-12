"use client";

import { useTranslations } from "next-intl";
import { Globe, Check } from "lucide-react";
import { useRegion } from "@/lib/RegionContext";
import type { Region } from "@/lib/curatedCars";

const REGION_FLAGS: Record<Region, string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  UK: "🇬🇧",
  JP: "🇯🇵",
};

const REGIONS: Region[] = ["US", "EU", "UK", "JP"];

export function ReportRegionBanner() {
  const t = useTranslations("investmentReport.regionContext");
  const { selectedRegion, setSelectedRegion, effectiveRegion, isHydrated, hasUserChosen } =
    useRegion();

  // Pre-hydration: render a static placeholder matching the chosen branch to
  // avoid a layout flicker; we don't know which branch yet, so reserve space.
  if (!isHydrated) {
    return <div aria-hidden className="h-[88px] rounded-2xl border border-border/40 bg-card/40" />;
  }

  if (hasUserChosen) {
    const flag = REGION_FLAGS[effectiveRegion];
    const regionName = t(`regionLabel.${effectiveRegion}`);
    return (
      <div className="rounded-2xl border border-primary/25 bg-primary/[0.06] p-4 md:p-5 flex items-start gap-4">
        <div className="size-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0 text-[22px] leading-none">
          <span aria-hidden>{flag}</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Check className="size-3.5 text-primary shrink-0" aria-hidden />
            <p className="text-[13px] md:text-[14px] font-semibold text-foreground">
              {t("tailoredFor", { region: regionName })}
            </p>
          </div>
          <p className="mt-1 text-[11px] md:text-[12px] text-muted-foreground leading-relaxed">
            {t("tailoredDescription")}
          </p>
          <div className="mt-2 flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
              {t("changeRegion")}
            </span>
            <div className="flex items-center gap-1">
              {REGIONS.map((r) => {
                const isActive = r === effectiveRegion;
                return (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setSelectedRegion(r)}
                    aria-pressed={isActive}
                    aria-label={t(`regionLabel.${r}`)}
                    className={`size-7 rounded-full border text-[12px] leading-none flex items-center justify-center transition-all ${
                      isActive
                        ? "border-primary/50 bg-primary/15 ring-1 ring-primary/30"
                        : "border-border bg-background/40 hover:border-primary/30 hover:bg-primary/[0.04]"
                    }`}
                  >
                    <span aria-hidden>{REGION_FLAGS[r]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border bg-card/60 p-4 md:p-5 flex items-start gap-4">
      <div className="size-11 rounded-xl bg-foreground/5 flex items-center justify-center shrink-0">
        <Globe className="size-5 text-muted-foreground" aria-hidden />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-[13px] md:text-[14px] font-semibold text-foreground">
          {t("noRegionTitle")}
        </p>
        <p className="mt-1 text-[11px] md:text-[12px] text-muted-foreground leading-relaxed">
          {t("noRegionDescription")}
        </p>
        <div className="mt-3 flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground/80">
            {t("chooseRegion")}
          </span>
          <div className="flex items-center gap-1.5">
            {REGIONS.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setSelectedRegion(r)}
                aria-label={t(`regionLabel.${r}`)}
                className="inline-flex items-center gap-1.5 rounded-full border border-border bg-background/40 px-2.5 py-1 text-[11px] font-medium text-foreground hover:border-primary/40 hover:bg-primary/[0.06] transition-all"
              >
                <span aria-hidden>{REGION_FLAGS[r]}</span>
                <span>{r}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
