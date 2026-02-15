"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Send,
  Sparkles,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Newspaper,
  X,
  MessageSquare,
} from "lucide-react"

type Auction = {
  id: string
  title: string
  make: string
  model: string
  year: number
  trim: string | null
  currentBid: number
  engine: string | null
  transmission: string | null
  exteriorColor: string | null
  mileage: number | null
  location: string | null
  description: string | null
  analysis: {
    bidTargetLow: number | null
    bidTargetHigh: number | null
    confidence: string | null
    investmentGrade: string | null
    appreciationPotential: string | null
    keyStrengths: string[]
    redFlags: string[]
  } | null
}

type Message = {
  id: string
  role: "user" | "assistant"
  content: string
  timestamp: Date
}

// Quick action prompts
const quickActions = [
  {
    icon: DollarSign,
    label: "Fair value range?",
    prompt: "What is the fair value range for this vehicle based on recent market data?",
  },
  {
    icon: Newspaper,
    label: "Macro impact?",
    prompt: "How do current macroeconomic factors and geopolitical news affect this asset class?",
  },
  {
    icon: TrendingUp,
    label: "5-year forecast?",
    prompt: "What is the long-term appreciation forecast for this vehicle over the next 5 years?",
  },
  {
    icon: AlertTriangle,
    label: "Risk factors?",
    prompt: "What are the key risk factors I should consider before bidding on this vehicle?",
  },
]

function formatPrice(n: number) {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`
  return `$${n.toLocaleString()}`
}

// Generate contextual AI responses based on the vehicle
function generateResponse(prompt: string, auction: Auction): string {
  const analysis = auction.analysis
  const lowPrompt = prompt.toLowerCase()

  // Fair value response
  if (lowPrompt.includes("fair value") || lowPrompt.includes("worth") || lowPrompt.includes("price range")) {
    const low = analysis?.bidTargetLow || Math.round(auction.currentBid * 0.85)
    const high = analysis?.bidTargetHigh || Math.round(auction.currentBid * 1.15)
    return `Based on recent auction results and market analysis, the fair value range for this ${auction.year} ${auction.make} ${auction.model} is **${formatPrice(low)} – ${formatPrice(high)}**.

The current bid of ${formatPrice(auction.currentBid)} sits ${auction.currentBid < low ? "below" : auction.currentBid > high ? "above" : "within"} this range.

**Key valuation factors:**
• Condition and originality documentation
• Service history completeness
• Color combination desirability
• Provenance and ownership chain

I'd recommend setting your max bid at ${formatPrice(Math.round(high * 0.95))} to maintain upside potential.`
  }

  // Macro/geopolitical response
  if (lowPrompt.includes("macro") || lowPrompt.includes("geopolitical") || lowPrompt.includes("news") || lowPrompt.includes("economy")) {
    const isHighValue = auction.currentBid > 500_000
    return `Current macroeconomic factors affecting the ${auction.make} collector market:

**Interest Rates:** ${isHighValue ? "Higher rates have softened ultra-high-net-worth liquidity, creating selective buying opportunities in the $1M+ segment." : "Mid-range collector cars remain resilient as enthusiast buyers are less rate-sensitive."}

**Geopolitical Climate:** Uncertainty in global markets historically drives capital into tangible assets. ${auction.make} has shown 12% stronger performance during volatility periods.

**Currency Effects:** A weaker dollar benefits US-based sellers on international platforms, while European collectors are finding value in dollar-denominated auctions.

**Collector Sentiment:** The ${auction.year < 1980 ? "pre-1980 classics" : "modern classics"} segment shows continued institutional interest, with family offices allocating 2-4% of portfolios to collector vehicles.

**My take:** This ${auction.make} ${auction.model} represents a ${isHighValue ? "flight-to-quality asset" : "solid entry point"} in the current environment.`
  }

  // Appreciation forecast
  if (lowPrompt.includes("appreciation") || lowPrompt.includes("forecast") || lowPrompt.includes("5 year") || lowPrompt.includes("long-term")) {
    const potential = analysis?.appreciationPotential || "Steady appreciation expected"
    const grade = analysis?.investmentGrade || "GOOD"
    return `**5-Year Appreciation Forecast: ${auction.year} ${auction.make} ${auction.model}**

Investment Grade: **${grade}**

${potential}

**Historical Context:**
• ${auction.make} ${auction.model} values have appreciated 8-12% annually over the past decade
• ${auction.year < 1975 ? "Pre-1975 examples command significant premiums" : "This era represents the sweet spot for collector interest"}
• Supply is fixed while global collector base expands 6% YoY

**Projected Value (5Y):**
Conservative: ${formatPrice(Math.round(auction.currentBid * 1.35))}
Base case: ${formatPrice(Math.round(auction.currentBid * 1.55))}
Bull case: ${formatPrice(Math.round(auction.currentBid * 1.85))}

**Catalysts to watch:**
• Major concours wins by similar examples
• Celebrity provenance discoveries
• Manufacturer anniversary events`
  }

  // Risk factors
  if (lowPrompt.includes("risk") || lowPrompt.includes("concern") || lowPrompt.includes("worry") || lowPrompt.includes("downside")) {
    const redFlags = analysis?.redFlags || []
    return `**Risk Assessment: ${auction.year} ${auction.make} ${auction.model}**

**Market Risks:**
• Collector car market can be illiquid during economic downturns
• ${auction.currentBid > 1_000_000 ? "Ultra-high-value segment has fewer buyers, longer sale times" : "This price point has good liquidity, typically 30-60 day sale windows"}
• Insurance and storage costs average 1.5-2% of value annually

**Vehicle-Specific Risks:**
${redFlags.length > 0 ? redFlags.map(f => `• ${f}`).join("\n") : "• No significant red flags identified in current documentation"}
• Parts availability for ${auction.make} requires specialist networks
• ${auction.mileage ? `Mileage of ${auction.mileage.toLocaleString()} is ${auction.mileage < 50000 ? "well within collectible range" : "higher than average for investment-grade examples"}` : "Verify odometer documentation"}

**Due Diligence Checklist:**
☐ Pre-purchase inspection by marque specialist
☐ Title history and lien search
☐ Service records verification
☐ Originality assessment (numbers matching)

**Risk/Reward Verdict:** ${analysis?.confidence === "HIGH" ? "Favorable" : "Moderate"} – proceed with standard due diligence.`
  }

  // Liquidity
  if (lowPrompt.includes("liquid") || lowPrompt.includes("sell") || lowPrompt.includes("exit")) {
    return `**Liquidity Analysis: ${auction.year} ${auction.make} ${auction.model}**

**Current Market Depth:**
• ${auction.make} collector base: ~${auction.currentBid > 1_000_000 ? "2,500" : "8,000"} active global buyers
• Average days-to-sale at auction: ${auction.currentBid > 1_000_000 ? "45-90" : "14-30"} days
• Private sale timeline: 60-120 days typical

**Best Exit Channels:**
1. **Bring a Trailer** – Highest visibility, 0% seller fee
2. **RM Sotheby's / Gooding** – Premium positioning for $500K+ vehicles
3. **Private sale network** – Fastest for desirable examples

**Liquidity Score:** ${auction.currentBid > 2_000_000 ? "6/10 (Specialist market)" : auction.currentBid > 500_000 ? "7/10 (Strong collector demand)" : "8/10 (Broad enthusiast appeal)"}

**My recommendation:** This ${auction.make} ${auction.model} has ${auction.currentBid > 1_000_000 ? "moderate" : "strong"} liquidity. Expect fair exit within ${auction.currentBid > 1_000_000 ? "90" : "45"} days if priced competitively.`
  }

  // Provenance
  if (lowPrompt.includes("provenance") || lowPrompt.includes("history") || lowPrompt.includes("ownership")) {
    return `**Provenance Assessment: ${auction.year} ${auction.make} ${auction.model}**

**Documentation Value:**
Strong provenance can add 15-30% to a vehicle's value. Key elements:

• **Ownership chain:** Continuous, documented ownership from new
• **Service history:** Factory or specialist shop records
• **Period photos:** Original delivery documentation, early photos
• **Celebrity/notable owners:** Can command 20-50% premiums
• **Concours history:** Award-winning examples appreciate faster

**This Vehicle:**
Location: ${auction.location || "Not specified"}
${auction.description ? `\n"${auction.description}"` : ""}

**Verification Steps:**
1. Request build sheet / Kardex (for European marques)
2. Cross-reference VIN with registry databases
3. Contact previous owners if traceable
4. Verify any claimed racing or show history

**Provenance Investment:** Consider $2,000-5,000 for professional history research – typically returns 5-10x in final sale price for significant discoveries.`
  }

  // Default contextual response
  return `Thank you for your question about the ${auction.year} ${auction.make} ${auction.model}.

**Quick Overview:**
• Current bid: ${formatPrice(auction.currentBid)}
• Investment grade: ${analysis?.investmentGrade || "Under review"}
• Location: ${auction.location || "Not specified"}
${auction.engine ? `• Powertrain: ${auction.engine}` : ""}

**Key Strengths:**
${analysis?.keyStrengths?.slice(0, 2).map(s => `• ${s}`).join("\n") || "• Well-documented example of a respected marque"}

I can provide detailed analysis on:
• Fair value and bidding strategy
• Macroeconomic factors affecting this asset
• Long-term appreciation potential
• Risk factors and due diligence
• Liquidity and exit strategies
• Provenance verification

What aspect would you like me to explore further?`
}

interface StrategistChatProps {
  auction: Auction
  className?: string
}

export function StrategistChat({ auction, className = "" }: StrategistChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Reset messages when auction changes
  useEffect(() => {
    setMessages([])
  }, [auction.id])

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages])

  const sendMessage = async (content: string) => {
    if (!content.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: "user",
      content: content.trim(),
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput("")
    setIsTyping(true)

    // Simulate AI thinking delay
    await new Promise((resolve) => setTimeout(resolve, 800 + Math.random() * 1200))

    const response = generateResponse(content, auction)
    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: "assistant",
      content: response,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, assistantMessage])
    setIsTyping(false)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleQuickAction = (prompt: string) => {
    sendMessage(prompt)
  }

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Header */}
      <div className="shrink-0 px-5 pt-6 pb-4 border-b border-[rgba(248,180,217,0.06)]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles className="size-4 text-[#F8B4D9]" />
            <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-emerald-400 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-medium tracking-[0.25em] uppercase text-[rgba(255,252,247,0.3)]">
              Advisor
            </span>
            <span className="text-[10px] text-[rgba(255,252,247,0.15)] mx-2">|</span>
            <span className="text-[11px] text-[rgba(255,252,247,0.5)]">
              {auction.year} {auction.make} {auction.model}
            </span>
          </div>
        </div>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 ? (
          // Empty state with quick actions
          <div className="h-full flex flex-col justify-center">
            <div className="text-center mb-6">
              <div className="inline-flex items-center justify-center size-12 rounded-full bg-[rgba(248,180,217,0.08)] mb-3">
                <MessageSquare className="size-5 text-[#F8B4D9]" />
              </div>
              <p className="text-[13px] text-[rgba(255,252,247,0.5)]">
                Ask me anything about this vehicle
              </p>
              <p className="text-[11px] text-[rgba(255,252,247,0.25)] mt-1">
                Valuation • Strategy • Risk Analysis
              </p>
            </div>

            {/* Quick action buttons */}
            <div className="space-y-2">
              {quickActions.map((action, i) => (
                <button
                  key={i}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[rgba(248,180,217,0.04)] border border-[rgba(248,180,217,0.08)] hover:bg-[rgba(248,180,217,0.08)] hover:border-[rgba(248,180,217,0.15)] transition-all text-left group"
                >
                  <action.icon className="size-4 text-[rgba(255,252,247,0.3)] group-hover:text-[#F8B4D9] transition-colors" />
                  <span className="text-[12px] text-[rgba(255,252,247,0.5)] group-hover:text-[rgba(255,252,247,0.7)] transition-colors">
                    {action.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          // Chat messages
          <>
            {messages.map((message) => (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[90%] rounded-2xl px-4 py-3 ${
                    message.role === "user"
                      ? "bg-[#F8B4D9] text-[#0b0b10]"
                      : "bg-[rgba(255,252,247,0.04)] border border-[rgba(255,252,247,0.06)] text-[rgba(255,252,247,0.7)]"
                  }`}
                >
                  <div
                    className={`text-[12px] leading-relaxed whitespace-pre-wrap ${
                      message.role === "assistant" ? "prose-invert" : ""
                    }`}
                    dangerouslySetInnerHTML={{
                      __html: message.content
                        .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
                        .replace(/\n/g, "<br />"),
                    }}
                  />
                  <span
                    className={`block text-[9px] mt-2 ${
                      message.role === "user"
                        ? "text-[rgba(11,11,16,0.4)]"
                        : "text-[rgba(255,252,247,0.2)]"
                    }`}
                  >
                    {message.timestamp.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </motion.div>
            ))}

            {/* Typing indicator */}
            <AnimatePresence>
              {isTyping && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="flex justify-start"
                >
                  <div className="bg-[rgba(255,252,247,0.04)] border border-[rgba(255,252,247,0.06)] rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="size-1.5 rounded-full bg-[#F8B4D9] animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="size-1.5 rounded-full bg-[#F8B4D9] animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="size-1.5 rounded-full bg-[#F8B4D9] animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div ref={messagesEndRef} />
          </>
        )}
      </div>

      {/* Input area */}
      <div className="shrink-0 p-4 border-t border-[rgba(248,180,217,0.06)]">
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about liquidity, provenance, or risk..."
            className="flex-1 bg-[rgba(255,252,247,0.04)] border border-[rgba(255,252,247,0.06)] rounded-xl px-4 py-2.5 text-[12px] text-[#FFFCF7] placeholder:text-[rgba(255,252,247,0.25)] focus:outline-none focus:border-[rgba(248,180,217,0.2)] transition-colors"
          />
          <button
            type="submit"
            disabled={!input.trim() || isTyping}
            className="shrink-0 size-10 rounded-xl bg-[#F8B4D9] flex items-center justify-center text-[#0b0b10] hover:bg-[#f4cbde] disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            <Send className="size-4" />
          </button>
        </form>
      </div>
    </div>
  )
}

// Mobile floating button + drawer
interface MobileChatDrawerProps {
  auction: Auction
}

export function MobileChatDrawer({ auction }: MobileChatDrawerProps) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex items-center gap-2 bg-[#F8B4D9] rounded-full px-5 py-3 shadow-xl shadow-[rgba(248,180,217,0.3)] hover:bg-[#f4cbde] transition-all md:hidden"
      >
        <Sparkles className="size-4 text-[#0b0b10]" />
        <span className="text-[11px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10]">
          Ask Strategist
        </span>
      </button>

      {/* Drawer */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            />

            {/* Drawer content */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[85vh] bg-[#0b0b10] rounded-t-3xl border-t border-[rgba(248,180,217,0.1)] md:hidden"
            >
              {/* Drawer handle */}
              <div className="flex justify-center pt-3">
                <div className="w-12 h-1 rounded-full bg-[rgba(255,252,247,0.1)]" />
              </div>

              {/* Close button */}
              <button
                onClick={() => setIsOpen(false)}
                className="absolute top-4 right-4 size-8 rounded-full bg-[rgba(255,252,247,0.06)] flex items-center justify-center text-[rgba(255,252,247,0.4)] hover:text-[#FFFCF7] transition-colors"
              >
                <X className="size-4" />
              </button>

              {/* Chat content */}
              <div className="h-[calc(100%-16px)]">
                <StrategistChat auction={auction} />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}
