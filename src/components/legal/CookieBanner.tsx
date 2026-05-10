"use client"

import { AnimatePresence, motion } from "framer-motion"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"
import { useConsent } from "./ConsentProvider"

// Editorial Salon banner — minimalista, on-brand:
// - Bottom card on every viewport (full width on mobile, ~520px max desktop)
// - "Accept all" and "Reject all" same height, same width, same row.
//   The only visual difference is fill (primary vs ghost) — equal weight.
// - One-line copy. No granular toggles (Edgar's choice; if we ever add
//   more trackers we can introduce them in a future iteration).
// - The banner shows ONLY when consent is "pending". Once user decides
//   it disappears and stays gone (persisted via ConsentProvider).
//
// GDPR / CCPA notes:
// - Both buttons render at first layer with equal prominence (no nested
//   "Manage" required when there are no granular toggles).
// - No pre-checked toggle exists, by definition.
// - Decision is persisted; reopen via /legal/cookies (footer link).

export function CookieBanner() {
  const t = useTranslations("cookies")
  const { consent, accept, reject } = useConsent()

  return (
    <AnimatePresence>
      {consent === "pending" && (
        <motion.div
          role="region"
          aria-label="Cookie consent"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 16 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-0 left-0 right-0 z-[80] px-3 pb-3 md:left-auto md:right-4 md:bottom-4 md:px-0 md:pb-0 md:max-w-[480px] pointer-events-none"
        >
          <div className="pointer-events-auto rounded-2xl bg-card/95 backdrop-blur-xl border border-border shadow-xl shadow-black/30 p-4 md:p-5">
            <p className="text-[12px] leading-relaxed text-foreground/85 mb-3">
              {t("body")}{" "}
              <Link
                href="/legal/cookies"
                className="text-primary underline underline-offset-2 hover:text-primary/80"
              >
                {t("learnMore")}
              </Link>
              .
            </p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={reject}
                className="h-9 rounded-full border border-border bg-foreground/[0.04] text-[12px] font-semibold text-foreground/85 hover:bg-foreground/[0.08] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
              >
                {t("reject")}
              </button>
              <button
                onClick={accept}
                className="h-9 rounded-full bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background transition-colors"
              >
                {t("accept")}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
