"use client";

import { LayoutGrid } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { setPreferredView, type MarketplaceView } from "@/lib/viewPreference";
import { MonzaHelmet } from "@/components/icons/MonzaHelmet";

export function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1];
  const homeHref = locale && ["en", "es", "de", "ja"].includes(locale) ? (locale === "en" ? "/" : `/${locale}`) : "/";
  const classicHref = locale && ["en", "es", "de", "ja"].includes(locale) ? (locale === "en" ? "/browse" : `/${locale}/browse`) : "/browse";

  const active: MarketplaceView = pathname?.startsWith("/browse") ? "classic" : "monza";

  const handleSelect = (view: MarketplaceView) => {
    if (view === active) return;
    setPreferredView(view);
    router.push(view === "classic" ? classicHref : homeHref);
  };

  return (
    <div
      role="tablist"
      aria-label="Marketplace view"
      className="inline-flex items-center gap-0.5 rounded-full border border-border bg-foreground/[0.03] p-0.5"
    >
      <button
        role="tab"
        aria-selected={active === "monza"}
        onClick={() => handleSelect("monza")}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] md:text-[11px] font-medium tracking-wide transition-all ${
          active === "monza"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <MonzaHelmet className="size-3.5 -mt-px" />
        <span>Monza</span>
      </button>
      <button
        role="tab"
        aria-selected={active === "classic"}
        onClick={() => handleSelect("classic")}
        className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] md:text-[11px] font-medium tracking-wide transition-all ${
          active === "classic"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <LayoutGrid className="size-3" />
        <span>Classic</span>
      </button>
    </div>
  );
}
