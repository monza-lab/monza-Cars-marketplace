"use client"

import { motion } from "framer-motion"
import { FileText, Scale } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { useTranslations } from "next-intl"

interface MobileCarCTAProps {
  carId: string
  make: string
  onOpenAdvisor: () => void
}

export function MobileCarCTA({ carId, make, onOpenAdvisor }: MobileCarCTAProps) {
  const t = useTranslations()
  const reportUrl = `/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${carId}/report`

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="p-4 pb-safe bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/95 to-transparent"
      >
        <div className="flex items-center gap-2.5">
          {/* Primary CTA — View Report */}
          <Link
            href={reportUrl}
            className="flex-[3] flex items-center justify-center gap-2.5 py-4 rounded-2xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[14px] shadow-lg shadow-[#F8B4D9]/20 active:scale-[0.98] transition-transform"
          >
            <FileText className="size-5" />
            {t("carDetail.viewReport")}
          </Link>

          {/* Secondary CTA — Ask Advisor */}
          <button
            onClick={onOpenAdvisor}
            className="flex-[2] flex items-center justify-center gap-2 py-4 rounded-2xl bg-white/5 border border-white/10 text-[#F8B4D9] font-medium text-[13px] active:scale-[0.98] active:bg-white/10 transition-all"
          >
            <Scale className="size-4" />
            {t("carDetail.askAdvisor")}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
