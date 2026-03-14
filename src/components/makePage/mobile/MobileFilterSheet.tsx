"use client"

import { motion, AnimatePresence } from "framer-motion"
import { Filter, X } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import { useTranslations } from "next-intl"
import { FilterChip } from "@/components/makePage/FilterChip"
import { priceRanges, sortOptions } from "@/lib/makePageConstants"

// ─── MOBILE FILTER SHEET ───
export function MobileFilterSheet({
  open,
  onClose,
  models,
  selectedModel,
  setSelectedModel,
  selectedPriceRange,
  setSelectedPriceRange,
  selectedStatus,
  setSelectedStatus,
  sortBy,
  setSortBy,
  cars,
  filteredCount,
}: {
  open: boolean
  onClose: () => void
  models: string[]
  selectedModel: string
  setSelectedModel: (m: string) => void
  selectedPriceRange: number
  setSelectedPriceRange: (p: number) => void
  selectedStatus: string
  setSelectedStatus: (s: string) => void
  sortBy: string
  setSortBy: (s: string) => void
  cars: CollectorCar[]
  filteredCount: number
}) {
  const t = useTranslations("makePage")
  const tStatus = useTranslations("status")

  const statuses = [
    { value: "All", label: t("filters.statusAll") },
    { value: "Live", label: tStatus("live") },
    { value: "Ended", label: tStatus("ended") },
  ]

  return (
    <AnimatePresence>
      {open && (
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
            className="fixed inset-x-0 bottom-0 z-50 max-h-[85vh] rounded-t-3xl bg-card border-t border-border overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <Filter className="size-4 text-primary" />
                <span className="text-[12px] font-semibold tracking-[0.1em] uppercase text-foreground">
                  {t("mobileFilters.title")}
                </span>
              </div>
              <button
                onClick={onClose}
                className="size-8 flex items-center justify-center rounded-full bg-foreground/5"
              >
                <X className="size-4 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="px-5 py-6 space-y-6 overflow-y-auto max-h-[calc(85vh-140px)]">
              {/* Model Filter */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3 block">
                  {t("filters.model")}
                </label>
                <div className="flex flex-wrap gap-2">
                  <FilterChip
                    label={t("filters.allModels")}
                    active={selectedModel === "All"}
                    onClick={() => setSelectedModel("All")}
                  />
                  {models.slice(0, 12).map(model => (
                    <FilterChip
                      key={model}
                      label={model}
                      active={selectedModel === model}
                      onClick={() => setSelectedModel(model)}
                      count={cars.filter(c => c.model === model).length}
                    />
                  ))}
                </div>
              </div>

              {/* Price Range */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3 block">
                  {t("filters.priceRange")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {priceRanges.map((range, i) => (
                    <FilterChip
                      key={range.label}
                      label={range.label}
                      active={selectedPriceRange === i}
                      onClick={() => setSelectedPriceRange(i)}
                    />
                  ))}
                </div>
              </div>

              {/* Status */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3 block">
                  {t("filters.status")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {statuses.map((status) => (
                    <FilterChip
                      key={status.value}
                      label={status.label}
                      active={selectedStatus === status.value}
                      onClick={() => setSelectedStatus(status.value)}
                    />
                  ))}
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground mb-3 block">
                  {t("filters.sortBy")}
                </label>
                <div className="flex flex-wrap gap-2">
                  {sortOptions.map((option) => (
                    <FilterChip
                      key={option.value}
                      label={t(`sort.${option.key}`)}
                      active={sortBy === option.value}
                      onClick={() => setSortBy(option.value)}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-border bg-card">
              <button
                onClick={onClose}
                className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-[13px]"
              >
                {t("mobileFilters.showResults", { count: filteredCount })}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
