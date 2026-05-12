"use client";

import { useTranslations } from "next-intl";
import { ImageOff } from "lucide-react";
import { hasPhoto } from "@/lib/photoSort";

type CardLike = { images?: readonly string[] | null; image?: string | null };

export function PhotoPendingPill({ car }: { car: CardLike }) {
  const t = useTranslations("common");
  if (hasPhoto(car)) return null;
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-background/85 border border-border backdrop-blur-md px-2 py-0.5 text-[9px] font-medium text-muted-foreground">
      <ImageOff className="size-2.5" aria-hidden />
      <span>{t("photoPending")}</span>
    </span>
  );
}
