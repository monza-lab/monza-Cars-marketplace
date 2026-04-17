"use client";

import { useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import { getPreferredView, type MarketplaceView } from "@/lib/viewPreference";

export function ViewPreferenceRedirect({ current }: { current: MarketplaceView }) {
  const router = useRouter();

  useEffect(() => {
    const preferred = getPreferredView();
    if (!preferred || preferred === current) return;
    router.replace(preferred === "classic" ? "/browse" : "/");
  }, [current, router]);

  return null;
}
