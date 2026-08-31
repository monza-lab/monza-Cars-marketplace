"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  getPreferredView,
  resolvePreferredView,
  type MarketplaceView,
} from "@/lib/viewPreference";

export function ViewPreferenceRedirect({ current }: { current: MarketplaceView }) {
  const router = useRouter();
  const homeHref = "/";
  const classicHref = "/browse";

  useEffect(() => {
    const preferred = resolvePreferredView(getPreferredView());
    if (preferred === current) return;
    router.replace(preferred === "classic" ? classicHref : homeHref);
  }, [classicHref, current, homeHref, router]);

  return null;
}
