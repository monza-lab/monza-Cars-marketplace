"use client"

import { motion } from "framer-motion"
import { FileText, ExternalLink } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"
import { platformLabels } from "@/lib/makePageConstants"

interface MobileCarCTAProps {
  carId: string
  make: string
  sourceUrl?: string | null
  platform?: string | null
  onOpenAdvisor: () => void
}

export function MobileCarCTA({ carId, make, sourceUrl, platform, onOpenAdvisor }: MobileCarCTAProps) {
  const t = useTranslations()
  const reportUrl = `/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${carId}/report`
  const platformName = platform ? (platformLabels[platform]?.short || platform.replace(/_/g, " ")) : null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-safe bg-gradient-to-t from-background via-background/95 to-transparent"
      >
        <div className="flex items-center gap-2.5">
          {/* Primary CTA — View Report */}
          <Link
            href={reportUrl}
            className="flex-[3] flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-primary text-primary-foreground font-semibold text-[14px] shadow-lg shadow-primary/20 active:scale-[0.98] transition-transform"
          >
            <FileText className="size-5" />
            {t("carDetail.viewReport")}
          </Link>

          {/* Secondary CTA — View on Platform (or fallback to advisor) */}
          {sourceUrl ? (
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-foreground/5 border border-border text-foreground font-medium text-[13px] active:scale-[0.98] active:bg-foreground/10 transition-all"
            >
              <ExternalLink className="size-4" />
              {platformName ? `View on ${platformName}` : t("carDetail.viewSource")}
            </a>
          ) : (
            <button
              onClick={onOpenAdvisor}
              className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-foreground/5 border border-border text-foreground font-medium text-[13px] active:scale-[0.98] active:bg-foreground/10 transition-all"
            >
              <ExternalLink className="size-4" />
              {t("carDetail.viewSource")}
            </button>
          )}
        </div>
      </motion.div>
    </div>
  )
}
