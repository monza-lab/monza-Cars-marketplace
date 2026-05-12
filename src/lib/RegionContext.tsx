"use client"

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { resolveRegion } from "./regionPricing"
import type { Region } from "./curatedCars"

type RegionContextType = {
  selectedRegion: string | null
  setSelectedRegion: (region: string | null) => void
  effectiveRegion: Region
  /** True after we've read from localStorage on the client (avoids hydration flash). */
  isHydrated: boolean
  /** True when user has actively chosen a region (vs falling back to default). */
  hasUserChosen: boolean
}

const STORAGE_KEY = "monzahaus.region"
const VALID_REGIONS: ReadonlyArray<Region> = ["US", "EU", "UK", "JP"]

function readStoredRegion(): string | null {
  if (typeof window === "undefined") return null
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    if (raw === "all") return null
    if ((VALID_REGIONS as readonly string[]).includes(raw)) return raw
    return null
  } catch {
    return null
  }
}

function writeStoredRegion(value: string | null): void {
  if (typeof window === "undefined") return
  try {
    if (value === null) {
      window.localStorage.removeItem(STORAGE_KEY)
    } else {
      window.localStorage.setItem(STORAGE_KEY, value)
    }
  } catch {
    // silent — private mode or quota
  }
}

const RegionContext = createContext<RegionContextType>({
  selectedRegion: null,
  setSelectedRegion: () => {},
  effectiveRegion: "US",
  isHydrated: false,
  hasUserChosen: false,
})

export function RegionProvider({ children }: { children: ReactNode }) {
  const [selectedRegion, setSelectedRegionState] = useState<string | null>(null)
  const [isHydrated, setIsHydrated] = useState(false)

  useEffect(() => {
    const stored = readStoredRegion()
    if (stored) setSelectedRegionState(stored)
    setIsHydrated(true)
  }, [])

  const setSelectedRegion = useCallback((next: string | null) => {
    setSelectedRegionState(next)
    writeStoredRegion(next)
  }, [])

  const effectiveRegion = useMemo(() => resolveRegion(selectedRegion), [selectedRegion])
  const hasUserChosen = selectedRegion !== null

  const value = useMemo<RegionContextType>(
    () => ({ selectedRegion, setSelectedRegion, effectiveRegion, isHydrated, hasUserChosen }),
    [selectedRegion, setSelectedRegion, effectiveRegion, isHydrated, hasUserChosen],
  )

  return <RegionContext.Provider value={value}>{children}</RegionContext.Provider>
}

export function useRegion() {
  return useContext(RegionContext)
}
