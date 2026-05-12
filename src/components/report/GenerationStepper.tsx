"use client"

import { useState, useEffect, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import type { PipelineProgress, StepStatus } from "@/lib/reports/types-v3"

interface GenerationStepperProps {
  carImages: string[]
  carTitle: string
  series: string
  listingType: "auction" | "classified"
  steps: PipelineProgress[]
  currentStep: number
  totalDataPoints?: number
  onComplete?: () => void
}

const ROTATING_MESSAGES: Record<string, string[]> = {
  listing_scrape: [
    "Extracting every detail from the source listing...",
    "Reading seller notes, specs, and equipment list...",
    "Analyzing photos for condition clues...",
  ],
  vehicle_identity: [
    "Matching series, variant, and factory options...",
    "Cross-referencing VIN with production records...",
    "Identifying specifications...",
  ],
  market_data_bundle: [
    "Querying listings across 4 regional markets...",
    "Analyzing sold prices from BaT, Cars & Bids, RM Sotheby's...",
    "Computing cross-border arbitrage opportunities...",
    "Real transaction data — not estimates...",
  ],
  fair_value: [
    "Applying detected signals as value modifiers...",
    "Computing specific-car fair value bands...",
    "Analyzing color rarity and option premiums...",
  ],
  technical_analysis: [
    "Researching reliability and known issues...",
    "Analyzing production numbers for this specification...",
    "Evaluating key strengths and concerns...",
  ],
  investment_analysis: [
    "Building your strategy...",
    "Projecting ownership costs over 1, 3, and 5 years...",
    "Modeling resale value trajectories...",
  ],
  due_diligence: [
    "Generating vehicle-specific questions for the seller...",
    "Computing risk assessment score...",
    "Building pre-purchase inspection checklist...",
  ],
  market_research: [
    "Compiling expert opinions from automotive journalists...",
    "Analyzing owner community sentiment...",
    "Researching model heritage and significance...",
  ],
  buyer_services: [
    "Estimating parts availability and pricing...",
    "Computing insurance cost projections...",
    "Calculating transportation and shipping options...",
  ],
  final_synthesis: [
    "Composing executive summary and investment thesis...",
    "Synthesizing 10 research dimensions into your verdict...",
    "Your Investment Dossier is almost ready...",
  ],
}

const PERSONALITY_MESSAGES = [
  "Thinking about what makes this one special...",
  "Cross-referencing auction results from three continents...",
  "Checking what specialists say about this generation...",
  "Almost there — synthesizing everything we found...",
  "Your dossier is going to be thorough...",
  "We take this more seriously than the seller does...",
]

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case "completed":
      return <span className="text-green-500">&#10003;</span>
    case "in_progress":
      return (
        <motion.span
          animate={{ opacity: [1, 0.4, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
          className="text-amber-400"
        >
          &#9673;
        </motion.span>
      )
    case "failed":
      return <span className="text-red-500">&#10007;</span>
    default:
      return <span className="text-gray-500">&#9675;</span>
  }
}

export function GenerationStepper({
  carImages,
  carTitle,
  series,
  listingType,
  steps,
  currentStep,
  totalDataPoints,
  onComplete,
}: GenerationStepperProps) {
  const [photoIndex, setPhotoIndex] = useState(0)
  const [rotatingMsgIndex, setRotatingMsgIndex] = useState(0)
  const [personalityIndex, setPersonalityIndex] = useState(0)

  const photos = useMemo(
    () => (carImages.length > 0 ? carImages : []),
    [carImages]
  )

  useEffect(() => {
    if (photos.length <= 1) return
    const interval = setInterval(() => {
      setPhotoIndex((i) => (i + 1) % photos.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [photos.length])

  useEffect(() => {
    const interval = setInterval(() => {
      setRotatingMsgIndex((i) => i + 1)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setPersonalityIndex((i) => (i + 1) % PERSONALITY_MESSAGES.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const allDone = steps.length > 0 && steps.every(
    (s) => s.status === "completed" || s.status === "failed"
  )

  useEffect(() => {
    if (allDone && onComplete) {
      const timer = setTimeout(onComplete, 2000)
      return () => clearTimeout(timer)
    }
  }, [allDone, onComplete])

  const activeStep = steps.find((s) => s.status === "in_progress")
  const activeMessages = activeStep
    ? ROTATING_MESSAGES[activeStep.sectionKey] ?? []
    : []
  const rawMessage =
    activeMessages.length > 0
      ? activeMessages[rotatingMsgIndex % activeMessages.length]
      : ""
  const currentMessage = rawMessage
    .replace("{totalDataPoints}", String(totalDataPoints ?? "64,000+"))
    .replace("{series}", series)

  const completedCount = steps.filter((s) => s.status === "completed").length

  return (
    <div className="fixed inset-0 z-50 flex flex-col lg:flex-row bg-black">
      {/* Photo section */}
      <div className="relative h-[50vh] lg:h-full lg:w-[60%] overflow-hidden">
        <AnimatePresence mode="wait">
          {photos.length > 0 ? (
            <motion.img
              key={photoIndex}
              src={photos[photoIndex]}
              alt={carTitle}
              className="absolute inset-0 w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.0 }}
              animate={{ opacity: 1, scale: 1.05 }}
              exit={{ opacity: 0 }}
              transition={{
                opacity: { duration: 1, ease: "easeInOut" },
                scale: { duration: 4, ease: "linear" },
              }}
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-amber-950/20 to-gray-900 flex items-center justify-center">
              <span className="text-4xl font-bold text-white/10 tracking-widest">MONZA</span>
            </div>
          )}
        </AnimatePresence>

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {photos.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.slice(0, 12).map((_, i) => (
              <span
                key={i}
                className={`w-1.5 h-1.5 rounded-full ${
                  i === photoIndex % Math.min(photos.length, 12)
                    ? "bg-white"
                    : "bg-white/40"
                }`}
              />
            ))}
          </div>
        )}

        {allDone && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-t from-amber-900/30 via-black/50 to-amber-900/10"
          >
            <h2 className="text-2xl font-bold text-white mb-2">
              Your Investment Dossier is ready
            </h2>
            <p className="text-white/70 mb-6">{carTitle}</p>
            <motion.button
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              onClick={onComplete}
              className="px-8 py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-lg transition-colors"
            >
              View Report
            </motion.button>
          </motion.div>
        )}
      </div>

      {/* Stepper section */}
      <div className="flex-1 lg:w-[40%] p-6 lg:p-10 overflow-y-auto flex flex-col justify-center">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-white mb-1">
            {activeStep?.label ?? (allDone ? "Complete" : "Preparing...")}
          </h3>
          <p className="text-sm text-white/60 h-5">{currentMessage}</p>
        </div>

        <div className="mb-6">
          <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-amber-500 rounded-full"
              animate={{ width: `${(completedCount / Math.max(steps.length, 1)) * 100}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-xs text-white/40 mt-1">
            Step {Math.min(completedCount + 1, steps.length)} of {steps.length}
          </p>
        </div>

        <div className="space-y-3 mb-8">
          {steps.map((step) => (
            <div key={step.sectionKey} className="flex items-start gap-3 text-sm">
              <div className="w-5 text-center mt-0.5">
                <StepIcon status={step.status} />
              </div>
              <div>
                <span
                  className={
                    step.status === "completed"
                      ? "text-white/80"
                      : step.status === "in_progress"
                        ? "text-white font-medium"
                        : step.status === "failed"
                          ? "text-red-400"
                          : "text-white/40"
                  }
                >
                  {step.label}
                </span>
                {step.completionNote && step.status === "failed" && (
                  <span className="text-red-400/60 ml-2 text-xs">
                    (using cached data)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs italic text-white/30">
          {PERSONALITY_MESSAGES[personalityIndex]}
        </p>
      </div>
    </div>
  )
}
