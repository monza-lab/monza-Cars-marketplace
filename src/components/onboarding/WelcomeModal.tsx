"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import { usePathname } from "next/navigation"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import { MonzaHausWordmark } from "@/components/brand/MonzaHausWordmark"
import { Globe, FileText, TrendingUp } from "lucide-react"

const STORAGE_KEY = "monzahaus-onboarded"

const BULLETS = [
  { key: "browse", Icon: Globe },
  { key: "reports", Icon: FileText },
  { key: "trends", Icon: TrendingUp },
] as const

export function shouldMountWelcomeModal(pathname: string | null | undefined): boolean {
  const cleanPath = (pathname || "/").replace(/\/+$/, "") || "/"
  if (cleanPath === "/") return false

  const parts = cleanPath.split("/").filter(Boolean)
  const maybeLocale = parts[0]
  const pathWithoutLocale = ["en", "es", "de", "ja"].includes(maybeLocale)
    ? `/${parts.slice(1).join("/")}`
    : cleanPath

  if (pathWithoutLocale === "/" || pathWithoutLocale === "/get-started") return false

  const appParts = pathWithoutLocale.split("/").filter(Boolean)
  const isVehicleDetail = appParts[0] === "cars" && appParts.length >= 3
  if (isVehicleDetail) return false

  return true
}

export function WelcomeModal() {
  const t = useTranslations("onboarding.welcome")
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const shouldMount = shouldMountWelcomeModal(pathname)

  useEffect(() => {
    if (!shouldMount) return
    if (typeof window === "undefined") return
    if (localStorage.getItem(STORAGE_KEY) === "true") return

    const timer = setTimeout(() => setOpen(true), 600)
    return () => clearTimeout(timer)
  }, [shouldMount])

  if (!shouldMount) return null

  function handleDismiss() {
    setOpen(false)
    localStorage.setItem(STORAGE_KEY, "true")
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss() }}>
      <DialogContent
        className="mx-4 max-w-[420px] sm:max-w-[480px] bg-card/95 backdrop-blur-xl border-border p-0 gap-0 rounded-2xl overflow-hidden"
        onPointerDownOutside={handleDismiss}
        onEscapeKeyDown={handleDismiss}
      >
        <div className="px-6 pt-7 pb-6 md:px-8 md:pt-8 md:pb-7">
          {/* Wordmark */}
          <div className="flex justify-center mb-6">
            <MonzaHausWordmark
              tone="lavender-deep"
              className="text-[14px] text-foreground"
            />
          </div>

          {/* Hidden accessible title */}
          <DialogTitle className="sr-only">{t("title")}</DialogTitle>
          <DialogDescription className="sr-only">
            {t("browse")} {t("reports")} {t("trends")}
          </DialogDescription>

          {/* Headline */}
          <h2 className="font-serif font-normal text-[1.375rem] md:text-2xl text-center text-foreground tracking-[-0.02em] mb-6">
            {t("title")}
          </h2>

          {/* Bullets */}
          <div className="space-y-4">
            {BULLETS.map(({ key, Icon }) => (
              <div key={key} className="flex items-start gap-3.5">
                <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center mt-0.5">
                  <Icon className="w-[18px] h-[18px] text-[#5D3F66]" strokeWidth={1.5} />
                </div>
                <p className="font-sans text-sm text-foreground leading-snug pt-1.5">
                  {t(key)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="px-6 pb-6 md:px-8 md:pb-7">
          <button
            onClick={handleDismiss}
            className="w-full rounded-xl bg-[#D6BEDC] text-[#3F2A47] font-sans font-semibold text-sm py-3 transition-all duration-250 hover:bg-[#E1CCE5] hover:scale-[1.01] active:scale-[0.99]"
          >
            {t("cta")}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
