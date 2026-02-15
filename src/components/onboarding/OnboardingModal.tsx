"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { MapPin, Car, Target, ChevronRight, ChevronLeft, Check, Globe } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useRegion } from "@/lib/RegionContext"
import {
  isOnboardingCompleted,
  saveOnboardingPreferences,
  type OnboardingPreferences,
} from "@/lib/onboardingPreferences"
import { useTranslations } from "next-intl"

// ─── DATA ───

const REGION_OPTIONS = [
  { id: "US", flag: "\u{1F1FA}\u{1F1F8}", label: "United States" },
  { id: "UK", flag: "\u{1F1EC}\u{1F1E7}", label: "United Kingdom" },
  { id: "EU", flag: "\u{1F1EA}\u{1F1FA}", label: "Europe" },
  { id: "JP", flag: "\u{1F1EF}\u{1F1F5}", label: "Japan" },
  { id: "other", flag: "\u{1F30D}", label: "Other" },
]

const BRAND_OPTIONS = [
  "Ferrari",
  "Porsche",
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
  { id: "buy", icon: Car, titleKey: "buyTitle", descKey: "buyDesc" },
  { id: "track", icon: Target, titleKey: "trackTitle", descKey: "trackDesc" },
  { id: "learn", icon: Globe, titleKey: "learnTitle", descKey: "learnDesc" },
]

const TOTAL_STEPS = 3

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
  const [region, setRegion] = useState<string | null>(null)
  const [brands, setBrands] = useState<string[]>([])
  const [intent, setIntent] = useState<string | null>(null)

  // Show modal only once after login
  useEffect(() => {
    if (!loading && user && !isOnboardingCompleted()) {
      // Small delay so user sees the page first
      const timer = setTimeout(() => setOpen(true), 800)
      return () => clearTimeout(timer)
    }
  }, [loading, user])

  const canProceed = () => {
    if (step === 0) return !!region
    if (step === 1) return brands.length > 0
    if (step === 2) return !!intent
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
    const prefs: OnboardingPreferences = {
      region,
      brands,
      intent,
      completedAt: Date.now(),
    }
    saveOnboardingPreferences(prefs)

    // Set global region from selection
    if (region && region !== "other") {
      setSelectedRegion(region)
    }

    setOpen(false)
  }

  const skip = () => {
    saveOnboardingPreferences({
      region: null,
      brands: [],
      intent: null,
      completedAt: Date.now(),
    })
    setOpen(false)
  }

  const toggleBrand = (brand: string) => {
    setBrands((prev) =>
      prev.includes(brand) ? prev.filter((b) => b !== brand) : [...prev, brand]
    )
  }

  if (!open) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0b0b10]/90 backdrop-blur-md p-4"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative w-full max-w-lg bg-[#0F1012] border border-white/10 rounded-3xl overflow-hidden shadow-2xl shadow-black/60"
          >
            {/* Progress dots */}
            <div className="flex items-center justify-center gap-2 pt-6 pb-2">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    i === step
                      ? "w-8 bg-[#F8B4D9]"
                      : i < step
                        ? "w-4 bg-[#F8B4D9]/40"
                        : "w-4 bg-white/10"
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
                  {/* ─── Step 1: Region ─── */}
                  {step === 0 && (
                    <div>
                      <div className="flex items-center gap-2 text-[#F8B4D9] mb-3">
                        <MapPin className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 1
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-[#FFFCF7] mb-1">
                        {t("regionTitle")}
                      </h2>
                      <p className="text-[13px] text-[rgba(255,252,247,0.4)] mb-6">
                        {t("regionDesc")}
                      </p>
                      <div className="space-y-2">
                        {REGION_OPTIONS.map((r) => (
                          <button
                            key={r.id}
                            onClick={() => setRegion(r.id)}
                            className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl border transition-all ${
                              region === r.id
                                ? "border-[#F8B4D9]/40 bg-[rgba(248,180,217,0.08)]"
                                : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                            }`}
                          >
                            <span className="text-xl">{r.flag}</span>
                            <span
                              className={`text-[14px] font-medium ${
                                region === r.id ? "text-[#FFFCF7]" : "text-[#9CA3AF]"
                              }`}
                            >
                              {r.id === "other" ? t("other") : r.label}
                            </span>
                            {region === r.id && (
                              <Check className="size-4 text-[#F8B4D9] ml-auto" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ─── Step 2: Brands ─── */}
                  {step === 1 && (
                    <div>
                      <div className="flex items-center gap-2 text-[#F8B4D9] mb-3">
                        <Car className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 2
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-[#FFFCF7] mb-1">
                        {t("brandsTitle")}
                      </h2>
                      <p className="text-[13px] text-[rgba(255,252,247,0.4)] mb-5">
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
                                  ? "border-[#F8B4D9]/40 bg-[rgba(248,180,217,0.08)]"
                                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                              }`}
                            >
                              <span
                                className={`text-[13px] font-medium truncate ${
                                  selected ? "text-[#FFFCF7]" : "text-[#9CA3AF]"
                                }`}
                              >
                                {brand}
                              </span>
                              {selected && (
                                <Check className="size-3.5 text-[#F8B4D9] ml-auto shrink-0" />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ─── Step 3: Intent ─── */}
                  {step === 2 && (
                    <div>
                      <div className="flex items-center gap-2 text-[#F8B4D9] mb-3">
                        <Target className="size-4" />
                        <span className="text-[10px] font-semibold tracking-[0.25em] uppercase">
                          {t("step")} 3
                        </span>
                      </div>
                      <h2 className="text-xl font-light text-[#FFFCF7] mb-1">
                        {t("intentTitle")}
                      </h2>
                      <p className="text-[13px] text-[rgba(255,252,247,0.4)] mb-6">
                        {t("intentDesc")}
                      </p>
                      <div className="space-y-3">
                        {INTENT_OPTIONS.map((opt) => {
                          const selected = intent === opt.id
                          const Icon = opt.icon
                          return (
                            <button
                              key={opt.id}
                              onClick={() => setIntent(opt.id)}
                              className={`w-full flex items-center gap-4 px-5 py-4 rounded-xl border transition-all text-left ${
                                selected
                                  ? "border-[#F8B4D9]/40 bg-[rgba(248,180,217,0.08)]"
                                  : "border-white/[0.06] bg-white/[0.02] hover:bg-white/[0.04]"
                              }`}
                            >
                              <div
                                className={`size-10 rounded-xl flex items-center justify-center shrink-0 ${
                                  selected
                                    ? "bg-[#F8B4D9]/15"
                                    : "bg-white/[0.04]"
                                }`}
                              >
                                <Icon
                                  className={`size-5 ${
                                    selected ? "text-[#F8B4D9]" : "text-[#6B7280]"
                                  }`}
                                />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-[14px] font-medium ${
                                    selected ? "text-[#FFFCF7]" : "text-[#9CA3AF]"
                                  }`}
                                >
                                  {t(opt.titleKey)}
                                </p>
                                <p className="text-[12px] text-[rgba(255,252,247,0.3)] mt-0.5">
                                  {t(opt.descKey)}
                                </p>
                              </div>
                              {selected && (
                                <Check className="size-4 text-[#F8B4D9] shrink-0" />
                              )}
                            </button>
                          )
                        })}
                      </div>
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
                  className="flex items-center gap-1 text-[12px] font-medium text-[#6B7280] hover:text-[#9CA3AF] transition-colors"
                >
                  <ChevronLeft className="size-3.5" />
                  {t("back")}
                </button>
              ) : (
                <button
                  onClick={skip}
                  className="text-[12px] font-medium text-[#4B5563] hover:text-[#6B7280] transition-colors"
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
                    ? "bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde]"
                    : "bg-white/[0.06] text-[#4B5563] cursor-not-allowed"
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
