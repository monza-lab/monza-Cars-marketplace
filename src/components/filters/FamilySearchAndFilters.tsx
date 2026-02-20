"use client"

import { useState, useRef, useEffect } from "react"
import { Search, X, ChevronDown } from "lucide-react"
import { motion, AnimatePresence } from "framer-motion"

type FamilySearchAndFiltersProps = {
  familyName: string
  totalCars: number
  hideSearch?: boolean
  onSearchChange?: (query: string) => void
  onFilterChange?: (filters: FamilyFilters) => void
}

export type FamilyFilters = {
  searchQuery: string
  selectedGenerations: string[]
  yearRange: [number, number] | null
  priceRange: [number, number] | null
  mileageRanges?: string[]
  transmissions?: string[]
  colors?: string[]
  statuses?: string[]
  grades?: string[]
}

// Generaciones por familia (mismo data que FilterSidebar)
const GENERATIONS_BY_FAMILY: Record<string, Array<{ id: string; label: string }>> = {
  "911": [
    { id: "992", label: "992 (2020-2026)" },
    { id: "991", label: "991 (2012-2019)" },
    { id: "997", label: "997 (2005-2012)" },
    { id: "996", label: "996 (1999-2004)" },
    { id: "993", label: "993 (1995-1998)" },
    { id: "964", label: "964 (1989-1994)" },
    { id: "930", label: "930 (1975-1989)" },
  ],
  "Cayenne": [
    { id: "e3", label: "E3 (2019-2024)" },
    { id: "e2", label: "E2 (2011-2018)" },
    { id: "e1", label: "E1 (2003-2010)" },
  ],
  "Taycan": [
    { id: "j1", label: "J1 (2020+)" },
  ],
  "Macan": [
    { id: "95b-2", label: "95B.2 (2024+)" },
    { id: "95b", label: "95B (2019-2024)" },
    { id: "95b-1", label: "95B.1 (2014-2018)" },
  ],
  "Panamera": [
    { id: "g3", label: "G3 (2024+)" },
    { id: "g2", label: "G2 (2017-2024)" },
    { id: "g1", label: "G1 (2010-2016)" },
  ],
  "Boxster": [
    { id: "718", label: "718 (2016+)" },
    { id: "981", label: "981 (2012-2016)" },
    { id: "987", label: "987 (2005-2012)" },
  ],
  "Cayman": [
    { id: "718", label: "718 (2016+)" },
    { id: "981", label: "981 (2012-2016)" },
    { id: "987", label: "987 (2005-2012)" },
  ],
  "356": [
    { id: "356c", label: "356C (1963-1965)" },
    { id: "356b", label: "356B (1959-1963)" },
    { id: "356a", label: "356A (1955-1959)" },
    { id: "356-pre-a", label: "Pre-A (1948-1955)" },
  ],
  "928": [
    { id: "928-gts", label: "GTS (1992-1995)" },
    { id: "928-gt", label: "GT (1989-1991)" },
    { id: "928-s4", label: "S4 (1987-1991)" },
    { id: "928-s2", label: "S/S2 (1980-1986)" },
    { id: "928-base", label: "Base (1978-1982)" },
  ],
  "944": [
    { id: "944-s2", label: "S2 (1989-1991)" },
    { id: "944-turbo", label: "Turbo (1985-1991)" },
    { id: "944-s", label: "S (1987-1988)" },
    { id: "944-base", label: "Base (1982-1988)" },
  ],
  "968": [
    { id: "968-cs", label: "Club Sport (1993-1995)" },
    { id: "968-turbo-s", label: "Turbo S (1993-1994)" },
    { id: "968-base", label: "Base (1992-1995)" },
  ],
  "914": [
    { id: "914-2.0", label: "2.0L (1973-1976)" },
    { id: "914-1.8", label: "1.8L (1970-1972)" },
    { id: "914-1.7", label: "1.7L (1969-1973)" },
  ],
  "924": [
    { id: "924-carrera-gt", label: "Carrera GT (1980-1981)" },
    { id: "924-s", label: "S (1986-1988)" },
    { id: "924-turbo", label: "Turbo (1979-1984)" },
    { id: "924-base", label: "Base (1976-1988)" },
  ],
  "Carrera GT": [
    { id: "980", label: "980 (2004-2007)" },
  ],
  "918 Spyder": [
    { id: "918", label: "918 (2013-2015)" },
  ],
  "718": [
    { id: "718-rsk", label: "RSK (1957-1958)" },
    { id: "718-w-rs", label: "W-RS (1961-1962)" },
    { id: "718-classic", label: "718/2 (1959-1960)" },
  ],
}

// Variantes populares por familia (para autocomplete)
const VARIANTS_BY_FAMILY: Record<string, string[]> = {
  "911": ["Turbo", "GT3", "Carrera", "GTS", "Targa", "4S", "Speedster", "GT2", "Sport Classic"],
  "Cayenne": ["Turbo", "S", "GTS", "E-Hybrid", "Coupe"],
  "Macan": ["S", "GTS", "Turbo", "4"],
  "Taycan": ["Turbo S", "4S", "GTS", "Cross Turismo"],
  "Panamera": ["Turbo", "4S", "GTS", "E-Hybrid"],
  "Boxster": ["S", "GTS", "Spyder", "T", "25 Years"],
  "Cayman": ["S", "GTS", "GT4", "T", "R"],
  "356": ["A", "B", "C", "Carrera", "Speedster", "Roadster"],
  "928": ["S", "S4", "GT", "GTS"],
  "944": ["S", "Turbo", "S2"],
  "968": ["Sport", "Club Sport", "Turbo S"],
  "914": ["/4", "/6", "2.0"],
  "924": ["Turbo", "S", "Carrera GT"],
  "718": ["RSK", "W-RS", "718/2"],
  "Carrera GT": ["Standard"],
  "918 Spyder": ["Standard", "Weissach"],
}

export function FamilySearchAndFilters({
  familyName,
  totalCars,
  hideSearch,
  onSearchChange,
  onFilterChange,
}: FamilySearchAndFiltersProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [isExpanded, setIsExpanded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [selectedGenerations, setSelectedGenerations] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const generations = GENERATIONS_BY_FAMILY[familyName] || []
  const variants = VARIANTS_BY_FAMILY[familyName] || []

  // Fuzzy search para sugerencias (incluye nombre completo de familia)
  const suggestions = searchQuery.trim()
    ? (() => {
        const query = searchQuery.toLowerCase()
        const fullName = `Porsche ${familyName}`
        const results: string[] = []

        // Si coincide con "Porsche" o el nombre de la familia, agregar nombre completo
        if (fullName.toLowerCase().includes(query)) {
          results.push(familyName)
        }

        // Agregar variantes que coincidan
        const matchingVariants = variants.filter(v =>
          v.toLowerCase().includes(query)
        )
        results.push(...matchingVariants)

        return results.slice(0, 5)
      })()
    : []

  const handleSearchChange = (value: string) => {
    setSearchQuery(value)
    setShowSuggestions(value.trim().length > 0)
    if (onSearchChange) {
      onSearchChange(value)
    }
  }

  const clearSearch = () => {
    setSearchQuery("")
    setShowSuggestions(false)
    if (onSearchChange) {
      onSearchChange("")
    }
  }

  const selectSuggestion = (variant: string) => {
    setSearchQuery(variant)
    setShowSuggestions(false)
    if (onSearchChange) {
      onSearchChange(variant)
    }
  }

  const toggleGeneration = (genId: string) => {
    setSelectedGenerations(prev =>
      prev.includes(genId) ? prev.filter(g => g !== genId) : [...prev, genId]
    )
  }

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        setShowSuggestions(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  // Notify parent of filter changes
  useEffect(() => {
    if (onFilterChange) {
      onFilterChange({
        searchQuery,
        selectedGenerations,
        yearRange: null,
        priceRange: null,
      })
    }
  }, [searchQuery, selectedGenerations, onFilterChange])

  return (
    <div className="border-b border-white/5 bg-[#0A0A0A]/95 backdrop-blur-xl">
      {/* Header con título de familia */}
      <div className="px-5 py-3 border-b border-white/5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-[#FFFCF7]">{familyName}</h3>
            <p className="text-[10px] text-[#6B7280] mt-0.5">
              {totalCars} {totalCars === 1 ? "carro" : "carros"} disponibles
            </p>
          </div>
        </div>
      </div>

      <div className="px-5 py-3">
        {/* Buscador contextual */}
        {!hideSearch && (
          <div className="relative mb-3" ref={inputRef}>
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-[#6B7280]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearchChange(e.target.value)}
              placeholder={`Buscar variantes (Turbo, GT3, Carrera...)...`}
              className="w-full bg-white/[0.03] border border-white/10 rounded-xl pl-10 pr-10 py-2.5 text-[12px] text-[#FFFCF7] placeholder:text-[#6B7280] focus:outline-none focus:border-[rgba(248,180,217,0.3)] transition-colors"
            />
            {searchQuery && (
              <button
                onClick={clearSearch}
                className="absolute right-3 top-1/2 -translate-y-1/2 size-5 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
              >
                <X className="size-3 text-[#6B7280]" />
              </button>
            )}

            {/* Autocomplete dropdown */}
            <AnimatePresence>
              {showSuggestions && suggestions.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full left-0 right-0 mt-1 bg-[#0A0A0A]/98 backdrop-blur-xl border border-white/10 rounded-xl overflow-hidden z-50 shadow-2xl"
                >
                  {suggestions.map((variant, idx) => {
                    // Si es el nombre de la familia, mostrar "Porsche [familia]"
                    const isFullName = variant === familyName
                    return (
                      <button
                        key={idx}
                        onClick={() => selectSuggestion(isFullName ? `Porsche ${variant}` : variant)}
                        className="w-full px-4 py-2.5 text-left text-[11px] text-[#FFFCF7] hover:bg-[rgba(248,180,217,0.08)] transition-colors border-b border-white/5 last:border-b-0"
                      >
                        {isFullName ? (
                          <>
                            Porsche <span className="text-[#F8B4D9]">{variant}</span>
                          </>
                        ) : (
                          <>
                            {familyName} <span className="text-[#F8B4D9]">{variant}</span>
                          </>
                        )}
                      </button>
                    )
                  })}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}

        {/* Generation filter pills */}
        {generations.length > 1 && (
          <div className="mt-3 space-y-2">
            <p className="text-[9px] text-[#6B7280] uppercase tracking-wider">
              Generación
            </p>
            <div className="flex flex-wrap gap-1.5">
              {generations.map(gen => (
                <button
                  key={gen.id}
                  onClick={() => toggleGeneration(gen.id)}
                  className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all ${
                    selectedGenerations.includes(gen.id)
                      ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.3)]"
                      : "bg-white/[0.03] text-[#6B7280] border border-white/10 hover:border-white/20"
                  }`}
                >
                  {gen.label}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Hint para descubrir análisis */}
      {!hideSearch && (
        <div className="px-5 py-2 bg-[rgba(248,180,217,0.03)] border-t border-[rgba(248,180,217,0.1)]">
          <p className="text-[9px] text-[#6B7280] text-center">
            ↓ Scroll para ver análisis de mercado, precios y más
          </p>
        </div>
      )}
    </div>
  )
}
