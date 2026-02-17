"use client"

import { useState, useMemo } from "react"
import { motion, AnimatePresence } from "framer-motion"
import {
  Search,
  ChevronDown,
  X,
  Gauge,
  DollarSign,
  Check,
  Shield,
  Sparkles,
  ChevronUp,
} from "lucide-react"
import { SearchWithAutocomplete } from "./SearchWithAutocomplete"

// ─── MODEL FAMILIES DATA (from model_family column) ───
const MODEL_FAMILIES = [
  { id: "911", label: "911", count: 200 },
  { id: "cayenne", label: "Cayenne", count: 42 },
  { id: "macan", label: "Macan", count: 14 },
  { id: "taycan", label: "Taycan", count: 14 },
  { id: "panamera", label: "Panamera", count: 31 },
  { id: "boxster", label: "Boxster", count: 7 },
  { id: "cayman", label: "Cayman", count: 6 },
  { id: "classics", label: "Clásicos", count: 32 },
]

// Generaciones por familia (contextual)
const GENERATIONS_BY_FAMILY: Record<string, typeof GENERATIONS> = {
  "911": [
    { id: "992", label: "992 (2020-2026)", count: 87 },
    { id: "991", label: "991 (2012-2019)", count: 145 },
    { id: "997", label: "997 (2005-2012)", count: 98 },
    { id: "996", label: "996 (1999-2004)", count: 76 },
    { id: "993", label: "993 (1995-1998)", count: 45 },
    { id: "964", label: "964 (1989-1994)", count: 32 },
    { id: "f-body", label: "F-body (1964-1973)", count: 25 },
  ],
  "cayenne": [
    { id: "e3", label: "E3 (2019-2024)", count: 20 },
    { id: "e2", label: "E2 (2011-2018)", count: 15 },
    { id: "e1", label: "E1 (2003-2010)", count: 7 },
  ],
  "taycan": [
    { id: "j1", label: "J1 (2020+)", count: 14 },
  ],
  "macan": [
    { id: "95b-2", label: "95B.2 (2024+)", count: 2 },
    { id: "95b", label: "95B (2019-2024)", count: 8 },
    { id: "95b-1", label: "95B.1 (2014-2018)", count: 4 },
  ],
  "panamera": [
    { id: "g3", label: "G3 (2024+)", count: 5 },
    { id: "g2", label: "G2 (2017-2024)", count: 18 },
    { id: "g1", label: "G1 (2010-2016)", count: 8 },
  ],
  "boxster": [
    { id: "718", label: "718 (2016+)", count: 4 },
    { id: "981", label: "981 (2012-2016)", count: 2 },
    { id: "987", label: "987 (2005-2012)", count: 1 },
  ],
  "cayman": [
    { id: "718", label: "718 (2016+)", count: 4 },
    { id: "981", label: "981 (2012-2016)", count: 1 },
    { id: "987", label: "987 (2005-2012)", count: 1 },
  ],
  "356": [
    { id: "356c", label: "356C (1963-1965)", count: 2 },
    { id: "356b", label: "356B (1959-1963)", count: 3 },
    { id: "356a", label: "356A (1955-1959)", count: 4 },
    { id: "356-pre-a", label: "Pre-A (1948-1955)", count: 5 },
  ],
  "928": [
    { id: "928-gts", label: "GTS (1992-1995)", count: 2 },
    { id: "928-gt", label: "GT (1989-1991)", count: 1 },
    { id: "928-s4", label: "S4 (1987-1991)", count: 3 },
    { id: "928-s2", label: "S/S2 (1980-1986)", count: 4 },
    { id: "928-base", label: "Base (1978-1982)", count: 2 },
  ],
  "944": [
    { id: "944-s2", label: "S2 (1989-1991)", count: 2 },
    { id: "944-turbo", label: "Turbo (1985-1991)", count: 3 },
    { id: "944-s", label: "S (1987-1988)", count: 2 },
    { id: "944-base", label: "Base (1982-1988)", count: 4 },
  ],
  "968": [
    { id: "968-cs", label: "Club Sport (1993-1995)", count: 1 },
    { id: "968-turbo-s", label: "Turbo S (1993-1994)", count: 1 },
    { id: "968-base", label: "Base (1992-1995)", count: 2 },
  ],
  "914": [
    { id: "914-2.0", label: "2.0L (1973-1976)", count: 2 },
    { id: "914-1.8", label: "1.8L (1970-1972)", count: 1 },
    { id: "914-1.7", label: "1.7L (1969-1973)", count: 2 },
  ],
  "924": [
    { id: "924-carrera-gt", label: "Carrera GT (1980-1981)", count: 1 },
    { id: "924-s", label: "S (1986-1988)", count: 1 },
    { id: "924-turbo", label: "Turbo (1979-1984)", count: 2 },
    { id: "924-base", label: "Base (1976-1988)", count: 3 },
  ],
  "Carrera GT": [
    { id: "980", label: "980 (2004-2007)", count: 1 },
  ],
  "918 Spyder": [
    { id: "918", label: "918 (2013-2015)", count: 2 },
  ],
  "718": [
    { id: "718-rsk", label: "RSK (1957-1958)", count: 1 },
    { id: "718-w-rs", label: "W-RS (1961-1962)", count: 1 },
    { id: "718-classic", label: "718/2 (1959-1960)", count: 1 },
  ],
  // Más familias se pueden agregar según necesidad
}

// ─── GENERACIONES DATA (ALL - when no family selected) ───
const GENERATIONS = [
  { id: "992", label: "992 (2020-2025)", count: 23 },
  { id: "991", label: "991 (2012-2019)", count: 45 },
  { id: "997", label: "997 (2005-2012)", count: 38 },
  { id: "996", label: "996 (1999-2004)", count: 29 },
  { id: "993", label: "993 (1995-1998)", count: 18 },
  { id: "964", label: "964 (1989-1994)", count: 12 },
]

// ─── VARIANTES POPULARES ───
const POPULAR_VARIANTS = [
  "GT3",
  "Turbo",
  "Carrera",
  "GTS",
  "Targa",
  "4S",
]

// ─── FILTER SECTION COMPONENT ───
function FilterSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
}: {
  title: string
  icon?: any
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-white/5">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-[#F8B4D9]" />}
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
            {title}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4 text-[#6B7280]" />
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-4">
              {children}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── MAIN COMPONENT ───
export function FilterSidebar() {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedFamily, setSelectedFamily] = useState<string[]>([])
  const [selectedGenerations, setSelectedGenerations] = useState<string[]>([])
  const [selectedVariants, setSelectedVariants] = useState<string[]>([])
  const [hpRange, setHpRange] = useState<[number, number]>([200, 700])
  const [priceRange, setPriceRange] = useState<[number, number]>([50, 300])
  const [onlyManual, setOnlyManual] = useState(false)
  const [onlyAWD, setOnlyAWD] = useState(false)
  const [onlyInvestmentGrade, setOnlyInvestmentGrade] = useState(false)

  const toggleFamily = (id: string) => {
    setSelectedFamily(prev => {
      const newSelection = prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
      // Reset generations when family changes
      if (newSelection.length !== prev.length) {
        setSelectedGenerations([])
      }
      return newSelection
    })
  }

  const toggleGeneration = (id: string) => {
    setSelectedGenerations(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    )
  }

  const toggleVariant = (variant: string) => {
    setSelectedVariants(prev =>
      prev.includes(variant) ? prev.filter(v => v !== variant) : [...prev, variant]
    )
  }

  // Contextual generations based on selected family
  const availableGenerations = useMemo(() => {
    if (selectedFamily.length === 0) return GENERATIONS
    if (selectedFamily.length === 1) {
      return GENERATIONS_BY_FAMILY[selectedFamily[0]] || GENERATIONS
    }
    // Multiple families selected - show all
    return GENERATIONS
  }, [selectedFamily])

  const clearAllFilters = () => {
    setSearchQuery("")
    setSelectedFamily([])
    setSelectedGenerations([])
    setSelectedVariants([])
    setHpRange([200, 700])
    setPriceRange([50, 300])
    setOnlyManual(false)
    setOnlyAWD(false)
    setOnlyInvestmentGrade(false)
  }

  const activeFiltersCount =
    selectedFamily.length +
    selectedGenerations.length +
    selectedVariants.length +
    (onlyManual ? 1 : 0) +
    (onlyAWD ? 1 : 0) +
    (onlyInvestmentGrade ? 1 : 0)

  return (
    <div className="h-full flex flex-col bg-[#0A0A0A]">
      {/* HEADER FIJO */}
      <div className="px-5 py-4 border-b border-white/5 bg-[#0A0A0A]/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="size-5 text-[#F8B4D9]" />
          <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#F8B4D9]">
            Encuentra tu Porsche
          </h3>
        </div>

        {/* BUSCADOR CON AUTOCOMPLETADO */}
        <SearchWithAutocomplete
          onSelect={(result) => {
            // When user selects a result, update filters accordingly
            setSearchQuery(result.name)
            // TODO: Future - auto-apply filters based on selection
          }}
        />
      </div>

      {/* CONTENIDO SCROLLEABLE */}
      <div className="flex-1 overflow-y-auto no-scrollbar">

        {/* FILTRO: MODELO / FAMILIA (PRIMERO - lógica del usuario) */}
        <FilterSection title="Modelo / Familia" defaultOpen={true}>
          <div className="space-y-2">
            {MODEL_FAMILIES.map((family) => (
              <button
                key={family.id}
                onClick={() => toggleFamily(family.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  selectedFamily.includes(family.id)
                    ? "bg-[#F8B4D9]/10 border border-[#F8B4D9]/30"
                    : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`size-4 rounded border flex items-center justify-center ${
                    selectedFamily.includes(family.id)
                      ? "bg-[#F8B4D9] border-[#F8B4D9]"
                      : "border-white/20"
                  }`}>
                    {selectedFamily.includes(family.id) && (
                      <Check className="size-3 text-[#0A0A0A]" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[#D1D5DB]">
                    {family.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#6B7280]">
                  {family.count}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>

        {/* FILTRO: GENERACIÓN (Contextual - se filtra según familia) */}
        <FilterSection title="Generación" defaultOpen={false}>
          <div className="space-y-2">
            {availableGenerations.map((gen) => (
              <button
                key={gen.id}
                onClick={() => toggleGeneration(gen.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                  selectedGenerations.includes(gen.id)
                    ? "bg-[#F8B4D9]/10 border border-[#F8B4D9]/30"
                    : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`size-4 rounded border flex items-center justify-center ${
                    selectedGenerations.includes(gen.id)
                      ? "bg-[#F8B4D9] border-[#F8B4D9]"
                      : "border-white/20"
                  }`}>
                    {selectedGenerations.includes(gen.id) && (
                      <Check className="size-3 text-[#0A0A0A]" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-[#D1D5DB]">
                    {gen.label}
                  </span>
                </div>
                <span className="text-[10px] font-mono text-[#6B7280]">
                  {gen.count}
                </span>
              </button>
            ))}
          </div>
        </FilterSection>

        {/* FILTRO: VARIANTE */}
        <FilterSection title="Variante" defaultOpen={true}>
          <div className="flex flex-wrap gap-2">
            {POPULAR_VARIANTS.map((variant) => (
              <button
                key={variant}
                onClick={() => toggleVariant(variant)}
                className={`px-3 py-1.5 rounded-full text-[10px] font-medium tracking-wide transition-all ${
                  selectedVariants.includes(variant)
                    ? "bg-[#F8B4D9] text-[#0A0A0A] shadow-lg shadow-[#F8B4D9]/20"
                    : "bg-white/[0.05] text-[#D1D5DB] hover:bg-white/[0.08] border border-white/10"
                }`}
              >
                {variant}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* FILTRO: RENDIMIENTO */}
        <FilterSection title="Rendimiento" icon={Gauge}>
          <div className="space-y-4">
            {/* HP Slider */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">
                  Caballos de fuerza
                </span>
                <span className="text-[10px] font-mono text-[#F8B4D9]">
                  {hpRange[0]} - {hpRange[1]} HP
                </span>
              </div>
              <div className="relative h-1.5 bg-white/[0.04] rounded-full">
                <div
                  className="absolute h-full bg-gradient-to-r from-[#F8B4D9]/40 to-[#F8B4D9]/70 rounded-full"
                  style={{
                    left: `${((hpRange[0] - 200) / 500) * 100}%`,
                    width: `${((hpRange[1] - hpRange[0]) / 500) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-[#6B7280]">200</span>
                <span className="text-[8px] text-[#6B7280]">700+</span>
              </div>
            </div>

            {/* 0-60 Info */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">
                  0-60 mph
                </span>
                <span className="text-[10px] font-mono text-[#F8B4D9]">
                  2.5s - 6.0s
                </span>
              </div>
              <div className="relative h-1.5 bg-white/[0.04] rounded-full">
                <div className="absolute h-full w-3/4 bg-gradient-to-r from-[#F8B4D9]/40 to-[#F8B4D9]/70 rounded-full" />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-[#6B7280]">2.5s</span>
                <span className="text-[8px] text-[#6B7280]">6.0s</span>
              </div>
            </div>
          </div>
        </FilterSection>

        {/* FILTRO: PRECIO */}
        <FilterSection title="Precio MSRP" icon={DollarSign}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-[#6B7280] uppercase tracking-wider">
                Rango de precio
              </span>
              <span className="text-[10px] font-mono text-[#F8B4D9]">
                ${priceRange[0]}K - ${priceRange[1]}K
              </span>
            </div>
            <div className="relative h-1.5 bg-white/[0.04] rounded-full">
              <div
                className="absolute h-full bg-gradient-to-r from-emerald-400/40 to-emerald-400/70 rounded-full"
                style={{
                  left: `${((priceRange[0] - 50) / 250) * 100}%`,
                  width: `${((priceRange[1] - priceRange[0]) / 250) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-[#6B7280]">$50K</span>
              <span className="text-[8px] text-[#6B7280]">$300K+</span>
            </div>
          </div>
        </FilterSection>

        {/* FILTRO: ESPECIFICACIONES */}
        <FilterSection title="Especificaciones" icon={Shield}>
          <div className="space-y-2.5">
            <button
              onClick={() => setOnlyManual(!onlyManual)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                onlyManual
                  ? "bg-[#F8B4D9]/10 border border-[#F8B4D9]/30"
                  : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
              }`}
            >
              <div className={`size-4 rounded border flex items-center justify-center ${
                onlyManual
                  ? "bg-[#F8B4D9] border-[#F8B4D9]"
                  : "border-white/20"
              }`}>
                {onlyManual && <Check className="size-3 text-[#0A0A0A]" />}
              </div>
              <span className="text-[11px] font-medium text-[#D1D5DB]">
                Solo manuales
              </span>
            </button>

            <button
              onClick={() => setOnlyAWD(!onlyAWD)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                onlyAWD
                  ? "bg-[#F8B4D9]/10 border border-[#F8B4D9]/30"
                  : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
              }`}
            >
              <div className={`size-4 rounded border flex items-center justify-center ${
                onlyAWD
                  ? "bg-[#F8B4D9] border-[#F8B4D9]"
                  : "border-white/20"
              }`}>
                {onlyAWD && <Check className="size-3 text-[#0A0A0A]" />}
              </div>
              <span className="text-[11px] font-medium text-[#D1D5DB]">
                Tracción AWD
              </span>
            </button>

            <button
              onClick={() => setOnlyInvestmentGrade(!onlyInvestmentGrade)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                onlyInvestmentGrade
                  ? "bg-emerald-400/10 border border-emerald-400/30"
                  : "bg-white/[0.02] border border-transparent hover:bg-white/[0.04]"
              }`}
            >
              <div className={`size-4 rounded border flex items-center justify-center ${
                onlyInvestmentGrade
                  ? "bg-emerald-400 border-emerald-400"
                  : "border-white/20"
              }`}>
                {onlyInvestmentGrade && <Check className="size-3 text-[#0A0A0A]" />}
              </div>
              <span className="text-[11px] font-medium text-[#D1D5DB]">
                Investment Grade
              </span>
            </button>
          </div>
        </FilterSection>
      </div>

      {/* FOOTER CON BOTONES */}
      <div className="px-5 py-4 border-t border-white/5 bg-[#0A0A0A]/95 backdrop-blur-sm space-y-3">
        <div className="text-center">
          <span className="text-[10px] font-mono text-[#9CA3AF]">
            45 modelos encontrados
          </span>
        </div>

        <button className="w-full py-3 bg-gradient-to-r from-[#F8B4D9] to-[#F8B4D9]/90 rounded-lg text-[11px] font-semibold tracking-wider text-[#0A0A0A] hover:shadow-lg hover:shadow-[#F8B4D9]/30 transition-all uppercase">
          Ver Resultados
        </button>

        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="w-full py-2 bg-white/[0.03] border border-white/10 rounded-lg text-[10px] font-medium text-[#9CA3AF] hover:bg-white/[0.06] hover:text-[#F8B4D9] transition-all"
          >
            Limpiar filtros ({activeFiltersCount})
          </button>
        )}
      </div>
    </div>
  )
}
