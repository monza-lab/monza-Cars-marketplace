"use client";

import { useLocale } from "next-intl";
import { useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Globe } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const localeFlags: Record<string, string> = {
  en: "🇺🇸",
  es: "🇪🇸",
  de: "🇩🇪",
  ja: "🇯🇵",
};

export function LanguageSwitcher() {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (newLocale: string) => {
    const query = typeof window !== "undefined" ? window.location.search : "";
    const href = query ? `${pathname}${query}` : pathname;
    router.replace(href, { locale: newLocale });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-2 text-[11px] font-medium tracking-[0.15em] uppercase text-[#9CA3AF] hover:text-[#FFFCF7] transition-colors">
          <Globe className="size-4" />
          <span className="hidden md:inline">{localeFlags[locale]}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="bg-[#0F1012] border-white/10 min-w-[140px]"
      >
        {routing.locales.map((loc) => (
          <DropdownMenuItem
            key={loc}
            onClick={() => handleLocaleChange(loc)}
            className={`flex items-center gap-3 text-[13px] cursor-pointer ${
              loc === locale
                ? "text-[#F8B4D9] bg-[rgba(248,180,217,0.08)]"
                : "text-[#9CA3AF] hover:text-[#FFFCF7]"
            }`}
          >
            <span>{localeFlags[loc]}</span>
            <span>{t(loc)}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// Mobile version - grid of buttons
export function MobileLanguageSwitcher({
  onSelect,
}: {
  onSelect?: () => void;
}) {
  const t = useTranslations("language");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();

  const handleLocaleChange = (newLocale: string) => {
    const query = typeof window !== "undefined" ? window.location.search : "";
    const href = query ? `${pathname}${query}` : pathname;
    router.replace(href, { locale: newLocale });
    onSelect?.();
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      {routing.locales.map((loc) => (
        <button
          key={loc}
          onClick={() => handleLocaleChange(loc)}
          className={`flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-[13px] font-medium transition-all ${
            loc === locale
              ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.25)]"
              : "bg-white/5 text-[#9CA3AF] hover:bg-white/10 border border-transparent"
          }`}
        >
          <span className="text-lg">{localeFlags[loc]}</span>
          <span>{t(loc)}</span>
        </button>
      ))}
    </div>
  );
}
