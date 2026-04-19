"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  DollarSign,
  Calendar,
  Gauge,
  Cog,
  Palette,
  Car,
  X,
  ChevronDown,
} from "lucide-react"
import { BODY_TYPE_OPTIONS } from "@/lib/brandConfig"

export type AdvancedFilterValues = {
  priceRange: [number, number] | null
  yearRange: [number, number] | null
  mileageRanges: string[] // ["0-10k", "10k-50k", "50k-100k", "100k+"]
  transmissions: string[] // ["Manual", "Automatic"]
  bodyTypes: string[]     // ["Coupe", "Convertible", "Targa", etc.]
  colors: string[]
  statuses: string[] // ["ACTIVE", "ENDING_SOON", "ENDED"]
}

type AdvancedFiltersProps = {
  familyName: string
  onFiltersChange?: (filters: AdvancedFilterValues) => void
  minPrice?: number
  maxPrice?: number
  minYear?: number
  maxYear?: number
}

const MILEAGE_OPTIONS = [
  { id: "0-10k", label: "Under 10k miles" },
  { id: "10k-50k", label: "10k - 50k miles" },
  { id: "50k-100k", label: "50k - 100k miles" },
  { id: "100k+", label: "100k+ miles" },
]

const TRANSMISSION_OPTIONS = [
  { id: "Manual", label: "Manual" },
  { id: "Automatic", label: "Automática" },
]

const COLOR_OPTIONS = [
  "Black",
  "White",
  "Silver",
  "Gray",
  "Red",
  "Blue",
  "Green",
  "Yellow",
  "Orange",
]

const STATUS_OPTIONS = [
  { id: "ACTIVE", label: "Live" },
  { id: "ENDING_SOON", label: "Ending Soon" },
  { id: "ENDED", label: "Sold / Ended" },
]

export function AdvancedFilters({
  familyName,
  onFiltersChange,
  minPrice = 0,
  maxPrice = 1000000,
  minYear = 1960,
  maxYear = 2026,
}: AdvancedFiltersProps) {
  const [priceRange, setPriceRange] = useState<[number, number]>([minPrice, maxPrice])
  const [yearRange, setYearRange] = useState<[number, number]>([minYear, maxYear])
  const [selectedMileage, setSelectedMileage] = useState<string[]>([])
  const [selectedTransmissions, setSelectedTransmissions] = useState<string[]>([])
  const [selectedColors, setSelectedColors] = useState<string[]>([])
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([])
  const [selectedBodyTypes, setSelectedBodyTypes] = useState<string[]>([])
  const onFiltersChangeRef = useRef(onFiltersChange)
  onFiltersChangeRef.current = onFiltersChange

  // Notify parent of filter changes
  useEffect(() => {
    if (onFiltersChangeRef.current) {
      onFiltersChangeRef.current({
        priceRange: priceRange[0] === minPrice && priceRange[1] === maxPrice ? null : priceRange,
        yearRange: yearRange[0] === minYear && yearRange[1] === maxYear ? null : yearRange,
        mileageRanges: selectedMileage,
        transmissions: selectedTransmissions,
        bodyTypes: selectedBodyTypes,
        colors: selectedColors,
        statuses: selectedStatuses,
      })
    }
  }, [priceRange, yearRange, selectedMileage, selectedTransmissions, selectedBodyTypes, selectedColors, selectedStatuses, minPrice, maxPrice, minYear, maxYear])

  const hasActiveFilters =
    priceRange[0] !== minPrice ||
    priceRange[1] !== maxPrice ||
    yearRange[0] !== minYear ||
    yearRange[1] !== maxYear ||
    selectedMileage.length > 0 ||
    selectedTransmissions.length > 0 ||
    selectedBodyTypes.length > 0 ||
    selectedColors.length > 0 ||
    selectedStatuses.length > 0

  const clearAllFilters = () => {
    setPriceRange([minPrice, maxPrice])
    setYearRange([minYear, maxYear])
    setSelectedMileage([])
    setSelectedTransmissions([])
    setSelectedBodyTypes([])
    setSelectedColors([])
    setSelectedStatuses([])
  }

  const toggleItem = (item: string, list: string[], setter: (list: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item))
    } else {
      setter([...list, item])
    }
  }

  return (
    <div className="h-full flex flex-col bg-card">
      {/* Header */}
      <div className="px-5 py-2.5 border-b border-border">
        <div className="flex items-center justify-between">
          <h3 className="text-[9px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
            Filtros
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[10px] text-primary hover:text-foreground transition-colors"
            >
              <X className="size-3" />
              Limpiar todo
            </button>
          )}
        </div>
      </div>

      {/* Scrollable filters */}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        {/* Price Range */}
        <FilterSection icon={DollarSign} title="Precio" hasSelection={priceRange[0] !== minPrice || priceRange[1] !== maxPrice}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">${(priceRange[0] / 1000).toFixed(0)}k</span>
              <span className="text-foreground tabular-nums">${(priceRange[1] / 1000).toFixed(0)}k</span>
            </div>
            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              step={10000}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
              className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </FilterSection>

        {/* Year Range */}
        <FilterSection icon={Calendar} title="Año" hasSelection={yearRange[0] !== minYear || yearRange[1] !== maxYear}>
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">{yearRange[0]}</span>
              <span className="text-foreground tabular-nums">{yearRange[1]}</span>
            </div>
            <input
              type="range"
              min={minYear}
              max={maxYear}
              step={1}
              value={yearRange[1]}
              onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
              className="w-full h-1 bg-foreground/10 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </FilterSection>

        {/* Mileage */}
        <FilterSection icon={Gauge} title="Mileage" hasSelection={selectedMileage.length > 0}>
          <div className="space-y-2">
            {MILEAGE_OPTIONS.map((option) => (
              <CheckboxOption
                key={option.id}
                label={option.label}
                checked={selectedMileage.includes(option.id)}
                onChange={() => toggleItem(option.id, selectedMileage, setSelectedMileage)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Transmission */}
        <FilterSection icon={Cog} title="Transmisión" hasSelection={selectedTransmissions.length > 0}>
          <div className="space-y-2">
            {TRANSMISSION_OPTIONS.map((option) => (
              <CheckboxOption
                key={option.id}
                label={option.label}
                checked={selectedTransmissions.includes(option.id)}
                onChange={() => toggleItem(option.id, selectedTransmissions, setSelectedTransmissions)}
              />
            ))}
          </div>
        </FilterSection>

        {/* Body Type */}
        <FilterSection icon={Car} title="Carrocería" hasSelection={selectedBodyTypes.length > 0}>
          <div className="flex flex-wrap gap-2">
            {BODY_TYPE_OPTIONS.map((bt) => (
              <button
                key={bt.id}
                onClick={() => toggleItem(bt.id, selectedBodyTypes, setSelectedBodyTypes)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedBodyTypes.includes(bt.id)
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                }`}
              >
                {bt.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Color */}
        <FilterSection icon={Palette} title="Color" hasSelection={selectedColors.length > 0}>
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => toggleItem(color, selectedColors, setSelectedColors)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedColors.includes(color)
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Status */}
        <FilterSection icon={Calendar} title="Estado" hasSelection={selectedStatuses.length > 0}>
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.id}
                onClick={() => toggleItem(status.id, selectedStatuses, setSelectedStatuses)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedStatuses.includes(status.id)
                    ? "bg-primary/15 text-primary border border-primary/30"
                    : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </FilterSection>

      </div>
    </div>
  )
}

function FilterSection({
  icon: Icon,
  title,
  children,
  hasSelection = false,
}: {
  icon: any
  title: string
  children: React.ReactNode
  hasSelection?: boolean
}) {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <div className="border-b border-border">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-3 flex items-center gap-2 hover:bg-foreground/2 transition-colors"
      >
        <Icon className="size-3.5 text-primary" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground flex-1 text-left">
          {title}
        </span>
        {hasSelection && (
          <span className="size-1.5 rounded-full bg-primary" />
        )}
        <ChevronDown className={`size-3 text-muted-foreground transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`} />
      </button>
      {isOpen && (
        <div className="px-5 pb-3">
          {children}
        </div>
      )}
    </div>
  )
}

function CheckboxOption({
  label,
  checked,
  onChange,
}: {
  label: string
  checked: boolean
  onChange: () => void
}) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <div
        className={`size-4 rounded border-2 flex items-center justify-center transition-all ${
          checked
            ? "bg-primary border-primary"
            : "bg-transparent border-border/80 group-hover:border-border"
        }`}
      >
        {checked && (
          <svg className="size-3 text-primary-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-[11px] ${checked ? "text-foreground" : "text-muted-foreground group-hover:text-muted-foreground"}`}>
        {label}
      </span>
    </label>
  )
}
