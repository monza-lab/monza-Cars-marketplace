"use client";

import { useEffect, useState } from "react";
import { Sparkles, LayoutGrid } from "lucide-react";
import { useRouter, usePathname } from "@/i18n/navigation";
import { setPreferredView, type MarketplaceView } from "@/lib/viewPreference";

export function ViewToggle() {
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  const active: MarketplaceView = pathname?.startsWith("/browse") ? "classic" : "monza";

  const handleSelect = (view: MarketplaceView) => {
    if (view === active) return;
    setPreferredView(view);
    router.push(view === "classic" ? "/browse" : "/");
  };

  if (!mounted) return null;

  return (
    <div
      role="tablist"
      aria-label="Marketplace view"
      className="hidden md:inline-flex items-center gap-0.5 rounded-full border border-border bg-foreground/[0.03] p-0.5"
    >
      <button
        role="tab"
        aria-selected={active === "monza"}
        onClick={() => handleSelect("monza")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium tracking-wide transition-all ${
          active === "monza"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        <Sparkles className="size-3" />
        <span>Monza</span>
      </button>
      <button
        role="tab"
        aria-selected={active === "classic"}
        onClick={() => handleSelect("classic")}
        className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium tracking-wide transition-all ${
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
