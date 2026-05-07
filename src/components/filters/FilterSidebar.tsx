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
  Scale,
  ChevronUp,
} from "lucide-react"
import { SearchWithAutocomplete } from "./SearchWithAutocomplete"

// ─── MODEL FAMILIES DATA (ordered by enthusiast prestige: icons → sports → cult → daily) ───
const MODEL_FAMILIES = [
  // Icons & Flagships
  { id: "911", label: "911", count: 200 },
  { id: "918-spyder", label: "918 Spyder", count: 2 },
  { id: "carrera-gt", label: "Carrera GT", count: 1 },
  { id: "959", label: "959", count: 2 },
  // Heritage
  { id: "356", label: "356", count: 14 },
  // Sports Cars
  { id: "cayman", label: "Cayman", count: 6 },
  { id: "boxster", label: "Boxster", count: 7 },
  // Special Builds
  { id: "backdates", label: "Backdates / Restomod", count: 5 },
  // Transaxle Classics
  { id: "928", label: "928", count: 12 },
  { id: "944", label: "944", count: 11 },
  { id: "968", label: "968", count: 4 },
  { id: "924", label: "924", count: 7 },
  { id: "914", label: "914", count: 5 },
]

// Generaciones por familia (contextual)
const GENERATIONS_BY_FAMILY: Record<string, typeof GENERATIONS> = {
  "911": [
    { id: "992", label: "992 (2019+)", count: 87 },
    { id: "991", label: "991 (2011-2019)", count: 145 },
    { id: "997", label: "997 (2004-2012)", count: 98 },
    { id: "996", label: "996 (1997-2005)", count: 76 },
    { id: "993", label: "993 (1993-1998)", count: 45 },
    { id: "964", label: "964 (1989-1994)", count: 32 },
    { id: "930", label: "930 (1975-1989)", count: 12 },
    { id: "g-model", label: "G-Model (1974-1989)", count: 18 },
    { id: "f-model", label: "F-Model (1963-1973)", count: 15 },
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
  "carrera-gt": [
    { id: "980", label: "980 (2004-2006)", count: 1 },
  ],
  "918-spyder": [
    { id: "918", label: "918 (2013-2015)", count: 2 },
  ],
  "959": [
    { id: "959", label: "959 (1986-1993)", count: 2 },
  ],
  "backdates": [
    { id: "backdate-singer", label: "Singer", count: 2 },
    { id: "backdate-ruf", label: "RUF", count: 1 },
    { id: "backdate-other", label: "Other Restomod", count: 2 },
  ],
}

// ─── GENERACIONES DATA (ALL - when no family selected, shows 911 eras) ───
const GENERATIONS = [
  { id: "992", label: "992 (2019+)", count: 87 },
  { id: "991", label: "991 (2011-2019)", count: 145 },
  { id: "997", label: "997 (2004-2012)", count: 98 },
  { id: "996", label: "996 (1997-2005)", count: 76 },
  { id: "993", label: "993 (1993-1998)", count: 45 },
  { id: "964", label: "964 (1989-1994)", count: 32 },
  { id: "930", label: "930 (1975-1989)", count: 12 },
  { id: "g-model", label: "G-Model (1974-1989)", count: 18 },
  { id: "f-model", label: "F-Model (1963-1973)", count: 15 },
]

// ─── VARIANTES POPULARES (as Porsche enthusiasts search) ───
const POPULAR_VARIANTS = [
  "Carrera",
  "Carrera S",
  "4S",
  "GTS",
  "Turbo",
  "Turbo S",
  "GT3",
  "GT3 RS",
  "GT2 RS",
  "Targa",
  "Speedster",
  "Sport Classic",
  "R",
  "ST",
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
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-foreground/2 transition-colors"
      >
        <div className="flex items-center gap-2">
          {Icon && <Icon className="size-4 text-primary" />}
          <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            {title}
          </span>
        </div>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown className="size-4 text-muted-foreground" />
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
    <div className="h-full flex flex-col bg-background">
      {/* HEADER FIJO */}
      <div className="px-5 py-4 border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="flex items-center gap-2 mb-3">
          <Scale className="size-5 text-primary" />
          <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-primary">
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
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-foreground/2 border border-transparent hover:bg-foreground/4"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`size-4 rounded border flex items-center justify-center ${
                    selectedFamily.includes(family.id)
                      ? "bg-primary border-primary"
                      : "border-border/80"
                  }`}>
                    {selectedFamily.includes(family.id) && (
                      <Check className="size-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {family.label}
                  </span>
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
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
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-foreground/2 border border-transparent hover:bg-foreground/4"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div className={`size-4 rounded border flex items-center justify-center ${
                    selectedGenerations.includes(gen.id)
                      ? "bg-primary border-primary"
                      : "border-border/80"
                  }`}>
                    {selectedGenerations.includes(gen.id) && (
                      <Check className="size-3 text-primary-foreground" />
                    )}
                  </div>
                  <span className="text-[11px] font-medium text-muted-foreground">
                    {gen.label}
                  </span>
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">
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
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                    : "bg-white/[0.05] text-muted-foreground hover:bg-foreground/8 border border-border"
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
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  Caballos de fuerza
                </span>
                <span className="text-[10px] tabular-nums text-primary">
                  {hpRange[0]} - {hpRange[1]} HP
                </span>
              </div>
              <div className="relative h-1.5 bg-foreground/4 rounded-full">
                <div
                  className="absolute h-full bg-gradient-to-r from-primary/40 to-primary/70 rounded-full"
                  style={{
                    left: `${((hpRange[0] - 200) / 500) * 100}%`,
                    width: `${((hpRange[1] - hpRange[0]) / 500) * 100}%`,
                  }}
                />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground">200</span>
                <span className="text-[8px] text-muted-foreground">700+</span>
              </div>
            </div>

            {/* 0-60 Info */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                  0-60 mph
                </span>
                <span className="text-[10px] tabular-nums text-primary">
                  2.5s - 6.0s
                </span>
              </div>
              <div className="relative h-1.5 bg-foreground/4 rounded-full">
                <div className="absolute h-full w-3/4 bg-gradient-to-r from-primary/40 to-primary/70 rounded-full" />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground">2.5s</span>
                <span className="text-[8px] text-muted-foreground">6.0s</span>
              </div>
            </div>
          </div>
        </FilterSection>

        {/* FILTRO: PRECIO */}
        <FilterSection title="Precio MSRP" icon={DollarSign}>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] text-muted-foreground uppercase tracking-wider">
                Rango de precio
              </span>
              <span className="text-[10px] tabular-nums text-primary">
                ${priceRange[0]}K - ${priceRange[1]}K
              </span>
            </div>
            <div className="relative h-1.5 bg-foreground/4 rounded-full">
              <div
                className="absolute h-full bg-gradient-to-r from-emerald-400/40 to-emerald-400/70 rounded-full"
                style={{
                  left: `${((priceRange[0] - 50) / 250) * 100}%`,
                  width: `${((priceRange[1] - priceRange[0]) / 250) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[8px] text-muted-foreground">$50K</span>
              <span className="text-[8px] text-muted-foreground">$300K+</span>
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
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-foreground/2 border border-transparent hover:bg-foreground/4"
              }`}
            >
              <div className={`size-4 rounded border flex items-center justify-center ${
                onlyManual
                  ? "bg-primary border-primary"
                  : "border-border/80"
              }`}>
                {onlyManual && <Check className="size-3 text-primary-foreground" />}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Solo manuales
              </span>
            </button>

            <button
              onClick={() => setOnlyAWD(!onlyAWD)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                onlyAWD
                  ? "bg-primary/10 border border-primary/30"
                  : "bg-foreground/2 border border-transparent hover:bg-foreground/4"
              }`}
            >
              <div className={`size-4 rounded border flex items-center justify-center ${
                onlyAWD
                  ? "bg-primary border-primary"
                  : "border-border/80"
              }`}>
                {onlyAWD && <Check className="size-3 text-primary-foreground" />}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Tracción AWD
              </span>
            </button>

            <button
              onClick={() => setOnlyInvestmentGrade(!onlyInvestmentGrade)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                onlyInvestmentGrade
                  ? "bg-positive/10 border border-positive/30"
                  : "bg-foreground/2 border border-transparent hover:bg-foreground/4"
              }`}
            >
              <div className={`size-4 rounded border flex items-center justify-center ${
                onlyInvestmentGrade
                  ? "bg-positive border-positive"
                  : "border-border/80"
              }`}>
                {onlyInvestmentGrade && <Check className="size-3 text-primary-foreground" />}
              </div>
              <span className="text-[11px] font-medium text-muted-foreground">
                Investment Grade
              </span>
            </button>
          </div>
        </FilterSection>
      </div>

      {/* FOOTER CON BOTONES */}
      <div className="px-5 py-4 border-t border-border bg-background/95 backdrop-blur-sm space-y-3">
        <div className="text-center">
          <span className="text-[10px] tabular-nums text-muted-foreground">
            45 modelos encontrados
          </span>
        </div>

        <button className="w-full py-3 bg-gradient-to-r from-primary to-primary/90 rounded-lg text-[11px] font-semibold tracking-wider text-primary-foreground hover:shadow-lg hover:shadow-primary/30 transition-all uppercase">
          Ver Resultados
        </button>

        {activeFiltersCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="w-full py-2 bg-foreground/3 border border-border rounded-lg text-[10px] font-medium text-muted-foreground hover:bg-foreground/6 hover:text-primary transition-all"
          >
            Limpiar filtros ({activeFiltersCount})
          </button>
        )}
      </div>
    </div>
  )
}
