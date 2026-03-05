"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPin, Car, Target, ChevronRight, ChevronLeft, Check, Globe, Shield, DollarSign } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useRegion } from "@/lib/RegionContext"
import {
  isOnboardingCompleted,
  saveOnboardingPreferences,
  type OnboardingPreferences,
} from "@/lib/onboardingPreferences"
import { getFamilyGroupsWithSeries } from "@/lib/brandConfig"
import { useTranslations } from "next-intl"

// ─── DATA ───

const REGION_OPTIONS = [
  { id: "US", flag: "\u{1F1FA}\u{1F1F8}", label: "United States" },
  { id: "UK", flag: "\u{1F1EC}\u{1F1E7}", label: "United Kingdom" },
  { id: "EU", flag: "\u{1F1EA}\u{1F1FA}", label: "Europe" },
  { id: "JP", flag: "\u{1F1EF}\u{1F1F5}", label: "Japan" },
  { id: "other", flag: "\u{1F30D}", label: "Other" },
]

// Porsche is implicit — these are "other" brands
const BRAND_OPTIONS = [
  "Ferrari",
  "Lamborghini",
  "McLaren",
  "Mercedes-Benz",
  "BMW",
  "Aston Martin",
  "Bugatti",
  "Pagani",
  "Koenigsegg",
  "Toyota",
  "Nissan",
  "Jaguar",
  "Rolls-Royce",
  "Ford",
  "Chevrolet",
]

const INTENT_OPTIONS = [
  { id: "buy",   icon: Car,        titleKey: "buyTitle",   descKey: "buyDesc" },
  { id: "sell",  icon: DollarSign,  titleKey: "sellTitle",  descKey: "sellDesc" },
  { id: "track", icon: Target,      titleKey: "trackTitle", descKey: "trackDesc" },
  { id: "learn", icon: Globe,       titleKey: "learnTitle", descKey: "learnDesc" },
]

const TOTAL_STEPS = 4

// Porsche family groups from brandConfig
const PORSCHE_FAMILIES = getFamilyGroupsWithSeries("porsche")

// ─── SLIDE VARIANTS ───

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 300 : -300, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -300 : 300, opacity: 0 }),
}

// ─── COMPONENT ───

export function OnboardingModal() {
  const { user, loading } = useAuth()
  const { setSelectedRegion } = useRegion()
  const t = useTranslations("onboarding")

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)

  // Selections
  const [regions, setRegions] = useState<string[]>([])
  const [brands, setBrands] = useState<string[]>([])
  const [models, setModels] = useState<string[]>([])
  const [intents, setIntents] = useState<string[]>([])

  // Show modal only once after login
  useEffect(() => {
    if (!loading && user && !isOnboardingCompleted()) {
      const timer = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [loading, user])

  const toggleRegion = (id: string) => {
    setRegions((prev) =>
      prev.includes(id) ? prev.filter((r) => r !== id) : [...prev, id]
    )
  }

  const toggleBrand = (brand: string) => {
    setBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  const toggleModel = (modelId: string) => {
    setModels((prev) =>
      prev.includes(modelId) ? prev.filter((m) => m !== modelId) : [...prev, modelId]
    )
  }

  const toggleIntent = (id: string) => {
    setIntents((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    )
  }

  const canProceed = () => {
    if (step === 0) return regions.length > 0
    if (step === 1) return true // brands are optional (Porsche is implicit)
    if (step === 2) return true // models are optional
    if (step === 3) return intents.length > 0
    return false
  }

  const goNext = () => {
    if (step < TOTAL_STEPS - 1) {
      setDirection(1)
      setStep((s) => s + 1)
    } else {
      finish()
    }
  }

  const goBack = () => {
    if (step > 0) {
      setDirection(-1)
      setStep((s) => s - 1)
    }
  }

  const finish = () => {
    const primaryRegion = regions.find(r => r !== "other") ?? null
    const prefs: OnboardingPreferences = {
      region: primaryRegion,
      regions,
      brands,
      models,
      intent: intents[0] ?? null,
      intents,
      completedAt: Date.now(),
    }
    saveOnboardingPreferences(prefs)

    if (primaryRegion) {
      setSelectedRegion(primaryRegion)
    }

    setOpen(false)
  }

  const skip = () => {
    saveOnboardingPreferences({
      region: null,
      regions: [],
      brands: [],
      models: [],
      intent: null,
      intents: [],
      completedAt: Date.now(),
    })
    setOpen(false)
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-background/90 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg bg-card border border-border rounded-3xl overflow-hidden shadow-2xl shadow-black/60"
          >
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 pt-6 pb-2">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-8 bg-primary"
                      : i < step
                        ? "w-4 bg-primary/40"
                        : "w-4 bg-foreground/10"
                  }`}
                />
              ))}
            </div>

            {/* Content area */}
            <div className="relative overflow-hidden" style={{ minHeight: 420 }}>
              <AnimatePresence mode="wait" custom={direction}>
                <motion.div
                  key={step}
                  custom={direction}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="px-6 sm:px-8 py-6"
                >
                  {/* ─── Step 1: Region (multi-select) ─── */}
                  {step === 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <MapPin className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 1
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-foreground mb-1">
                        {t("regionTitle")}
                      </h2>
                      <p className="text-[13px] text-muted-foreground/60 mb-6">
                        {t("regionDesc")}
                      </p>
                      <div className="space-y-2">
                        {REGION_OPTIONS.map((r) => {
                          const selected = regions.includes(r.id)
                          return (
                            <button
                              key={r.id}
                              onClick={() => toggleRegion(r.id)}
                              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${
                                selected
                                  ? "border-primary/40 bg-primary/8"
                                  : "border-border bg-foreground/2 hover:bg-foreground/4"
                              }`}
                            >
                              <span className="text-xl">{r.flag}</span>
                              <span
                                className={`text-[14px] font-medium ${
                                  selected ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {r.id === "other" ? t("other") : r.label}
                              </span>
                              {selected && (
                                <Check className="size-4 text-primary ml-auto" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {regions.length > 1 && (
                        <p className="text-[11px] text-primary/60 mt-3 text-center">
                          {regions.length} {t("regionsSelected") ?? "regions selected"}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ─── Step 2: Brands (optional — Porsche is implicit) ─── */}
                  {step === 1 && (
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <Car className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 2
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-foreground mb-1">
                        {t("brandsTitle")}
                      </h2>
                      <p className="text-[13px] text-muted-foreground/60 mb-5">
                        {t("brandsDesc")}
                      </p>
                      <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto no-scrollbar pr-1">
                        {BRAND_OPTIONS.map((brand) => {
                          const selected = brands.includes(brand)
                          return (
                            <button
                              key={brand}
                              onClick={() => toggleBrand(brand)}
                              className={`relative flex items-center gap-2.5 px-3.5 py-3 rounded-xl border transition-all text-left ${
                                selected
                                  ? "border-primary/40 bg-primary/8"
                                  : "border-border bg-foreground/2 hover:bg-foreground/4"
                              }`}
                            >
                              <span
                                className={`text-[13px] font-medium truncate ${
                                  selected ? "text-foreground" : "text-muted-foreground"
                                }`}
                              >
                                {brand}
                              </span>
                              {selected && (
                                <Check className="size-3.5 text-primary ml-auto shrink-0" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {brands.length === 0 && (
                        <p className="text-[11px] text-muted-foreground/50 mt-3 text-center">
                          {t("brandsOptional")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ─── Step 3: Porsche Models (multi-select) ─── */}
                  {step === 2 && (
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <Shield className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 3
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-foreground mb-1">
                        {t("modelsTitle")}
                      </h2>
                      <p className="text-[13px] text-muted-foreground/60 mb-5">
                        {t("modelsDesc")}
                      </p>
                      <div className="max-h-[290px] overflow-y-auto no-scrollbar space-y-4 pr-1">
                        {PORSCHE_FAMILIES.map((family) => (
                          <div key={family.id}>
                            <p className="text-[10px] font-semibold tracking-[0.15em] uppercase text-muted-foreground mb-2">
                              {family.label}
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {family.series.map((s) => {
                                const selected = models.includes(s.id)
                                return (
                                  <button
                                    key={s.id}
                                    onClick={() => toggleModel(s.id)}
                                    className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border transition-all ${
                                      selected
                                        ? "border-primary/40 bg-primary/8"
                                        : "border-border bg-foreground/2 hover:bg-foreground/4"
                                    }`}
                                  >
                                    <span
                                      className={`text-[13px] font-medium ${
                                        selected ? "text-foreground" : "text-muted-foreground"
                                      }`}
                                    >
                                      {s.label}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground">
                                      {s.yearRange[0]}{s.yearRange[1] < 2026 ? `–${String(s.yearRange[1]).slice(2)}` : "+"}
                                    </span>
                                    {selected && (
                                      <Check className="size-3 text-primary shrink-0" />
                                    )}
                                  </button>
                                )
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                      {models.length > 0 && (
                        <p className="text-[11px] text-primary/60 mt-3 text-center">
                          {models.length} {t("modelsSelected")}
                        </p>
                      )}
                    </div>
                  )}

                  {/* ─── Step 4: Intent ─── */}
                  {step === 3 && (
                    <div>
                      <div className="flex items-center gap-2 text-primary mb-3">
                        <Target className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 4
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-foreground mb-1">
                        {t("intentTitle")}
                      </h2>
                      <p className="text-[13px] text-muted-foreground/60 mb-6">
                        {t("intentDesc")}
                      </p>
                      <div className="space-y-3">
                        {INTENT_OPTIONS.map((opt) => {
                          const selected = intents.includes(opt.id)
                          const Icon = opt.icon
                          return (
                            <button
                              key={opt.id}
                              onClick={() => toggleIntent(opt.id)}
                              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all text-left ${
                                selected
                                  ? "border-primary/40 bg-primary/8"
                                  : "border-border bg-foreground/2 hover:bg-foreground/4"
                              }`}
                            >
                              <div
                                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  selected
                                    ? "bg-primary/15"
                                    : "bg-foreground/4"
                                }`}
                              >
                                <Icon
                                  className={`size-5 ${
                                    selected ? "text-primary" : "text-muted-foreground"
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-[14px] font-medium ${
                                    selected ? "text-foreground" : "text-muted-foreground"
                                  }`}
                                >
                                  {t(opt.titleKey)}
                                </p>
                                <p className="text-[12px] text-muted-foreground/50 mt-0.5">
                                  {t(opt.descKey)}
                                </p>
                              </div>
                              {selected && (
                                <Check className="size-4 text-primary shrink-0" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                      {intents.length > 1 && (
                        <p className="text-[11px] text-primary/60 mt-3 text-center">
                          {intents.length} selected
                        </p>
                      )}
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div className="px-6 sm:px-8 pb-6 flex items-center justify-between">
              {/* Left: Back or Skip */}
              {step > 0 ? (
                <button
                  onClick={goBack}
                  className="flex items-center gap-1 text-[12px] font-medium text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  <ChevronLeft className="size-3.5" />
                  {t("back")}
                </button>
              ) : (
                <button
                  onClick={skip}
                  className="text-[12px] font-medium text-muted-foreground hover:text-muted-foreground transition-colors"
                >
                  {t("skip")}
                </button>
              )}

              {/* Right: Next / Finish */}
              <button
                onClick={goNext}
                disabled={!canProceed()}
                className={`flex items-center gap-2 rounded-full px-6 py-2.5 text-[12px] font-semibold tracking-wide transition-all ${
                  canProceed()
                    ? "bg-primary text-primary-foreground hover:bg-primary/80"
                    : "bg-foreground/6 text-muted-foreground cursor-not-allowed"
                }`}
              >
                {step === TOTAL_STEPS - 1 ? t("finish") : t("next")}
                {step < TOTAL_STEPS - 1 && <ChevronRight className="size-3.5" />}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
