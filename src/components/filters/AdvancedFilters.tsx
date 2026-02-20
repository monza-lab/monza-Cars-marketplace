"use client"

import { useState, useEffect, useRef } from "react"
import { motion } from "framer-motion"
import {
  DollarSign,
  Calendar,
  Gauge,
  Cog,
  Palette,
  Award,
  X,
  ChevronDown,
} from "lucide-react"

export type AdvancedFilterValues = {
  priceRange: [number, number] | null
  yearRange: [number, number] | null
  mileageRanges: string[] // ["0-10k", "10k-50k", "50k-100k", "100k+"]
  transmissions: string[] // ["Manual", "Automatic"]
  colors: string[]
  statuses: string[] // ["ACTIVE", "ENDING_SOON", "ENDED"]
  grades: string[] // ["AAA", "AA", "A"]
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
  { id: "ENDED", label: "Ended" },
]

const GRADE_OPTIONS = [
  { id: "AAA", label: "AAA" },
  { id: "AA", label: "AA" },
  { id: "A", label: "A" },
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
  const [selectedGrades, setSelectedGrades] = useState<string[]>([])
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
        colors: selectedColors,
        statuses: selectedStatuses,
        grades: selectedGrades,
      })
    }
  }, [priceRange, yearRange, selectedMileage, selectedTransmissions, selectedColors, selectedStatuses, selectedGrades, minPrice, maxPrice, minYear, maxYear])

  const hasActiveFilters =
    priceRange[0] !== minPrice ||
    priceRange[1] !== maxPrice ||
    yearRange[0] !== minYear ||
    yearRange[1] !== maxYear ||
    selectedMileage.length > 0 ||
    selectedTransmissions.length > 0 ||
    selectedColors.length > 0 ||
    selectedStatuses.length > 0 ||
    selectedGrades.length > 0

  const clearAllFilters = () => {
    setPriceRange([minPrice, maxPrice])
    setYearRange([minYear, maxYear])
    setSelectedMileage([])
    setSelectedTransmissions([])
    setSelectedColors([])
    setSelectedStatuses([])
    setSelectedGrades([])
  }

  const toggleItem = (item: string, list: string[], setter: (list: string[]) => void) => {
    if (list.includes(item)) {
      setter(list.filter(i => i !== item))
    } else {
      setter([...list, item])
    }
  }

  return (
    <div className="h-full flex flex-col bg-[rgba(15,14,22,0.5)]">
      {/* Header */}
      <div className="px-5 py-4 border-b border-white/5">
        <div className="flex items-center justify-between">
          <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
            Filtros Avanzados
          </h3>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="flex items-center gap-1 text-[10px] text-[#F8B4D9] hover:text-[#FFFCF7] transition-colors"
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
        <FilterSection icon={DollarSign} title="Precio">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#6B7280]">${(priceRange[0] / 1000).toFixed(0)}k</span>
              <span className="text-[#FFFCF7] font-mono">${(priceRange[1] / 1000).toFixed(0)}k</span>
            </div>
            <input
              type="range"
              min={minPrice}
              max={maxPrice}
              step={10000}
              value={priceRange[1]}
              onChange={(e) => setPriceRange([priceRange[0], parseInt(e.target.value)])}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </FilterSection>

        {/* Year Range */}
        <FilterSection icon={Calendar} title="Año">
          <div className="space-y-3">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-[#6B7280]">{yearRange[0]}</span>
              <span className="text-[#FFFCF7] font-mono">{yearRange[1]}</span>
            </div>
            <input
              type="range"
              min={minYear}
              max={maxYear}
              step={1}
              value={yearRange[1]}
              onChange={(e) => setYearRange([yearRange[0], parseInt(e.target.value)])}
              className="w-full h-1 bg-white/10 rounded-lg appearance-none cursor-pointer slider"
            />
          </div>
        </FilterSection>

        {/* Mileage */}
        <FilterSection icon={Gauge} title="Mileage">
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
        <FilterSection icon={Cog} title="Transmisión">
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

        {/* Color */}
        <FilterSection icon={Palette} title="Color">
          <div className="flex flex-wrap gap-2">
            {COLOR_OPTIONS.map((color) => (
              <button
                key={color}
                onClick={() => toggleItem(color, selectedColors, setSelectedColors)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedColors.includes(color)
                    ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.3)]"
                    : "bg-white/[0.03] text-[#6B7280] border border-white/10 hover:border-white/20"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Status */}
        <FilterSection icon={Calendar} title="Estado">
          <div className="flex flex-wrap gap-2">
            {STATUS_OPTIONS.map((status) => (
              <button
                key={status.id}
                onClick={() => toggleItem(status.id, selectedStatuses, setSelectedStatuses)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all ${
                  selectedStatuses.includes(status.id)
                    ? "bg-[rgba(248,180,217,0.15)] text-[#F8B4D9] border border-[rgba(248,180,217,0.3)]"
                    : "bg-white/[0.03] text-[#6B7280] border border-white/10 hover:border-white/20"
                }`}
              >
                {status.label}
              </button>
            ))}
          </div>
        </FilterSection>

        {/* Investment Grade */}
        <FilterSection icon={Award} title="Investment Grade">
          <div className="flex flex-wrap gap-2">
            {GRADE_OPTIONS.map((grade) => (
              <button
                key={grade.id}
                onClick={() => toggleItem(grade.id, selectedGrades, setSelectedGrades)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold tracking-wider transition-all ${
                  selectedGrades.includes(grade.id)
                    ? grade.id === "AAA"
                      ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                      : grade.id === "AA"
                        ? "bg-blue-500/20 text-blue-300 border border-blue-500/30"
                        : "bg-amber-500/20 text-amber-300 border border-amber-500/30"
                    : "bg-white/[0.03] text-[#6B7280] border border-white/10 hover:border-white/20"
                }`}
              >
                {grade.label}
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
}: {
  icon: any
  title: string
  children: React.ReactNode
}) {
  return (
    <div className="px-5 py-4 border-b border-white/5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-4 text-[#F8B4D9]" />
        <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[#9CA3AF]">
          {title}
        </span>
      </div>
      {children}
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
            ? "bg-[#F8B4D9] border-[#F8B4D9]"
            : "bg-transparent border-white/20 group-hover:border-white/40"
        }`}
      >
        {checked && (
          <svg className="size-3 text-[#0b0b10]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>
      <span className={`text-[11px] ${checked ? "text-[#FFFCF7]" : "text-[#6B7280] group-hover:text-[#9CA3AF]"}`}>
        {label}
      </span>
    </label>
  )
}
