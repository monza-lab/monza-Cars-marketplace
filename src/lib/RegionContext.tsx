"use client"

import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import { resolveRegion, REGION_CURRENCY } from "./regionPricing"
import type { Region } from "./curatedCars"

type RegionContextType = {
  selectedRegion: string | null
  setSelectedRegion: (region: string | null) => void
  effectiveRegion: Region
  currency: string
}

const RegionContext = createContext<RegionContextType>({
  selectedRegion: null,
  setSelectedRegion: () => {},
  effectiveRegion: "US",
  currency: "$",
})

export function RegionProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const derived = useMemo(() => {
    const effectiveRegion = resolveRegion(selectedRegion)
    const currency = REGION_CURRENCY[effectiveRegion]
    return { effectiveRegion, currency }
  }, [selectedRegion])

  return (
    <RegionContext.Provider value={{ selectedRegion, setSelectedRegion, ...derived }}>
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion() {
  return useContext(RegionContext)
}
