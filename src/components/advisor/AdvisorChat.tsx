"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { X, Send, Scale } from "lucide-react"
import { useRouter } from "@/i18n/navigation"
import { useAuth } from "@/lib/auth/AuthProvider"
import { useTokens } from "@/hooks/useTokens"
import { useRegion } from "@/lib/RegionContext"
import { useCurrency } from "@/lib/CurrencyContext"
import type { AdvisorChatProps, AdvisorMessage, AdvisorContext } from "./advisorTypes"
import { generateWelcome, generateResponse } from "./advisorEngine"
import { detectLanguage } from "./advisorLanguage"
import { MessageBubble, TypingIndicator } from "./AdvisorMessage"

const regionLabels: Record<string, string> = { US: "US", EU: "EU", UK: "UK", JP: "JP" }

export function AdvisorChat({ open, onOpenChange, initialContext }: AdvisorChatProps) {
  const router = useRouter()
  const { profile } = useAuth()
  const { tokens, consumeForAnalysis, hasAnalyzed, analysesRemaining } = useTokens()
  const { effectiveRegion } = useRegion()
  const { formatPrice, currency } = useCurrency()

  const [messages, setMessages] = useState<AdvisorMessage[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const [lastLang, setLastLang] = useState<"en" | "es" | "fr" | "pt" | "de" | "it" | "ja">("en")
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Build context from props + hooks
  const buildContext = useCallback((): AdvisorContext => ({
    car: initialContext?.car,
    make: initialContext?.make || initialContext?.car?.make,
    dbMarketData: initialContext?.dbMarketData,
    dbComparables: initialContext?.dbComparables,
    dbAnalysis: initialContext?.dbAnalysis,
    dbSoldHistory: initialContext?.dbSoldHistory,
    userName: profile?.name ?? undefined,
    userTier: (profile?.tier as "FREE" | "PRO") ?? "FREE",
    effectiveRegion,
    currency,
    formatPrice,
    tokens,
    analysesRemaining,
    hasAnalyzedCurrentCar: initialContext?.car ? hasAnalyzed(initialContext.car.id) : false,
  }), [initialContext, profile, effectiveRegion, currency, formatPrice, tokens, analysesRemaining, hasAnalyzed])

  // Welcome message on open
  useEffect(() => {
    if (open && messages.length === 0) {
      const ctx = buildContext()
      const welcome = generateWelcome(ctx, lastLang)
      setMessages([welcome])
    }
  }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset on close
  useEffect(() => {
    if (!open) {
      setMessages([])
      setInput("")
      setIsTyping(false)
    }
  }, [open])

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isTyping])

  // Focus input on open
  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 300)
    }
  }, [open])

  // Send message
  const handleSend = useCallback(async (text?: string) => {
    const messageText = text || input.trim()
    if (!messageText || isTyping) return

    const lang = detectLanguage(messageText)
    setLastLang(lang)

    // Add user message
    const userMsg: AdvisorMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      content: messageText,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMsg])
    setInput("")
    setIsTyping(true)

    // Simulate thinking time
    const delay = 800 + Math.random() * 700
    await new Promise(resolve => setTimeout(resolve, delay))

    // Generate response
    const ctx = buildContext()
    const response = generateResponse(messageText, ctx)
    setMessages(prev => [...prev, response])
    setIsTyping(false)
  }, [input, isTyping, buildContext])

  // Quick action handler
  const handleQuickAction = useCallback((prompt: string) => {
    handleSend(prompt)
  }, [handleSend])

  // Report generation handler
  const handleGenerateReport = useCallback((carId: string) => {
    const success = consumeForAnalysis(carId)
    if (success) {
      const car = initialContext?.car
      const make = car?.make || initialContext?.make || "porsche"
      router.push(`/cars/${make.toLowerCase().replace(/\s+/g, "-")}/${carId}/report`)
      onOpenChange(false)
    }
  }, [consumeForAnalysis, initialContext, router, onOpenChange])

  const car = initialContext?.car

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
                      <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
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
                  <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    car.investmentGrade === "AAA"
                      ? "bg-emerald-500/15 text-emerald-400"
                      : car.investmentGrade === "AA"
                        ? "bg-blue-500/15 text-blue-400"
                        : "bg-amber-500/15 text-amber-400"
                  }`}>
                    {car.investmentGrade}
                  </span>
                </div>
              )}
            </div>

            {/* ═══ MESSAGES ═══ */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar">
              {messages.map(msg => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  onQuickAction={handleQuickAction}
                  onGenerateReport={handleGenerateReport}
                />
              ))}
              {isTyping && <TypingIndicator />}
              <div ref={messagesEndRef} />
            </div>

            {/* ═══ INPUT ═══ */}
            <div className="px-4 py-3 border-t border-border shrink-0">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend() } }}
                  placeholder={car ? `Ask about ${car.make} ${car.model}...` : "Ask anything..."}
                  className="flex-1 bg-foreground/4 border border-border rounded-xl px-4 py-2.5 text-[13px] text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary/30 transition-colors"
                  disabled={isTyping}
                />
                <button
                  onClick={() => handleSend()}
                  disabled={!input.trim() || isTyping}
                  className="size-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center hover:bg-primary/25 transition-colors disabled:opacity-30 disabled:hover:bg-primary/15"
                >
                  <Send className="size-4 text-primary" />
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground text-center mt-2">
                Specialist advisory · Responds in your language
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
