"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import { getPreferredView, type MarketplaceView } from "@/lib/viewPreference";

export function ViewPreferenceRedirect({ current }: { current: MarketplaceView }) {
  const router = useRouter();
  const pathname = usePathname();
  const locale = pathname?.split("/")[1];
  const isSupportedLocale = locale && ["en", "es", "de", "ja"].includes(locale);
  const homeHref = isSupportedLocale ? (locale === "en" ? "/" : `/${locale}`) : "/";
  const classicHref = isSupportedLocale ? (locale === "en" ? "/browse" : `/${locale}/browse`) : "/browse";

  useEffect(() => {
    const preferred = getPreferredView();
    if (!preferred || preferred === current) return;
    router.replace(preferred === "classic" ? classicHref : homeHref);
  }, [classicHref, current, homeHref, router]);

  return null;
}
