"use client"

import { createContext, useContext, useState, useMemo, type ReactNode } from "react"
import { resolveRegion } from "./regionPricing"
import type { Region } from "./curatedCars"

type RegionContextType = {
  selectedRegion: string | null
  setSelectedRegion: (region: string | null) => void
  effectiveRegion: Region
}

const RegionContext = createContext<RegionContextType>({
  selectedRegion: null,
  setSelectedRegion: () => {},
  effectiveRegion: "US",
})

export function RegionProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegion] = useState<string | null>(null)
  const effectiveRegion = useMemo(() => resolveRegion(selectedRegion), [selectedRegion])

  return (
    <RegionContext.Provider value={{ selectedRegion, setSelectedRegion, effectiveRegion }}>
      {children}
    </RegionContext.Provider>
  )
}

export function useRegion() {
  return useContext(RegionContext)
}
