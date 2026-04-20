"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { getPreferredView, type MarketplaceView } from "@/lib/viewPreference";
import { useLocale } from "next-intl";

export function ViewPreferenceRedirect({ current }: { current: MarketplaceView }) {
  const router = useRouter();
  const locale = useLocale();
  const homeHref = locale === "en" ? "/" : `/${locale}`;
  const classicHref = locale === "en" ? "/browse" : `/${locale}/browse`;

  useEffect(() => {
    const preferred = getPreferredView();
    if (!preferred || preferred === current) return;
    router.replace(preferred === "classic" ? classicHref : homeHref);
  }, [classicHref, current, homeHref, router]);

  return null;
}
