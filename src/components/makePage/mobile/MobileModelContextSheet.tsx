"use client"

import { motion, AnimatePresence } from "framer-motion"
import { X } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { getSeriesConfig } from "@/lib/brandConfig"
import type { Model } from "@/lib/makePageHelpers"
import { MobileModelContext } from "./MobileModelContext"

// ─── MOBILE: MODEL CONTEXT BOTTOM SHEET ───
export function MobileModelContextSheet({
  model,
  make,
  cars,
  allCars,
  allModels,
  onClose,
  dbOwnershipCosts,
}: {
  model: Model | null
  make: string
  cars: CollectorCar[]
  allCars: CollectorCar[]
  allModels: Model[]
  onClose: () => void
  dbOwnershipCosts?: { insurance?: number; storage?: number; maintenance?: number } | null
}) {
  if (!model) return null

  return (
    <AnimatePresence>
      {model && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl bg-background border-t border-border overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div>
                <p className="text-[14px] font-semibold text-foreground">{make} {getSeriesConfig(model.slug || model.name.toLowerCase(), make)?.label || model.name}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{model.years} · {model.carCount} cars</p>
              </div>
              <button
                onClick={onClose}
                className="size-8 flex items-center justify-center rounded-full bg-foreground/5"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {/* Scrollable content */}
            <div className="overflow-y-auto max-h-[calc(85vh-70px)] pb-8">
              <MobileModelContext
                model={model}
                make={make}
                cars={cars}
                allCars={allCars}
                allModels={allModels}
                dbOwnershipCosts={dbOwnershipCosts}
              />
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
