"use client";

import { LayoutGrid } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { setPreferredView, type MarketplaceView } from "@/lib/viewPreference";
import { MonzaHelmet } from "@/components/icons/MonzaHelmet";

export function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const homeHref = "/";
  const classicHref = "/browse";
  const isClassicRoute = pathname === "/browse" || pathname?.startsWith("/browse/");
  const isHomeRoute = pathname === "/";

  const active: MarketplaceView = isClassicRoute ? "classic" : "monza";

  const handleSelect = (view: MarketplaceView) => {
    if ((view === "classic" && isClassicRoute) || (view === "monza" && isHomeRoute)) {
      return;
    }

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
