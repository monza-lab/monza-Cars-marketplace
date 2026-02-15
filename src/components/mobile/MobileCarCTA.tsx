"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  Sparkles,
  X,
  ArrowRight,
  Car,
  BarChart3,
  TrendingUp,
  MessageCircle,
} from "lucide-react"
import { searchCars, CURATED_CARS } from "@/lib/curatedCars"
import { useTranslations } from "next-intl"

// ─── FORMAT PRICE ───
function formatPrice(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`
  return `$${value.toLocaleString()}`
}

// ─── MOBILE CAR ORACLE OVERLAY ───
function MobileCarOracleOverlay({
  isOpen,
  onClose,
  query,
  carContext,
}: {
  isOpen: boolean
  onClose: () => void
  query: string
  carContext: { title: string; make: string; price: string }
}) {
  const t = useTranslations()
  const router = useRouter()
  const [isLoading, setIsLoading] = useState(true)
  const [displayedText, setDisplayedText] = useState("")

  type ChipId = "view_details" | "view_similar" | "view_collection"
  type Chip = { id: ChipId; label: string }
  const [chips, setChips] = useState<Chip[]>([])

  // Get response based on query and car context
  const matchingCars = searchCars(query)

  // Determine if query is about the current car or something else
  const isAboutCurrentCar = query.toLowerCase().includes(carContext.make.toLowerCase()) ||
    query.toLowerCase().includes("este") ||
    query.toLowerCase().includes("this") ||
    query.toLowerCase().includes("carro") ||
    query.toLowerCase().includes("car") ||
    query.toLowerCase().includes("precio") ||
    query.toLowerCase().includes("price") ||
    query.toLowerCase().includes("valor") ||
    query.toLowerCase().includes("value") ||
    query.toLowerCase().includes("inversión") ||
    query.toLowerCase().includes("investment")

  let response = {
    answer: "",
    chips: [] as Chip[],
    carContext: null as { id: string; make: string } | null,
  }

  if (isAboutCurrentCar || query.length < 10) {
    // Answer about current car
    const currentCar = CURATED_CARS.find(c => c.make !== "Ferrari" && c.title === carContext.title)
    if (currentCar) {
      const fv = currentCar.fairValueByRegion
      response = {
        answer: t("oracle.responses.currentCar", {
          title: carContext.title,
          grade: currentCar.investmentGrade,
          trend: currentCar.trend,
          usLow: formatPrice(fv.US.low),
          usHigh: formatPrice(fv.US.high),
          euLow: formatPrice(fv.EU.low),
          euHigh: formatPrice(fv.EU.high),
          ukLow: formatPrice(fv.UK.low),
          ukHigh: formatPrice(fv.UK.high),
          thesis: currentCar.thesis,
        }),
        chips: [
          { id: "view_similar", label: t("oracle.viewSimilar") },
          { id: "view_collection", label: t("oracle.viewCollection") },
        ],
        carContext: { id: currentCar.id, make: currentCar.make },
      }
    } else {
      response = {
        answer: t("oracle.responses.currentCarFallback", {
          title: carContext.title,
          price: carContext.price,
        }),
        chips: [
          { id: "view_collection", label: t("oracle.viewCollection") },
        ],
        carContext: null,
      }
    }
  } else if (matchingCars.length === 1) {
    const car = matchingCars[0]
    response = {
      answer: t("oracle.responses.singleCar", {
        title: car.title,
        thesis: car.thesis,
        fairLow: formatPrice(car.fairValueByRegion.US.low),
        fairHigh: formatPrice(car.fairValueByRegion.US.high),
        grade: car.investmentGrade,
        trend: car.trend,
      }),
      chips: [
        { id: "view_details", label: t("oracle.viewDetails") },
        { id: "view_similar", label: t("oracle.viewSimilar") },
      ],
      carContext: { id: car.id, make: car.make },
    }
  } else if (matchingCars.length > 1) {
    const carList = matchingCars.slice(0, 4).map(car =>
      `• **${car.year} ${car.make} ${car.model}** — ${formatPrice(car.currentBid)}`
    ).join("\n")
    response = {
      answer: `${t("oracle.responses.multipleFound", { count: matchingCars.length })}\n\n${carList}`,
      chips: [
        { id: "view_collection", label: t("oracle.viewCollection") },
      ],
      carContext: null,
    }
  } else {
    response = {
      answer: t("oracle.responses.noMatchForQuery", {
        query,
        title: carContext.title,
      }),
      chips: [
        { id: "view_collection", label: t("oracle.viewCollection") },
      ],
      carContext: null,
    }
  }

  // Loading effect
  useEffect(() => {
    if (!isOpen) {
      setDisplayedText("")
      setIsLoading(true)
      setChips([])
      return
    }
    const timer = setTimeout(() => setIsLoading(false), 600)
    return () => clearTimeout(timer)
  }, [isOpen])

  // Typewriter effect
  useEffect(() => {
    if (isLoading || !isOpen) return

    const fullText = response.answer
    let charIndex = 0

    const typeInterval = setInterval(() => {
      if (charIndex <= fullText.length) {
        setDisplayedText(fullText.slice(0, charIndex))
        charIndex += 3
      } else {
        clearInterval(typeInterval)
        setChips(response.chips)
      }
    }, 8)

    return () => clearInterval(typeInterval)
  }, [isLoading, isOpen, response.answer, response.chips])

  const handleChipClick = (chip: Chip) => {
    if (response.carContext && (chip.id === "view_details" || chip.id === "view_similar")) {
      const makePath = response.carContext.make.toLowerCase().replace(/\s+/g, "-")
      if (chip.id === "view_details") {
        router.push(`/cars/${makePath}/${response.carContext.id}`)
      } else {
        router.push(`/cars/${makePath}`)
      }
    } else if (chip.id === "view_collection") {
      router.push("/")
    }
    onClose()
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] bg-[#0b0b10]/98 backdrop-blur-xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-[#F8B4D9]" />
              <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
                {t("oracle.aiAdvisor")}
              </span>
            </div>
            <button
              onClick={onClose}
              className="size-10 flex items-center justify-center rounded-full bg-white/5 text-[#9CA3AF]"
            >
              <X className="size-5" />
            </button>
          </div>

          {/* Car Context Badge */}
          <div className="px-5 pt-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
              <Car className="size-3 text-[#F8B4D9]" />
              <span className="text-[11px] text-[#9CA3AF]">{carContext.title}</span>
            </div>
          </div>

          {/* Query */}
          <div className="px-5 pt-3 pb-2">
            <p className="text-[12px] text-[#4B5563]">
              {t("oracle.youAsked")} <span className="text-[#FFFCF7]">"{query}"</span>
            </p>
          </div>

          {/* Content */}
          <div className="px-5 py-4 overflow-y-auto" style={{ maxHeight: "calc(100vh - 280px)" }}>
            {isLoading ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="size-2 rounded-full bg-[#F8B4D9] animate-pulse" />
                  <span className="text-[13px] text-[#9CA3AF]">{t("oracle.analyzingMake", { make: carContext.make })}</span>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-white/5 rounded animate-pulse w-full" />
                  <div className="h-4 bg-white/5 rounded animate-pulse w-5/6" />
                  <div className="h-4 bg-white/5 rounded animate-pulse w-4/6" />
                </div>
              </div>
            ) : (
              <div className="text-[15px] leading-relaxed text-[#FFFCF7] whitespace-pre-wrap">
                {displayedText.split("\n").map((line, i) => {
                  const parts = line.split(/(\*\*[^*]+\*\*)/g)
                  return (
                    <p key={i} className={line.startsWith("•") ? "pl-4 my-1" : "my-2"}>
                      {parts.map((part, j) => {
                        if (part.startsWith("**") && part.endsWith("**")) {
                          return <span key={j} className="font-semibold text-[#F8B4D9]">{part.slice(2, -2)}</span>
                        }
                        return <span key={j}>{part}</span>
                      })}
                    </p>
                  )
                })}
              </div>
            )}
          </div>

          {/* Chips */}
          <AnimatePresence>
            {chips.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="fixed bottom-0 left-0 right-0 p-5 bg-gradient-to-t from-[#0b0b10] via-[#0b0b10] to-transparent pt-16"
              >
                <div className="flex flex-wrap gap-2">
                  {chips.map((chip, i) => (
                    <button
                      key={chip.id}
                      onClick={() => handleChipClick(chip)}
                      className="flex items-center gap-2 rounded-full bg-[rgba(248,180,217,0.1)] border border-[rgba(248,180,217,0.2)] px-5 py-3 text-[13px] font-medium text-[#F8B4D9] active:scale-95 transition-transform"
                    >
                      {i === 0 && <Car className="size-4" />}
                      {i === 1 && <BarChart3 className="size-4" />}
                      {i === 2 && <TrendingUp className="size-4" />}
                      {chip.label}
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── MAIN COMPONENT ───
interface MobileCarCTAProps {
  carTitle: string
  carPrice: string
  make: string
}

export function MobileCarCTA({ carTitle, carPrice, make }: MobileCarCTAProps) {
  const t = useTranslations()
  const [query, setQuery] = useState("")
  const [showInput, setShowInput] = useState(false)
  const [showOracle, setShowOracle] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when showing
  useEffect(() => {
    if (showInput && inputRef.current) {
      inputRef.current.focus()
    }
  }, [showInput])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (query.trim()) {
      setShowInput(false)
      setShowOracle(true)
    }
  }

  const handleClose = () => {
    setShowOracle(false)
    setQuery("")
  }

  // Quick prompts for this car (translated)
  const quickPrompts = [
    t("carDetail.isGoodInvestment"),
    t("carDetail.fairPrice"),
    t("carDetail.compareAlternatives"),
  ]

  return (
    <>
      {/* Mobile Only - Fixed Bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-50 md:hidden">
        <AnimatePresence>
          {showInput ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-[#0b0b10]/98 backdrop-blur-xl border-t border-white/10 p-4 pb-safe"
            >
              {/* Quick Prompts */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar mb-3 -mx-1 px-1">
                {quickPrompts.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => {
                      setQuery(prompt)
                      setShowInput(false)
                      setShowOracle(true)
                    }}
                    className="shrink-0 px-4 py-2 rounded-full bg-white/5 border border-white/10 text-[12px] text-[#9CA3AF] active:bg-white/10"
                  >
                    {prompt}
                  </button>
                ))}
              </div>

              {/* Input */}
              <form onSubmit={handleSubmit} className="relative">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={t("carDetail.askAbout", { make })}
                  className="w-full bg-[#0F1012] border border-[rgba(248,180,217,0.2)] rounded-2xl pl-5 pr-14 py-4 text-[15px] text-[#FFFCF7] placeholder:text-[#4B5563] focus:outline-none focus:border-[#F8B4D9]/50"
                />
                <button
                  type="submit"
                  disabled={!query.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 size-10 flex items-center justify-center rounded-xl bg-[#F8B4D9] text-[#0b0b10] disabled:opacity-50 disabled:bg-white/10 disabled:text-[#4B5563]"
                >
                  <ArrowRight className="size-5" />
                </button>
              </form>

              {/* Close */}
              <button
                onClick={() => setShowInput(false)}
                className="w-full mt-3 py-2 text-[12px] text-[#4B5563]"
              >
                {t("mobile.cancel")}
              </button>
            </motion.div>
          ) : (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 pb-safe bg-gradient-to-t from-[#0b0b10] via-[#0b0b10]/95 to-transparent"
            >
              <button
                onClick={() => setShowInput(true)}
                className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl bg-[#F8B4D9] text-[#0b0b10] font-semibold text-[14px] shadow-lg shadow-[#F8B4D9]/20 active:scale-[0.98] transition-transform"
              >
                <Sparkles className="size-5" />
                {t("carDetail.askAnything")}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Oracle Overlay */}
      <MobileCarOracleOverlay
        isOpen={showOracle}
        onClose={handleClose}
        query={query}
        carContext={{ title: carTitle, make, price: carPrice }}
      />
    </>
  )
}
