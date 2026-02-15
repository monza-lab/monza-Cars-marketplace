'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Send, Bot, User, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface Message {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
}

interface AdvisorChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialContext?: {
    carTitle?: string
    carPrice?: string
    make?: string
  }
}

// Expert knowledge base for McLaren F1
const mclarenF1Knowledge = {
  production: 106,
  roadCars: 64,
  colors: {
    black: { available: 'Approximately 8-10 F1s were delivered in Carbon Black or similar dark finishes. Currently, 2 are known to be potentially available through private sales. One in the UK with 12,000 km, another in the Middle East collection with 4,200 km.',
      note: 'Black F1s command a 5-8% premium due to their understated elegance.' },
    silver: { available: 'Platinum Silver and Magnesium Silver were popular choices. About 12-15 exist. One recently traded privately in Monaco.',
      note: 'Silver examples photograph exceptionally well and maintain strong values.' },
    red: { available: 'Several exist in Spectral Red and custom reds. A beautiful example sold at RM Sotheby\'s for $20.5M in 2024.',
      note: 'Red F1s are iconic but less common than silver or black.' },
    papaya: { available: 'The famous Papaya Orange example is museum-held. Two other orange variants exist in private collections.',
      note: 'Orange/Papaya carries Bruce McLaren heritage significance.' },
  },
  recentSales: [
    { year: 2024, price: '$20.5M', venue: 'RM Sotheby\'s', spec: 'Spectral Red, 15,000 km' },
    { year: 2023, price: '$19.8M', venue: 'Private Sale', spec: 'Platinum Silver, 8,400 km' },
    { year: 2023, price: '$21.0M', venue: 'Gooding & Co', spec: 'Carbon Black, 10,200 km' },
  ],
  specialists: [
    { name: 'McLaren Special Operations', location: 'Woking, UK', note: 'Factory-authorized service' },
    { name: 'Lanzante', location: 'Hampshire, UK', note: 'Original F1 GTR race team, exceptional expertise' },
    { name: 'Canepa', location: 'California, USA', note: 'Premier US specialist' },
  ]
}

// Intelligent response generator
function generateResponse(
  query: string,
  context?: AdvisorChatProps['initialContext'],
  conversationHistory?: Message[]
): string {
  const q = query.toLowerCase()
  const make = context?.make?.toLowerCase() || ''
  const isMcLarenF1 = make === 'mclaren' || context?.carTitle?.toLowerCase().includes('f1')

  // ═══════════════════════════════════════════════════════════════
  // COLOR / AVAILABILITY QUERIES
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('negro') || q.includes('black') || q.includes('dark')) {
    if (isMcLarenF1) {
      return `Excellent taste. Black McLaren F1s are among the most sophisticated specifications.

**Current Availability:**
${mclarenF1Knowledge.colors.black.available}

**Market Insight:**
${mclarenF1Knowledge.colors.black.note}

**My Recommendation:**
The UK example has full MSO service history and recently completed a major service. If you're serious, I can facilitate a discreet inquiry to the current owner. These opportunities don't appear publicly—most F1 transactions happen through trusted networks.

Shall I reach out on your behalf?`
    }
    return `Black is a distinguished choice. For ${context?.make || 'this marque'}, dark finishes often represent the most elegant specifications.

Let me check our network for available examples. May I ask:
- Is there a specific model year you prefer?
- What's your acquisition timeline?
- Are you open to international sourcing?`
  }

  if (q.includes('color') || q.includes('colour') || q.includes('plata') || q.includes('silver') || q.includes('rojo') || q.includes('red') || q.includes('azul') || q.includes('blue') || q.includes('blanco') || q.includes('white')) {
    const colorMap: Record<string, string> = {
      'plata': 'silver', 'silver': 'silver',
      'rojo': 'red', 'red': 'red',
      'azul': 'blue', 'blue': 'blue',
      'blanco': 'white', 'white': 'white'
    }
    const detectedColor = Object.keys(colorMap).find(c => q.includes(c))

    if (isMcLarenF1 && detectedColor) {
      const colorKey = colorMap[detectedColor] as keyof typeof mclarenF1Knowledge.colors
      const colorInfo = mclarenF1Knowledge.colors[colorKey]
      if (colorInfo) {
        return `**${colorKey.charAt(0).toUpperCase() + colorKey.slice(1)} McLaren F1:**

${colorInfo.available}

${colorInfo.note}

I maintain relationships with several principal collectors. If you'd like, I can make discreet inquiries about potential sellers. These conversations require absolute confidentiality—would that work for you?`
      }
    }

    return `I understand you're interested in a specific color. Let me research current availability in our network.

For ${context?.carTitle || 'collector vehicles at this level'}, color matching often requires patience. The right specification can take 6-18 months to source.

What's your timeline, and are there any other specifications that matter to you?`
  }

  // ═══════════════════════════════════════════════════════════════
  // AVAILABILITY / BUYING QUERIES
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('disponible') || q.includes('available') || q.includes('comprar') || q.includes('buy') || q.includes('adquirir') || q.includes('acquire') || q.includes('buscando') || q.includes('looking for') || q.includes('quiero') || q.includes('want')) {
    if (isMcLarenF1) {
      return `The McLaren F1 market operates almost entirely off-market. Public auctions represent perhaps 20% of transactions.

**Current Market Intelligence:**
- 3-4 examples typically available at any given time through private channels
- Average asking price: **$18-22M** depending on specification
- Wait time from inquiry to closing: 3-6 months

**Recent Comparable Sales:**
${mclarenF1Knowledge.recentSales.map(s => `• ${s.year}: ${s.price} (${s.spec}) via ${s.venue}`).join('\n')}

**My Approach:**
I work with a network of principals, family offices, and trusted dealers. If you're a serious buyer, I can:
1. Discreetly canvas my network for available examples
2. Verify provenance and service history
3. Arrange private viewings
4. Negotiate on your behalf

What specification would be ideal for you?`
    }

    return `I'd be delighted to help you acquire ${context?.carTitle || 'a vehicle from our collection'}.

**Acquisition Process:**
1. **Discovery** — Understanding your exact requirements
2. **Sourcing** — Leveraging our global network
3. **Verification** — Complete provenance and condition assessment
4. **Negotiation** — Securing the best possible terms
5. **Completion** — Logistics, documentation, delivery

What matters most to you in this acquisition—specification, provenance, or investment potential?`
  }

  // ═══════════════════════════════════════════════════════════════
  // PRICE / VALUE QUERIES
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('precio') || q.includes('price') || q.includes('valor') || q.includes('value') || q.includes('cuanto') || q.includes('how much') || q.includes('cuesta') || q.includes('cost') || q.includes('worth')) {
    if (isMcLarenF1) {
      return `**McLaren F1 Valuation (2026):**

The F1 market has matured significantly. Current pricing:

| Specification | Value Range |
|--------------|-------------|
| High-mileage (25K+ km) | $15-17M |
| Average (10-20K km) | $18-21M |
| Low-mileage (<10K km) | $21-25M |
| LM Specification | $25-30M |
| GTR Road Legal | $28-35M |

**Key Value Drivers:**
- Mileage (most significant factor)
- Service history completeness
- Color/specification desirability
- Ownership provenance
- Geographic location (EU cars command slight premium)

The **${context?.carPrice || '$19.8M'}** asking price for this example appears **fair** given current market conditions.

Would you like a detailed breakdown of how this compares to recent transactions?`
    }

    return `**${context?.carTitle || 'This vehicle'}** is currently offered at **${context?.carPrice || 'market value'}**.

Based on our analysis, this represents fair value for:
- Current market conditions
- Comparable recent sales
- Specification and condition

I can provide a comprehensive valuation report using our AI analysis (1 credit). This includes:
- Detailed comparable sales data
- Investment grade rating
- 3-5 year appreciation forecast
- Risk factors and opportunities

Shall I proceed with the analysis?`
  }

  // ═══════════════════════════════════════════════════════════════
  // INVESTMENT QUERIES
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('inversion') || q.includes('investment') || q.includes('invertir') || q.includes('invest') || q.includes('apreciacion') || q.includes('appreciation') || q.includes('roi') || q.includes('return')) {
    if (isMcLarenF1) {
      return `**McLaren F1 Investment Thesis:**

The F1 is arguably the most investment-grade collector car in existence.

**Historical Performance:**
- 2000 → 2010: +280% ($1M → $3.8M)
- 2010 → 2020: +350% ($3.8M → $17M)
- 2020 → 2026: +25% ($17M → $21M)

**Why Values Will Continue Rising:**
1. **Finite Supply** — 64 road cars, number only decreases over time
2. **Cultural Significance** — The defining supercar of its era
3. **Engineering Pinnacle** — Still the fastest naturally-aspirated production car
4. **Collector Demographics** — Buyer pool growing as Gen-X wealth matures

**Risks:**
- Maintenance costs substantial ($50-100K annually if driven)
- Storage and insurance approximately $30K/year
- Liquidity can take 3-6 months

**My Assessment:**
At current prices, the F1 remains an exceptional store of value with moderate appreciation potential. I expect 5-8% annual appreciation over the next decade.

Would you like to discuss acquisition strategy?`
    }

    return `**Investment Analysis for ${context?.make || 'Collector Vehicles'}:**

The collector car market has proven remarkably resilient. Key considerations:

**Favorable Factors:**
- Tangible asset with emotional value
- Limited supply of quality examples
- Growing global collector base
- Portfolio diversification benefits

**Risk Factors:**
- Illiquidity compared to financial assets
- Storage, insurance, maintenance costs
- Market sentiment shifts
- Condition degradation if not properly maintained

For specific investment guidance on ${context?.carTitle || 'this vehicle'}, I recommend our AI-powered analysis. It provides:
- Fair value estimation
- Comparable sales data
- Investment grade rating
- 3-5 year outlook

Shall I run the analysis?`
  }

  // ═══════════════════════════════════════════════════════════════
  // SERVICE / MAINTENANCE QUERIES
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('service') || q.includes('servicio') || q.includes('mantenimiento') || q.includes('maintenance') || q.includes('specialist') || q.includes('especialista') || q.includes('taller') || q.includes('shop')) {
    if (isMcLarenF1) {
      return `**McLaren F1 Service & Specialists:**

Only a handful of facilities worldwide are qualified to work on F1s:

${mclarenF1Knowledge.specialists.map(s => `**${s.name}** — ${s.location}
${s.note}`).join('\n\n')}

**Service Considerations:**
- Major service (every 4 years or 6,000 km): $40,000-80,000
- Clutch replacement: $25,000-35,000
- Tire replacement (Goodyear F1s): $8,000
- Annual inspection and fluids: $5,000-8,000

**My Recommendation:**
Before any acquisition, require proof of MSO or Lanzante service history. Cars serviced elsewhere may have value implications.

I can connect you with the right specialists if you're evaluating a specific example. Would that be helpful?`
    }

    return `Proper service is crucial for ${context?.make || 'collector vehicles'} both for preservation and value retention.

**Key Recommendations:**
1. Use marque specialists, never general mechanics
2. Maintain complete service documentation
3. Store in climate-controlled environment
4. Annual inspection even if not driven

I can recommend trusted specialists in your region. Where are you located?`
  }

  // ═══════════════════════════════════════════════════════════════
  // GREETINGS
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('hola') || q.includes('hello') || q.includes('hi') || q.includes('buenos') || q.includes('good')) {
    return `Good ${new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 18 ? 'afternoon' : 'evening'}. I'm your personal Monza Lab advisor.

${context?.carTitle
  ? `I see you're exploring the **${context.carTitle}**—an exceptional vehicle. At **${context.carPrice}**, this represents one of the most significant opportunities in our collection.

How may I assist you? I can discuss:
- Current market conditions and fair value
- Acquisition strategy and negotiation
- Sourcing alternative examples
- Investment thesis and outlook`
  : `I'm here to provide expert guidance on collector vehicle acquisitions and investments.

How may I be of service today?`}`
  }

  // ═══════════════════════════════════════════════════════════════
  // THANKS / POSITIVE
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('gracias') || q.includes('thank') || q.includes('perfect') || q.includes('perfecto') || q.includes('excelente') || q.includes('excellent') || q.includes('great') || q.includes('genial')) {
    return `You're most welcome. It's my pleasure to assist.

If you decide to move forward, I'm here to:
- Facilitate introductions to sellers
- Coordinate pre-purchase inspections
- Assist with negotiation strategy
- Advise on logistics and import considerations

Don't hesitate to reach out anytime. The best acquisitions often require patience and the right timing.

Is there anything else I can help you with today?`
  }

  // ═══════════════════════════════════════════════════════════════
  // HELP / GENERAL QUERIES
  // ═══════════════════════════════════════════════════════════════
  if (q.includes('ayuda') || q.includes('help') || q.includes('que puedes') || q.includes('what can you')) {
    return `I'm your dedicated advisor for collector vehicle acquisitions. My expertise includes:

**Market Intelligence**
- Current valuations and pricing trends
- Comparable sales analysis
- Investment-grade vehicle identification

**Acquisition Support**
- Off-market sourcing through private networks
- Seller introductions and negotiations
- Pre-purchase due diligence coordination

**Ownership Guidance**
- Storage and care recommendations
- Specialist and service network access
- Exit strategy planning

${context?.carTitle ? `\nRegarding the **${context.carTitle}**, I'm happy to discuss any aspect—from valuation to acquisition strategy to long-term ownership.` : ''}

What would you like to explore?`
  }

  // ═══════════════════════════════════════════════════════════════
  // CATCH-ALL INTELLIGENT RESPONSE
  // ═══════════════════════════════════════════════════════════════
  // For any other query, provide a thoughtful, contextual response
  const carName = context?.carTitle || 'this vehicle'
  const makeName = context?.make || 'this marque'

  return `Thank you for your interest in ${carName}.

I want to ensure I provide you with precisely the information you need. Could you help me understand:

${context?.carTitle ? `
**About the ${context.carTitle}:**
- Are you considering acquisition, or researching the market?
- Is there a specific aspect—price, history, specification—you'd like to explore?
- What's your timeline for making a decision?
` : `
- Which vehicles or marques interest you most?
- Are you building a collection or acquiring a single example?
- What's most important: driving enjoyment, investment return, or both?
`}

I'm here to provide expert, personalized guidance. The more context you share, the more valuable my insights can be.`
}

export function AdvisorChat({ open, onOpenChange, initialContext }: AdvisorChatProps) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Initialize with welcome message
  useEffect(() => {
    if (open && messages.length === 0) {
      const hour = new Date().getHours()
      const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening'

      const welcomeMessage: Message = {
        id: 'welcome',
        role: 'assistant',
        content: initialContext?.carTitle
          ? `${greeting}. I'm your personal Monza Lab advisor.

I see you're interested in the **${initialContext.carTitle}**—a truly exceptional vehicle offered at **${initialContext.carPrice}**.

How may I assist you today? I can discuss market valuation, acquisition strategy, sourcing alternatives, or investment outlook.`
          : `${greeting}. I'm your personal Monza Lab advisor, here to guide you through the world of investment-grade collector vehicles.

Whether you're building a collection, seeking a specific acquisition, or researching the market, I'm at your service.

How may I help you today?`,
        timestamp: new Date(),
      }
      setMessages([welcomeMessage])
    }
  }, [open, initialContext, messages.length])

  // Reset messages when modal closes
  useEffect(() => {
    if (!open) {
      setMessages([])
    }
  }, [open])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = async () => {
    if (!input.trim()) return

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setInput('')
    setIsTyping(true)

    // Simulate AI thinking time (slightly longer for more "thoughtful" responses)
    await new Promise((resolve) => setTimeout(resolve, 1200 + Math.random() * 800))

    const response = generateResponse(input, initialContext, messages)

    const assistantMessage: Message = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: response,
      timestamp: new Date(),
    }

    setIsTyping(false)
    setMessages((prev) => [...prev, assistantMessage])
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
            onClick={() => onOpenChange(false)}
          />

          {/* Chat Modal */}
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="fixed bottom-4 right-4 z-50 w-full max-w-md sm:bottom-6 sm:right-6"
          >
            <div className="bg-[#0F1012] border border-white/10 rounded-2xl shadow-2xl shadow-black/50 overflow-hidden flex flex-col h-[550px] max-h-[85vh]">
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-[#0F1012]">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#F8B4D9]/20 to-[#F8B4D9]/5 flex items-center justify-center border border-[#F8B4D9]/20">
                    <Sparkles className="w-5 h-5 text-[#F8B4D9]" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-[#FFFCF7]">Private Advisor</h3>
                    <p className="text-[10px] text-[#34D399] flex items-center gap-1">
                      <span className="w-1.5 h-1.5 bg-[#34D399] rounded-full animate-pulse" />
                      At your service
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => onOpenChange(false)}
                  className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-[#9CA3AF] hover:text-[#FFFCF7] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex gap-3 ${message.role === 'user' ? 'flex-row-reverse' : ''}`}
                  >
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                        message.role === 'user'
                          ? 'bg-[#F8B4D9]/20'
                          : 'bg-white/5'
                      }`}
                    >
                      {message.role === 'user' ? (
                        <User className="w-3.5 h-3.5 text-[#F8B4D9]" />
                      ) : (
                        <Bot className="w-3.5 h-3.5 text-[#9CA3AF]" />
                      )}
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 ${
                        message.role === 'user'
                          ? 'bg-[#F8B4D9] text-[#0b0b10]'
                          : 'bg-white/5 text-[#FFFCF7]'
                      }`}
                    >
                      <div className="text-[13px] leading-relaxed whitespace-pre-wrap">
                        {message.content.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
                          if (part.startsWith('**') && part.endsWith('**')) {
                            return (
                              <span key={i} className="font-semibold">
                                {part.slice(2, -2)}
                              </span>
                            )
                          }
                          return <span key={i}>{part}</span>
                        })}
                      </div>
                    </div>
                  </div>
                ))}

                {/* Typing indicator */}
                {isTyping && (
                  <div className="flex gap-3">
                    <div className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-[#9CA3AF]" />
                    </div>
                    <div className="bg-white/5 rounded-2xl px-4 py-3">
                      <div className="flex gap-1.5">
                        <span className="w-2 h-2 bg-[#F8B4D9] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-2 h-2 bg-[#F8B4D9] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-2 h-2 bg-[#F8B4D9] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}

                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-white/10 bg-[#0F1012]">
                <div className="flex gap-2">
                  <Input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask anything..."
                    className="flex-1 bg-[#0b0b10] border-white/10 text-[#FFFCF7] placeholder:text-[#4B5563] focus:border-[#F8B4D9]/50"
                  />
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim() || isTyping}
                    className="bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#f4cbde] disabled:opacity-50"
                  >
                    <Send className="w-4 h-4" />
                  </Button>
                </div>
                <p className="text-[10px] text-[#4B5563] mt-2 text-center">
                  Confidential advisory service • Discretion assured
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
