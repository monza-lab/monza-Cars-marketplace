"use client"

import { useEffect, useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Scale } from "lucide-react"
import { useLocale } from "next-intl"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useRegion } from "@/lib/RegionContext"
import { useCurrency } from "@/lib/CurrencyContext"
import { AdvisorConversation } from "./AdvisorConversation"
import type { AdvisorChatProps } from "./advisorTypes"

const regionLabels: Record<string, string> = { US: "US", EU: "EU", UK: "UK", JP: "JP" }

export function AdvisorChat({ open, onOpenChange, initialContext, conversationId: seedConversationId }: AdvisorChatProps) {
  const { profile } = useAuth()
  const { effectiveRegion } = useRegion()
  const { formatPrice } = useCurrency()
  const locale = useLocale()

  const [conversationId, setConversationId] = useState<string | null>(seedConversationId ?? null)

  // Adopt a new seed id coming from a handoff while the modal is open.
  useEffect(() => {
    if (open && seedConversationId && seedConversationId !== conversationId) {
      setConversationId(seedConversationId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, seedConversationId])

  // Reset conversation state when the modal closes.
  useEffect(() => {
    if (!open) setConversationId(null)
  }, [open])

  const car = initialContext?.car
  const userTier: "FREE" | "PRO" = profile?.tier === "PRO" ? "PRO" : "FREE"

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => onOpenChange(false)}
            className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 w-[calc(100%-2rem)] sm:w-[420px] h-[600px] max-h-[85vh] bg-card border border-border rounded-2xl shadow-2xl shadow-black/50 flex flex-col overflow-hidden z-[9999]"
          >
            {/* ═══ HEADER ═══ */}
            <div className="px-4 py-3 border-b border-border shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="size-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center">
                    <Scale className="size-4 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-[13px] font-semibold text-foreground">Monza Advisor</h3>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="size-1.5 rounded-full bg-positive animate-pulse" />
                      <span className="text-[10px] text-muted-foreground">
                        {profile?.name
                          ? `Helping ${profile.name.split(" ")[0]}`
                          : "At your service"
                        }
                        {effectiveRegion && ` · ${regionLabels[effectiveRegion] || effectiveRegion} market`}
                      </span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="size-8 rounded-lg flex items-center justify-center hover:bg-foreground/5 transition-colors"
                >
                  <X className="size-4 text-muted-foreground" />
                </button>
              </div>

              {/* Car context bar */}
              {car && (
                <div className="mt-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-foreground/3 border border-border">
                  <span className="text-[10px] text-muted-foreground truncate flex-1">
                    {car.year} {car.make} {car.model}
                  </span>
                  <span className="text-[10px] font-display font-medium text-primary shrink-0">
                    {formatPrice(car.currentBid)}
                  </span>
                </div>
              )}
            </div>

            {/* ═══ BODY: shared AdvisorConversation ═══ */}
            <div className="flex-1 min-h-0">
              <AdvisorConversation
                conversationId={conversationId}
                onConversationIdChanged={setConversationId}
                surface="chat"
                initialContext={car ? { listingId: car.id } : undefined}
                locale={locale as "en" | "de" | "es" | "ja"}
                userTier={userTier}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
