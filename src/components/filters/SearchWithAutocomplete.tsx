"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Search, X, ArrowRight, Sparkles, Award, Calendar, Zap } from "lucide-react"

// ─── PORSCHE DATA (from CSV) ───
type SearchResult = {
  type: "model" | "variant" | "generation" | "year" | "popular" | "family"
  name: string
  subtitle?: string
  count: number
  generation?: string
  years?: string
}

// Model Families (from model_family column)
const MODEL_FAMILIES: SearchResult[] = [
  { type: "family", name: "911", count: 200, subtitle: "Sports car icon" },
  { type: "family", name: "Cayenne", count: 42, subtitle: "Performance SUV" },
  { type: "family", name: "Macan", count: 14, subtitle: "Compact SUV" },
  { type: "family", name: "Taycan", count: 14, subtitle: "Electric performance" },
  { type: "family", name: "Panamera", count: 31, subtitle: "Grand tourer" },
  { type: "family", name: "Boxster", count: 7, subtitle: "Mid-engine roadster" },
  { type: "family", name: "Cayman", count: 6, subtitle: "Mid-engine coupe" },
  { type: "family", name: "Carrera GT", count: 1, subtitle: "Ultra Rare hypercar" },
  { type: "family", name: "918 Spyder", count: 2, subtitle: "Hybrid hypercar" },
]

const PORSCHE_MODELS: SearchResult[] = [
  // 992 Generation
  { type: "model", name: "911 Carrera", generation: "992.2", years: "2025", count: 6, subtitle: "RWD / AWD" },
  { type: "model", name: "911 Carrera S", generation: "992.2", years: "2025", count: 4, subtitle: "RWD / AWD" },
  { type: "model", name: "911 Carrera GTS", generation: "992.2", years: "2025", count: 3, subtitle: "Hybrid" },
  { type: "model", name: "911 Targa 4", generation: "992.2", years: "2025", count: 3, subtitle: "AWD" },
  { type: "model", name: "911 Turbo S", generation: "992.2", years: "2026", count: 1, subtitle: "T-Hybrid" },

  // 991 Generation
  { type: "model", name: "911 GT3", generation: "992.1", years: "2022-2024", count: 12, subtitle: "Naturally Aspirated" },
  { type: "model", name: "911 GT3 RS", generation: "992.1", years: "2023-2024", count: 8, subtitle: "Ultra Rare" },
  { type: "model", name: "911 GT3 Touring", generation: "992.1", years: "2022-2024", count: 5, subtitle: "Investment Grade" },
  { type: "model", name: "911 Turbo", generation: "992.1", years: "2021-2024", count: 10, subtitle: "AWD" },
  { type: "model", name: "911 Turbo S", generation: "992.1", years: "2020-2024", count: 15, subtitle: "Investment Grade" },
  { type: "model", name: "911 Sport Classic", generation: "992.1", years: "2023", count: 2, subtitle: "Ultra Rare - 1250 units" },
  { type: "model", name: "911 S/T", generation: "992.1", years: "2024", count: 1, subtitle: "Ultra Rare - 1963 units" },
  { type: "model", name: "911 Dakar", generation: "992.1", years: "2023-2024", count: 3, subtitle: "Ultra Rare" },

  // 991.2 Generation
  { type: "model", name: "911 GT3", generation: "991.2", years: "2018-2019", count: 18, subtitle: "Investment Grade" },
  { type: "model", name: "911 GT3 RS", generation: "991.2", years: "2019", count: 10, subtitle: "Investment Grade" },
  { type: "model", name: "911 GT2 RS", generation: "991.2", years: "2018-2019", count: 5, subtitle: "Ultra Rare - 1000 units" },
  { type: "model", name: "911 Speedster", generation: "991.2", years: "2019", count: 3, subtitle: "Ultra Rare - 1948 units" },

  // 997 Generation
  { type: "model", name: "911 GT3 RS 4.0", generation: "997.2", years: "2012", count: 2, subtitle: "Ultra Rare - 600 units" },
  { type: "model", name: "911 GT2 RS", generation: "997.2", years: "2011-2012", count: 4, subtitle: "Ultra Rare - 500 units" },

  // Classic
  { type: "model", name: "911 Carrera RS 2.7", generation: "F-body", years: "1973", count: 1, subtitle: "Ultra Rare - Icon" },
]

const VARIANTS: SearchResult[] = [
  { type: "variant", name: "GT3", count: 45, subtitle: "Track-focused" },
  { type: "variant", name: "GT3 RS", count: 23, subtitle: "Ultra performance" },
  { type: "variant", name: "GT2 RS", count: 9, subtitle: "Turbocharged GT" },
  { type: "variant", name: "Turbo", count: 38, subtitle: "All-weather supercar" },
  { type: "variant", name: "Turbo S", count: 32, subtitle: "Maximum performance" },
  { type: "variant", name: "GTS", count: 28, subtitle: "Sweet spot" },
  { type: "variant", name: "Carrera", count: 67, subtitle: "Core model" },
  { type: "variant", name: "Targa", count: 24, subtitle: "Open-air" },
  { type: "variant", name: "Speedster", count: 6, subtitle: "Ultra Rare" },
  { type: "variant", name: "Sport Classic", count: 2, subtitle: "Heritage edition" },
]

const GENERATIONS: SearchResult[] = [
  { type: "generation", name: "992 (2020-2026)", count: 87, subtitle: "Current" },
  { type: "generation", name: "991 (2012-2019)", count: 145, subtitle: "Modern classic" },
  { type: "generation", name: "997 (2005-2012)", count: 98, subtitle: "Last hydraulic" },
  { type: "generation", name: "996 (1999-2004)", count: 76, subtitle: "Water-cooled era" },
  { type: "generation", name: "993 (1995-1998)", count: 45, subtitle: "Last air-cooled" },
  { type: "generation", name: "964 (1989-1994)", count: 32, subtitle: "Classic" },
]

const POPULAR_SEARCHES: SearchResult[] = [
  { type: "popular", name: "Manual + GT3", count: 18, subtitle: "6MT purist" },
  { type: "popular", name: "Investment Grade", count: 67, subtitle: "Appreciating assets" },
  { type: "popular", name: "Ultra Rare", count: 23, subtitle: "Limited production" },
  { type: "popular", name: "Naturally Aspirated", count: 45, subtitle: "No turbos" },
  { type: "popular", name: "Manual + RWD", count: 89, subtitle: "Driver's choice" },
]

// ─── FUZZY SEARCH FUNCTION ───
function fuzzySearch(query: string, data: SearchResult[]): SearchResult[] {
  if (!query) return []

  // Normalize query: "Porsche 911" → "911", "Porsche GT3" → "GT3"
  let normalizedQuery = query.toLowerCase().trim()
  normalizedQuery = normalizedQuery.replace(/^porsche\s+/i, "")

  const lowerQuery = normalizedQuery

  return data
    .map(item => {
      const lowerName = item.name.toLowerCase()
      const lowerSubtitle = item.subtitle?.toLowerCase() || ""

      // Exact match gets highest score
      if (lowerName === lowerQuery) return { item, score: 100 }

      // Starts with query gets high score
      if (lowerName.startsWith(lowerQuery)) return { item, score: 90 }

      // Contains query gets medium score
      if (lowerName.includes(lowerQuery)) return { item, score: 70 }

      // Subtitle match gets lower score
      if (lowerSubtitle.includes(lowerQuery)) return { item, score: 50 }

      // Fuzzy match (all characters present in order)
      let queryIndex = 0
      for (let i = 0; i < lowerName.length && queryIndex < lowerQuery.length; i++) {
        if (lowerName[i] === lowerQuery[queryIndex]) {
          queryIndex++
        }
      }
      if (queryIndex === lowerQuery.length) return { item, score: 30 }

      return null
    })
    .filter((result): result is { item: SearchResult; score: number } => result !== null)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map(r => r.item)
}

// ─── RESULT ITEM COMPONENT ───
function ResultItem({ result, onSelect, isActive }: { result: SearchResult; onSelect: () => void; isActive: boolean }) {
  const icons = {
    model: Car,
    variant: Zap,
    generation: Calendar,
    year: Calendar,
    popular: Sparkles,
    family: Award,
  }

  const Icon = icons[result.type] || Award

  return (
    <button
      onClick={onSelect}
      className={`w-full flex items-center gap-3 px-4 py-2.5 transition-all ${
        isActive
          ? "bg-[#F8B4D9]/10 border-l-2 border-[#F8B4D9]"
          : "hover:bg-white/[0.03]"
      }`}
    >
      <Icon className={`size-4 ${isActive ? "text-[#F8B4D9]" : "text-[#6B7280]"}`} />
      <div className="flex-1 text-left">
        <div className="flex items-center gap-2">
          <span className={`text-[12px] font-medium ${isActive ? "text-[#F8B4D9]" : "text-[#D1D5DB]"}`}>
            {result.name}
          </span>
          {result.generation && (
            <span className="text-[9px] text-[#6B7280] font-mono">
              {result.generation}
            </span>
          )}
        </div>
        {result.subtitle && (
          <span className="text-[10px] text-[#6B7280]">
            {result.subtitle}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-mono text-[#6B7280]">
          {result.count}
        </span>
        <ArrowRight className="size-3 text-[#6B7280]" />
      </div>
    </button>
  )
}

// Stub Car icon if not imported
function Car({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1-1V7a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1h-2z" />
    </svg>
  )
}

// ─── MAIN COMPONENT ───
export function SearchWithAutocomplete({ onSelect }: { onSelect?: (result: SearchResult) => void }) {
  const [query, setQuery] = useState("")
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Combined search results (families first for better UX)
  const allData = [...MODEL_FAMILIES, ...PORSCHE_MODELS, ...VARIANTS, ...GENERATIONS]
  const results = fuzzySearch(query, allData)
  const popularResults = query ? [] : POPULAR_SEARCHES.slice(0, 3)

  const hasResults = results.length > 0 || popularResults.length > 0

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return

      const totalResults = results.length + popularResults.length

      if (e.key === "ArrowDown") {
        e.preventDefault()
        setActiveIndex(prev => (prev + 1) % totalResults)
      } else if (e.key === "ArrowUp") {
        e.preventDefault()
        setActiveIndex(prev => (prev - 1 + totalResults) % totalResults)
      } else if (e.key === "Enter") {
        e.preventDefault()
        const allResults = [...results, ...popularResults]
        const selected = allResults[activeIndex]
        if (selected) {
          handleSelect(selected)
        }
      } else if (e.key === "Escape") {
        setIsOpen(false)
        inputRef.current?.blur()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [isOpen, results, popularResults, activeIndex])

  const handleSelect = (result: SearchResult) => {
    setQuery(result.name)
    setIsOpen(false)
    onSelect?.(result)
  }

  const handleClear = () => {
    setQuery("")
    setActiveIndex(0)
    inputRef.current?.focus()
  }

  return (
    <div className="relative">
      {/* INPUT */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6B7280]" />
        <input
          ref={inputRef}
          type="text"
          placeholder="Buscar GT3, Turbo, 992..."
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setIsOpen(true)
            setActiveIndex(0)
          }}
          onFocus={() => setIsOpen(true)}
          className="w-full pl-10 pr-10 py-2.5 bg-white/[0.03] border border-white/10 rounded-lg text-[12px] text-[#FFFCF7] placeholder:text-[#6B7280] focus:outline-none focus:border-[#F8B4D9]/50 focus:ring-1 focus:ring-[#F8B4D9]/30 transition-all"
        />
        {query && (
          <button
            onClick={handleClear}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#F8B4D9] transition-colors"
          >
            <X className="size-4" />
          </button>
        )}
      </div>

      {/* DROPDOWN */}
      <AnimatePresence>
        {isOpen && hasResults && (
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            className="absolute z-50 w-full mt-2 bg-[#0A0A0A]/98 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl shadow-black/50 overflow-hidden"
          >
            {/* Search Results */}
            {results.length > 0 && (
              <div className="border-b border-white/5">
                <div className="px-4 py-2 flex items-center gap-2">
                  <Search className="size-3 text-[#F8B4D9]" />
                  <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                    Resultados ({results.length})
                  </span>
                </div>
                <div className="max-h-[280px] overflow-y-auto no-scrollbar">
                  {results.map((result, index) => (
                    <ResultItem
                      key={`${result.type}-${result.name}`}
                      result={result}
                      onSelect={() => handleSelect(result)}
                      isActive={index === activeIndex}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Popular Searches */}
            {popularResults.length > 0 && (
              <div>
                <div className="px-4 py-2 flex items-center gap-2">
                  <Sparkles className="size-3 text-[#F8B4D9]" />
                  <span className="text-[9px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
                    Búsquedas Populares
                  </span>
                </div>
                <div>
                  {popularResults.map((result, index) => (
                    <ResultItem
                      key={`popular-${result.name}`}
                      result={result}
                      onSelect={() => handleSelect(result)}
                      isActive={results.length + index === activeIndex}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Keyboard hint */}
            <div className="px-4 py-2 border-t border-white/5 flex items-center justify-center gap-4">
              <span className="text-[9px] text-[#6B7280]">
                <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[8px]">↑↓</kbd> navegar
              </span>
              <span className="text-[9px] text-[#6B7280]">
                <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[8px]">Enter</kbd> seleccionar
              </span>
              <span className="text-[9px] text-[#6B7280]">
                <kbd className="px-1.5 py-0.5 bg-white/5 rounded text-[8px]">Esc</kbd> cerrar
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
