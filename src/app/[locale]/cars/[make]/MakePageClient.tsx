"use client"

import { useState, useMemo, useRef, useEffect } from "react"
import Image from "next/image"
import { Link, useRouter } from "@/i18n/navigation"
import { motion, AnimatePresence } from "framer-motion"
import {
  ArrowLeft,
  Car,
  Clock,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"
import type { LiveListingRegionTotals } from "@/lib/supabaseLiveListings"
import type { DbMarketDataRow, DbComparableRow, DbSoldRecord, DbAnalysisRow } from "@/lib/db/queries"
import { useRegion } from "@/lib/RegionContext"
import { useCurrency } from "@/lib/CurrencyContext"
import { AdvisorChat } from "@/components/advisor/AdvisorChat"
import { useAdvisorChatHandoff } from "@/components/advisor/AdvisorHandoffContext"
import { useLocale, useTranslations } from "next-intl"
import { type FamilyFilters } from "@/components/filters/FamilySearchAndFilters"
import { AdvancedFilters } from "@/components/filters/AdvancedFilters"
import { extractSeries, deriveBodyType, getSeriesVariants, matchVariant, getFamilyGroupsWithSeries, getSeriesConfig, resolveSeriesIdForFamily } from "@/lib/brandConfig"
import { isAuctionPlatform } from "@/components/dashboard/platformMapping"
import { useInfiniteAuctions } from "@/hooks/useInfiniteAuctions"
import {
  timeLeft, extractFamily, extractGenerationFromModel, aggregateModels,
  type Model,
} from "@/lib/makePageHelpers"
import {
  priceRanges, sortOptions, carSortOptions,
  GENERATIONS_BY_FAMILY,
} from "@/lib/makePageConstants"

// ─── Extracted components ───
import { SortSelector } from "@/components/makePage/SortSelector"
import { CarCard } from "@/components/makePage/CarCard"
import { CarFeedCard } from "@/components/makePage/CarFeedCard"
import { GenerationFeedCard, type GenerationAggregate } from "@/components/makePage/GenerationFeedCard"
import { ModelFeedCard } from "@/components/makePage/ModelFeedCard"
import { ModelContextPanel } from "@/components/makePage/context/ModelContextPanel"
import { GenerationContextPanel } from "@/components/makePage/context/GenerationContextPanel"
import { CarContextPanel } from "@/components/makePage/context/CarContextPanel"
import { MakePageRegionPills } from "@/components/makePage/mobile/MakePageRegionPills"
import { MobileHeroModel } from "@/components/makePage/mobile/MobileHeroModel"
import { MobileModelRow } from "@/components/makePage/mobile/MobileModelRow"
import { MobileModelContext } from "@/components/makePage/mobile/MobileModelContext"
import { MobileModelContextSheet } from "@/components/makePage/mobile/MobileModelContextSheet"
import { MobileMakeLiveAuctions } from "@/components/makePage/mobile/MobileMakeLiveAuctions"
import { MobileFilterSheet } from "@/components/makePage/mobile/MobileFilterSheet"

// ─── MAIN COMPONENT ───
export function MakePageClient({ make, liveRegionTotals, liveNowCount, dbMarketData = [], dbComparables = [], dbSoldHistory = [], dbAnalyses = [], initialFamily, initialGen, initialVariant }: {
  make: string
  liveRegionTotals?: LiveListingRegionTotals
  liveNowCount?: number
  dbMarketData?: DbMarketDataRow[]
  dbComparables?: DbComparableRow[]
  dbSoldHistory?: DbSoldRecord[]
  dbAnalyses?: DbAnalysisRow[]
  initialFamily?: string
  initialGen?: string
  initialVariant?: string
}) {
  const locale = useLocale()
  const homeHref = "/"
  const router = useRouter()
  const t = useTranslations("makePage")
  const tAuction = useTranslations("auctionDetail")
  const tStatus = useTranslations("status")

  // ─── USE REAL DB DATA (with fallback to hardcoded) ───

  // Market depth: derive from real DB data if available
  const realMarketDepth = useMemo(() => {
    if (dbMarketData.length === 0 && dbSoldHistory.length === 0) return null
    const totalSales = dbMarketData.reduce((s, m) => s + m.totalSales, 0) || dbSoldHistory.length
    const trendingUp = dbMarketData.filter(m => m.trend === "APPRECIATING").length
    const demandScore = dbMarketData.length > 0
      ? Math.min(10, Math.round((trendingUp / dbMarketData.length) * 10) + 5)
      : 7
    return {
      auctionsPerYear: totalSales,
      avgDaysToSell: 14,
      sellThroughRate: Math.min(98, 70 + demandScore * 3),
      demandScore,
    }
  }, [dbMarketData, dbSoldHistory])

  // 5-year price history: derive from real sold auctions if available
  const realPriceHistory = useMemo(() => {
    if (dbSoldHistory.length < 3) return null
    const now = new Date()
    const years = [0, 1, 2, 3, 4].map(i => now.getFullYear() - 4 + i)
    const buckets = years.map(yr => {
      const yearSales = dbSoldHistory.filter(s => {
        const d = new Date(s.date)
        return d.getFullYear() === yr
      })
      if (yearSales.length === 0) return null
      return Math.round(yearSales.reduce((sum, s) => sum + s.price, 0) / yearSales.length)
    })
    // Fill gaps with interpolation
    const filled = [...buckets]
    for (let i = 0; i < filled.length; i++) {
      if (filled[i] == null) {
        const prev = filled.slice(0, i).reverse().find(v => v != null)
        const next = filled.slice(i + 1).find(v => v != null)
        filled[i] = prev ?? next ?? 0
      }
    }
    if (filled.every(v => v === 0)) return null
    return filled as number[]
  }, [dbSoldHistory])

  // Ownership costs from DB analysis (average across analyses)
  const realOwnershipCosts = useMemo(() => {
    const withCosts = dbAnalyses.filter(a => a.insuranceEstimate || a.yearlyMaintenance)
    if (withCosts.length === 0) return null
    const avgIns = Math.round(withCosts.reduce((s, a) => s + (a.insuranceEstimate ?? 0), 0) / withCosts.length)
    const avgMaint = Math.round(withCosts.reduce((s, a) => s + (a.yearlyMaintenance ?? 0), 0) / withCosts.length)
    return { insurance: avgIns || undefined, storage: undefined, maintenance: avgMaint || undefined }
  }, [dbAnalyses])

  const [currentModelIndex, setCurrentModelIndex] = useState(0)
  const [searchQuery, setSearchQuery] = useState("")
  const { selectedRegion, setSelectedRegion, effectiveRegion } = useRegion()
  const { formatPrice, rates } = useCurrency()
  const [selectedPriceRange, setSelectedPriceRange] = useState(0)
  const [selectedPriceTier, setSelectedPriceTier] = useState("all")
  const [selectedEra, setSelectedEra] = useState("All")
  const [selectedStatus, setSelectedStatus] = useState("All")
  const [sortBy, setSortBy] = useState("price-desc")
  const [showMobileFilters, setShowMobileFilters] = useState(false)
  const [showAdvisorChat, setShowAdvisorChat] = useState(false)
  const { openChatConversationId } = useAdvisorChatHandoff()
  useEffect(() => {
    if (openChatConversationId) setShowAdvisorChat(true)
  }, [openChatConversationId])
  const [expandedModel, setExpandedModel] = useState<Model | null>(null)
  const [activeFilters, setActiveFilters] = useState<FamilyFilters | null>(null)
  const [viewMode, setViewMode] = useState<'families' | 'generations' | 'cars'>(initialFamily ? 'cars' : 'families')
  const [selectedFamilyForFeed, setSelectedFamilyForFeed] = useState<string | null>(resolveSeriesIdForFamily(make, initialFamily) ?? initialFamily ?? null)
  const [selectedGeneration, setSelectedGeneration] = useState<string | null>(initialGen || null)
  const [selectedVariantChip, setSelectedVariantChip] = useState<string | null>(initialVariant || null)
  const [feedStatusFilter, setFeedStatusFilter] = useState<"all" | "live" | "ended">("all")
  const feedRef = useRef<HTMLDivElement>(null)
  const carIndexRefs = useRef<Map<number, HTMLButtonElement>>(new Map())

  // ─── INFINITE SCROLL HOOK — replaces the old `cars` prop ───
  const {
    cars: infiniteScrollCars,
    total: infiniteTotal,
    totalCount: infiniteTotalCount,
    totalLiveCount: infiniteTotalLiveCount,
    aggregates: infiniteAggregates,
    isLoading: isLoadingCars,
    isFetchingMore,
    hasMore,
    sentinelRef,
    reset: resetInfiniteScroll,
  } = useInfiniteAuctions({
    make,
    family: selectedFamilyForFeed || undefined,
    region: selectedRegion && selectedRegion !== "all" ? selectedRegion : undefined,
    query: searchQuery || undefined,
  })

  // Derived counts for visible labels. Null while the first page is
  // in flight — UI renders '—' rather than a misleading array length.
  const displayTotal: number | null = infiniteTotalCount
  const displayLiveTotal: number | null = infiniteTotalLiveCount
  const formatCount = (n: number | null): string => (n === null ? "—" : String(n))

  // Region filtering is already handled server-side by the API (source-based).
  // No client-side re-filter needed — the API returns only cars for the selected region.
  const regionFilteredCars = infiniteScrollCars

  // Live auction cars (for left sidebar) — filtered by region + active family
  const liveCars = useMemo(() => {
    let filtered = regionFilteredCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON")
    if (selectedFamilyForFeed) {
      filtered = filtered.filter(c => extractFamily(c.model, c.year, make) === selectedFamilyForFeed)
    }
    return filtered.sort((a, b) => new Date(a.endTime).getTime() - new Date(b.endTime).getTime())
  }, [regionFilteredCars, selectedFamilyForFeed])

  // Aggregate filtered cars into models
  const allModels = useMemo(() => aggregateModels(regionFilteredCars, make, rates), [regionFilteredCars, make, rates])

  // Filter and sort models
  const filteredModels = useMemo(() => {
    let result = [...allModels]

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase()
      result = result.filter(model =>
        model.name.toLowerCase().includes(q) ||
        model.years.includes(q) ||
        model.categories.some(c => c.toLowerCase().includes(q))
      )
    }

    // Price range filter (used on mobile)
    const priceRange = priceRanges[selectedPriceRange]
    if (priceRange.min > 0 || priceRange.max < Infinity) {
      result = result.filter(model =>
        model.priceMax >= priceRange.min && model.priceMin < priceRange.max
      )
    }

    if (selectedStatus === "Live") {
      result = result.filter(model => model.liveCount > 0)
    } else if (selectedStatus === "Ended") {
      result = result.filter(model => model.liveCount === 0)
    }

    switch (sortBy) {
      case "price-desc": result.sort((a, b) => b.priceMax - a.priceMax); break
      case "price-asc": result.sort((a, b) => a.priceMin - b.priceMin); break
      case "year-desc": result.sort((a, b) => parseInt(b.years.split("–")[0]) - parseInt(a.years.split("–")[0])); break
      case "year-asc": result.sort((a, b) => parseInt(a.years.split("–")[0]) - parseInt(b.years.split("–")[0])); break
      case "count-desc": result.sort((a, b) => b.carCount - a.carCount); break
    }

    return result
  }, [allModels, searchQuery, selectedPriceTier, selectedPriceRange, selectedStatus, sortBy, selectedEra, regionFilteredCars])

  // When a family is selected via navigation, use that family's model; otherwise use scroll index
  const selectedModel = useMemo(() => {
    if (selectedFamilyForFeed) {
      const match = filteredModels.find(m => m.name === selectedFamilyForFeed)
      if (match) return match
    }
    return filteredModels[currentModelIndex] || filteredModels[0]
  }, [filteredModels, currentModelIndex, selectedFamilyForFeed])

  // Get cars for the selected family
  const familyCars = useMemo(() => {
    if (!selectedModel) return []
    return regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedModel.name)
  }, [regionFilteredCars, selectedModel, make])

  // Apply COLUMNA C filters (search + generations + advanced) to family cars
  const displayCars = useMemo(() => {
    if (!activeFilters) return familyCars

    let result = familyCars

    // Filter by search query
    if (activeFilters.searchQuery.trim()) {
      const q = activeFilters.searchQuery.toLowerCase()
      result = result.filter(car =>
        car.model.toLowerCase().includes(q)
      )
    }

    // Filter by selected generations
    if (activeFilters.selectedGenerations.length > 0) {
      result = result.filter(car => {
        const gen = extractGenerationFromModel(car.model, car.year)
        return gen && activeFilters.selectedGenerations.includes(gen)
      })
    }

    // Advanced filters
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange
      result = result.filter(car => car.currentBid >= min && car.currentBid <= max)
    }

    if (activeFilters.yearRange) {
      const [min, max] = activeFilters.yearRange
      result = result.filter(car => car.year >= min && car.year <= max)
    }

    if (activeFilters.mileageRanges && activeFilters.mileageRanges.length > 0) {
      result = result.filter(car => {
        if (!car.mileage) return false
        const mileage = car.mileage
        return activeFilters.mileageRanges!.some(range => {
          if (range === "0-10k") return mileage < 10000
          if (range === "10k-50k") return mileage >= 10000 && mileage < 50000
          if (range === "50k-100k") return mileage >= 50000 && mileage < 100000
          if (range === "100k+") return mileage >= 100000
          return false
        })
      })
    }

    if (activeFilters.transmissions && activeFilters.transmissions.length > 0) {
      result = result.filter(car => {
        if (!car.transmission) return false
        return activeFilters.transmissions!.some(t =>
          car.transmission?.toLowerCase().includes(t.toLowerCase())
        )
      })
    }

    if (activeFilters.bodyTypes && activeFilters.bodyTypes.length > 0) {
      result = result.filter(car => {
        const bt = deriveBodyType(car.model, car.trim, car.category, car.make, car.year)
        return activeFilters.bodyTypes!.includes(bt)
      })
    }

    if (activeFilters.colors && activeFilters.colors.length > 0) {
      result = result.filter(car => {
        if (!car.exteriorColor) return false
        return activeFilters.colors!.some(c =>
          car.exteriorColor?.toLowerCase().includes(c.toLowerCase())
        )
      })
    }

    if (activeFilters.statuses && activeFilters.statuses.length > 0) {
      result = result.filter(car =>
        activeFilters.statuses!.includes(car.status)
      )
    }

    return result
  }, [familyCars, activeFilters])

  // Check if filters are active
  const hasActiveFilters = activeFilters && (
    activeFilters.searchQuery.trim().length > 0 ||
    activeFilters.selectedGenerations.length > 0
  )

  // Handler: Click en familia → Mostrar generaciones
  const handleFamilyClick = (familyName: string) => {
    setSelectedFamilyForFeed(resolveSeriesIdForFamily(make, familyName) ?? familyName)
    setSelectedGeneration(null)
    setSelectedVariantChip(null)
    setFeedStatusFilter("all")
    setViewMode('cars')
    setActiveFilters(null)
    setActiveGenIndex(0)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Click en generación → Mostrar carros de esa generación
  const handleGenerationClick = (genId: string) => {
    setSelectedGeneration(genId)
    setSelectedVariantChip(null)
    setFeedStatusFilter("all")
    setViewMode('cars')
    setActiveFilters(null)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Volver a generaciones desde carros (o al landing si venimos del dashboard)
  const handleBackToGenerations = () => {
    if (initialFamily) {
      // Came from dashboard with ?family= — go back to landing
      router.push(homeHref)
      return
    }
    setSelectedGeneration(null)
    setSelectedVariantChip(null)
    setViewMode('generations')
    setActiveFilters(null)
    setActiveGenIndex(0)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Volver a vista de familias (o al landing si venimos de allá)
  const handleBackToFamilies = () => {
    if (initialFamily) {
      // User arrived from the landing page with ?family= — go back to landing
      router.push(homeHref)
      return
    }
    setViewMode('families')
    setSelectedFamilyForFeed(null)
    setSelectedGeneration(null)
    setActiveFilters(null)
    setActiveGenIndex(0)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Handler: Switch between sibling series (same family group) in Column A nav
  const handleSiblingClick = (seriesId: string) => {
    const resolvedSeriesId = resolveSeriesIdForFamily(make, seriesId) ?? seriesId
    if (resolvedSeriesId === selectedFamilyForFeed) return
    setSelectedFamilyForFeed(resolvedSeriesId)
    setSelectedGeneration(null)
    setSelectedVariantChip(null)
    setFeedStatusFilter("all")
    setViewMode('cars')
    setActiveFilters(null)
    setActiveCarIndex(0)
    if (feedRef.current) {
      feedRef.current.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Get cars for the selected family
  const familyCarsForFeed = useMemo(() => {
    if (!selectedFamilyForFeed) return []
    let result = regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedFamilyForFeed)
    // If a generation is selected, filter further
    if (selectedGeneration) {
      result = result.filter(car => {
        const gen = extractGenerationFromModel(car.model, car.year)
        return gen === selectedGeneration
      })
    }
    return result
  }, [regionFilteredCars, selectedFamilyForFeed, selectedGeneration])

  // Aggregate cars into generations for the selected family
  const familyGenerations = useMemo((): GenerationAggregate[] => {
    if (!selectedFamilyForFeed) return []
    const allFamilyCars = regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedFamilyForFeed)

    const genDefs = GENERATIONS_BY_FAMILY[selectedFamilyForFeed] || []

    // Group cars by generation
    const genMap = new Map<string, CollectorCar[]>()
    const unmatched: CollectorCar[] = []

    allFamilyCars.forEach(car => {
      const gen = extractGenerationFromModel(car.model, car.year)
      if (gen) {
        const existing = genMap.get(gen) || []
        existing.push(car)
        genMap.set(gen, existing)
      } else {
        unmatched.push(car)
      }
    })

    // Build generation aggregates (use genDefs order for known gens)
    const result: GenerationAggregate[] = []

    for (const def of genDefs) {
      const cars = genMap.get(def.id) || []
      if (cars.length === 0) continue

      const prices = cars.map(c => c.currentBid).filter(p => p > 0)
      const years = cars.map(c => c.year)
      const repCar = cars.sort((a, b) => b.currentBid - a.currentBid)[0]
      const carImage = repCar.images?.[0] || repCar.image

      result.push({
        id: def.id,
        label: def.label,
        carCount: cars.length,
        priceMin: prices.length > 0 ? Math.min(...prices) : 0,
        priceMax: prices.length > 0 ? Math.max(...prices) : 0,
        yearMin: Math.min(...years),
        yearMax: Math.max(...years),
        representativeImage: carImage || "/cars/placeholder.svg",
        representativeCar: `${repCar.year} ${repCar.model}`,
      })
    }

    // Add any generations from data not in genDefs (e.g., unknown codes)
    genMap.forEach((cars, genId) => {
      if (result.find(r => r.id === genId)) return
      const prices = cars.map(c => c.currentBid).filter(p => p > 0)
      const years = cars.map(c => c.year)
      const repCar = cars.sort((a, b) => b.currentBid - a.currentBid)[0]
      const carImage = repCar.images?.[0] || repCar.image

      result.push({
        id: genId,
        label: genId.toUpperCase(),
        carCount: cars.length,
        priceMin: prices.length > 0 ? Math.min(...prices) : 0,
        priceMax: prices.length > 0 ? Math.max(...prices) : 0,
        yearMin: Math.min(...years),
        yearMax: Math.max(...years),
        representativeImage: carImage || "/cars/placeholder.svg",
        representativeCar: `${repCar.year} ${repCar.model}`,
      })
    })

    // If there are unmatched cars, add an "Other" bucket
    if (unmatched.length > 0) {
      const prices = unmatched.map(c => c.currentBid).filter(p => p > 0)
      const years = unmatched.map(c => c.year)
      const repCar = unmatched.sort((a, b) => b.currentBid - a.currentBid)[0]
      const carImage = repCar.images?.[0] || repCar.image
      result.push({
        id: "other",
        label: "Other",
        carCount: unmatched.length,
        priceMin: prices.length > 0 ? Math.min(...prices) : 0,
        priceMax: prices.length > 0 ? Math.max(...prices) : 0,
        yearMin: Math.min(...years),
        yearMax: Math.max(...years),
        representativeImage: carImage || "/cars/placeholder.svg",
        representativeCar: `${repCar.year} ${repCar.model}`,
      })
    }

    return result
  }, [regionFilteredCars, selectedFamilyForFeed])

  // ─── SIBLING SERIES (same family group) for Column A nav ───
  const siblingSeries = useMemo(() => {
    if (!selectedFamilyForFeed) return []
    const groups = getFamilyGroupsWithSeries(make)
    const currentGroup = groups.find(g =>
      g.series.some(s => s.id === selectedFamilyForFeed.toLowerCase())
    )
    if (!currentGroup || currentGroup.series.length <= 1) return []

    // Count cars per sibling from regionFilteredCars
    const countMap = new Map<string, number>()
    regionFilteredCars.forEach(car => {
      const seriesId = extractSeries(car.model, car.year || 0, make, car.title)
      countMap.set(seriesId, (countMap.get(seriesId) || 0) + 1)
    })

    return currentGroup.series
      .map(s => ({
        id: s.id,
        label: s.label,
        carCount: countMap.get(s.id) || 0,
      }))
      .filter(s => s.carCount > 0)
  }, [selectedFamilyForFeed, make, regionFilteredCars])

  // Series label (e.g. "992") for the header — NOT the family group label ("911 Family")
  const currentSeriesLabel = useMemo(() => {
    if (!selectedFamilyForFeed) return ""
    const config = getSeriesConfig(selectedFamilyForFeed.toLowerCase(), make)
    return config?.label || selectedFamilyForFeed
  }, [selectedFamilyForFeed, make])

  const currentFamilyGroupLabel = useMemo(() => {
    if (!selectedFamilyForFeed) return ""
    const groups = getFamilyGroupsWithSeries(make)
    const group = groups.find(g =>
      g.series.some(s => s.id === selectedFamilyForFeed.toLowerCase())
    )
    return group?.label || selectedFamilyForFeed
  }, [selectedFamilyForFeed, make])

  // Apply filters to feed cars (when in cars mode)
  const filteredFeedCars = useMemo(() => {
    if (!activeFilters) return familyCarsForFeed

    let result = familyCarsForFeed

    // Search query filter
    if (activeFilters.searchQuery.trim()) {
      const q = activeFilters.searchQuery.toLowerCase()
      result = result.filter(car => car.model.toLowerCase().includes(q))
    }

    // Generations filter
    if (activeFilters.selectedGenerations.length > 0) {
      result = result.filter(car => {
        const gen = extractGenerationFromModel(car.model, car.year)
        return gen && activeFilters.selectedGenerations.includes(gen)
      })
    }

    // Price range filter
    if (activeFilters.priceRange) {
      const [min, max] = activeFilters.priceRange
      result = result.filter(car => car.currentBid >= min && car.currentBid <= max)
    }

    // Year range filter
    if (activeFilters.yearRange) {
      const [min, max] = activeFilters.yearRange
      result = result.filter(car => car.year >= min && car.year <= max)
    }

    // Mileage filter
    if (activeFilters.mileageRanges && activeFilters.mileageRanges.length > 0) {
      result = result.filter(car => {
        if (!car.mileage) return false
        const mileage = car.mileage
        return activeFilters.mileageRanges!.some(range => {
          if (range === "0-10k") return mileage < 10000
          if (range === "10k-50k") return mileage >= 10000 && mileage < 50000
          if (range === "50k-100k") return mileage >= 50000 && mileage < 100000
          if (range === "100k+") return mileage >= 100000
          return false
        })
      })
    }

    // Transmission filter
    if (activeFilters.transmissions && activeFilters.transmissions.length > 0) {
      result = result.filter(car => {
        if (!car.transmission) return false
        return activeFilters.transmissions!.some(t =>
          car.transmission?.toLowerCase().includes(t.toLowerCase())
        )
      })
    }

    // Body type filter
    if (activeFilters.bodyTypes && activeFilters.bodyTypes.length > 0) {
      result = result.filter(car => {
        const bt = deriveBodyType(car.model, car.trim, car.category, car.make, car.year)
        return activeFilters.bodyTypes!.includes(bt)
      })
    }

    // Color filter
    if (activeFilters.colors && activeFilters.colors.length > 0) {
      result = result.filter(car => {
        if (!car.exteriorColor) return false
        return activeFilters.colors!.some(c =>
          car.exteriorColor?.toLowerCase().includes(c.toLowerCase())
        )
      })
    }

    // Status filter
    if (activeFilters.statuses && activeFilters.statuses.length > 0) {
      result = result.filter(car =>
        activeFilters.statuses!.includes(car.status)
      )
    }

    return result
  }, [familyCarsForFeed, activeFilters])

  // Variant chips — compute available variants with counts from filteredFeedCars
  const availableVariants = useMemo(() => {
    if (!selectedGeneration && !selectedFamilyForFeed) return []
    const seriesId = selectedGeneration || selectedFamilyForFeed || ""
    const variants = getSeriesVariants(seriesId.toLowerCase(), make)
    if (variants.length === 0) return []
    const counts = new Map<string, number>()
    for (const car of filteredFeedCars) {
      const vid = matchVariant(car.model, car.trim, seriesId.toLowerCase(), make, car.title)
      if (vid) counts.set(vid, (counts.get(vid) || 0) + 1)
    }
    return variants
      .map(v => ({ id: v.id, label: v.label, count: counts.get(v.id) || 0 }))
      .filter(v => v.count > 0)
  }, [filteredFeedCars, selectedGeneration, selectedFamilyForFeed, make])

  // Apply variant chip filter + status filter + sorting on top of filteredFeedCars
  const variantFilteredFeedCars = useMemo(() => {
    let result = filteredFeedCars
    if (selectedVariantChip) {
      const seriesId = selectedGeneration || selectedFamilyForFeed || ""
      result = result.filter(car => {
        const vid = matchVariant(car.model, car.trim, seriesId.toLowerCase(), make, car.title)
        return vid === selectedVariantChip
      })
    }
    // Status filter
    if (feedStatusFilter === "live") {
      result = result.filter(car => car.status === "ACTIVE" || car.status === "ENDING_SOON")
    } else if (feedStatusFilter === "ended") {
      result = result.filter(car => car.status === "ENDED")
    }
    // Apply sorting
    const sorted = [...result]
    switch (sortBy) {
      case "price-desc": sorted.sort((a, b) => b.price - a.price); break
      case "price-asc": sorted.sort((a, b) => a.price - b.price); break
      case "year-desc": sorted.sort((a, b) => b.year - a.year); break
      case "year-asc": sorted.sort((a, b) => a.year - b.year); break
    }
    return sorted
  }, [filteredFeedCars, selectedVariantChip, selectedGeneration, selectedFamilyForFeed, make, sortBy, feedStatusFilter])

  // Status counts for Column B header chips (computed before status filter)
  const feedStatusCounts = useMemo(() => {
    let base = filteredFeedCars
    if (selectedVariantChip) {
      const seriesId = selectedGeneration || selectedFamilyForFeed || ""
      base = base.filter(car => matchVariant(car.model, car.trim, seriesId.toLowerCase(), make, car.title) === selectedVariantChip)
    }
    const live = base.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length
    const ended = base.filter(c => c.status === "ENDED").length
    return { all: base.length, live, ended }
  }, [filteredFeedCars, selectedVariantChip, selectedGeneration, selectedFamilyForFeed, make])

  // Scroll sync for center feed — tracks position in whichever list is showing
  const getCardHeight = () => typeof window !== "undefined" ? window.innerHeight - 80 : 800
  const [activeGenIndex, setActiveGenIndex] = useState(0)
  const [activeCarIndex, setActiveCarIndex] = useState(0)

  useEffect(() => {
    const container = feedRef.current
    if (!container) return
    const handleScroll = () => {
      const newIndex = Math.round(container.scrollTop / getCardHeight())
      if (viewMode === 'families') {
        if (newIndex !== currentModelIndex && newIndex >= 0 && newIndex < filteredModels.length) {
          setCurrentModelIndex(newIndex)
        }
      } else if (viewMode === 'generations') {
        if (newIndex !== activeGenIndex && newIndex >= 0 && newIndex < familyGenerations.length) {
          setActiveGenIndex(newIndex)
        }
      } else if (viewMode === 'cars') {
        if (newIndex !== activeCarIndex && newIndex >= 0 && newIndex < variantFilteredFeedCars.length) {
          setActiveCarIndex(newIndex)
        }
      }
    }
    container.addEventListener("scroll", handleScroll, { passive: true })
    return () => container.removeEventListener("scroll", handleScroll)
  }, [viewMode, currentModelIndex, filteredModels.length, activeGenIndex, familyGenerations.length, activeCarIndex, variantFilteredFeedCars.length])

  const scrollToModel = (index: number) => {
    const container = feedRef.current
    if (!container) return
    container.scrollTo({ top: getCardHeight() * index, behavior: "smooth" })
    setCurrentModelIndex(index)
  }

  const scrollToCar = (index: number) => {
    const container = feedRef.current
    if (!container) return
    container.scrollTo({ top: getCardHeight() * index, behavior: "smooth" })
    setActiveCarIndex(index)
  }

  // Auto-scroll car index list in Column A to keep active item visible
  useEffect(() => {
    if (viewMode !== 'cars') return
    const el = carIndexRefs.current.get(activeCarIndex)
    if (el) {
      el.scrollIntoView({ block: "nearest", behavior: "smooth" })
    }
  }, [activeCarIndex, viewMode])

  // Reset index when filters change
  useEffect(() => {
    setCurrentModelIndex(0)
    feedRef.current?.scrollTo({ top: 0 })
  }, [searchQuery, selectedPriceRange, selectedPriceTier, selectedStatus, selectedRegion, selectedEra])

  // Brand data
  const sampledLiveCount = infiniteScrollCars.filter(c => c.status === "ACTIVE" || c.status === "ENDING_SOON").length
  const liveCount = liveNowCount ?? sampledLiveCount
  const soldCount = infiniteScrollCars.filter(c => c.status === "ENDED").length
  const minPrice = infiniteScrollCars.length > 0 ? Math.min(...infiniteScrollCars.map(c => c.currentBid)) : 0
  const maxPrice = infiniteScrollCars.length > 0 ? Math.max(...infiniteScrollCars.map(c => c.currentBid)) : 0
  const activeFilterCount = (selectedPriceRange !== 0 ? 1 : 0) + (selectedStatus !== "All" ? 1 : 0)

  // Region counts for pills
  const regionCounts = useMemo(() => {
    if (liveRegionTotals) {
      return {
        All: liveRegionTotals.all,
        US: liveRegionTotals.US,
        EU: liveRegionTotals.EU,
        UK: liveRegionTotals.UK,
        JP: liveRegionTotals.JP,
      }
    }

    return {
      All: infiniteScrollCars.length,
      US: infiniteScrollCars.filter(c => c.region === "US").length,
      EU: infiniteScrollCars.filter(c => c.region === "EU").length,
      UK: infiniteScrollCars.filter(c => c.region === "UK").length,
      JP: infiniteScrollCars.filter(c => c.region === "JP").length,
    }
  }, [infiniteScrollCars, liveRegionTotals])

  const selectedRegionLiveCount = useMemo(() => {
    if (!selectedRegion || selectedRegion === "all") {
      return liveCount
    }

    const key = selectedRegion as keyof typeof regionCounts
    const counted = regionCounts[key]
    if (typeof counted === "number") {
      return counted
    }

    return liveCount
  }, [liveCount, regionCounts, selectedRegion])

  const clearFilters = () => {
    setSearchQuery("")
    setSelectedRegion(null)
    setSelectedPriceRange(0)
    setSelectedPriceTier("all")
    setSelectedEra("All")
    setSelectedStatus("All")
    setSortBy("price-desc")
  }

  return (
    <>
      {/* ═══ MOBILE LAYOUT ═══ */}
      <div className="md:hidden min-h-screen bg-background pt-14">
        {/* Sticky region pills with counts */}
        <MakePageRegionPills regionCounts={regionCounts} />

        {/* Sticky search + filter bar */}
        <div className="sticky top-[45px] z-20 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("filters.searchMakePlaceholder", { make })}
                className="w-full bg-foreground/5 border border-border rounded-xl pl-10 pr-4 py-2.5 text-[13px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/50"
              />
            </div>
            <button
              onClick={() => setShowMobileFilters(true)}
              className="relative flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/5 border border-border text-[12px] font-medium text-muted-foreground"
            >
              <SlidersHorizontal className="size-4" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1 -right-1 size-5 flex items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="pb-24">
          {filteredModels.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center px-8 py-20">
              <Car className="size-12 text-muted-foreground mb-4" />
              <h3 className="text-[15px] font-semibold text-foreground mb-2">{t("empty.title")}</h3>
              <p className="text-[13px] text-muted-foreground mb-6">{t("empty.subtitle")}</p>
              <button onClick={clearFilters} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold">
                {t("empty.clearAll")}
              </button>
            </div>
          ) : (
            <>
              {/* Hero: first model with context panels below */}
              {filteredModels[0] && (
                <>
                  <MobileHeroModel model={filteredModels[0]} make={make} />
                  <MobileModelContext
                    model={filteredModels[0]}
                    make={make}
                    cars={regionFilteredCars}
                    allCars={infiniteScrollCars}
                    allModels={filteredModels}
                    dbOwnershipCosts={realOwnershipCosts}
                  />
                </>
              )}

              {/* Section: All Models (index 1+) */}
              {filteredModels.length > 1 && (
                <div className="mt-6">
                  <div className="px-4 py-3 flex items-center gap-2">
                    <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                      {t("mobileContext.models")}
                    </span>
                    <span className="text-[10px] font-display font-medium text-primary">{filteredModels.length - 1}</span>
                  </div>
                  <div className="divide-y divide-border">
                    {filteredModels.slice(1).map((model) => (
                      <MobileModelRow
                        key={model.slug}
                        model={model}
                        make={make}
                        onTap={() => setExpandedModel(model)}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Section: Live Auctions (filtered by family when selected) */}
              <MobileMakeLiveAuctions
                cars={selectedFamilyForFeed
                  ? regionFilteredCars.filter(c => extractFamily(c.model, c.year, make) === selectedFamilyForFeed)
                  : regionFilteredCars
                }
                totalLiveCount={displayLiveTotal ?? 0}
              />
            </>
          )}
        </div>

        {/* Bottom sheet for tapped model context */}
        <MobileModelContextSheet
          model={expandedModel}
          make={make}
          cars={regionFilteredCars}
          allCars={infiniteScrollCars}
          allModels={filteredModels}
          onClose={() => setExpandedModel(null)}
          dbOwnershipCosts={realOwnershipCosts}
        />

        <MobileFilterSheet
          open={showMobileFilters}
          onClose={() => setShowMobileFilters(false)}
          models={allModels.map(m => m.name)}
          selectedModel={selectedFamilyForFeed || "All"}
          setSelectedModel={(m) => setSelectedFamilyForFeed(m === "All" ? null : m)}
          selectedPriceRange={selectedPriceRange}
          setSelectedPriceRange={setSelectedPriceRange}
          selectedStatus={selectedStatus}
          setSelectedStatus={setSelectedStatus}
          sortBy={sortBy}
          setSortBy={setSortBy}
          cars={infiniteScrollCars}
          filteredCount={filteredModels.length}
        />
      </div>

      {/* ═══ DESKTOP LAYOUT (3-column) ═══ */}
      <div className="hidden md:flex h-[100dvh] w-full flex-col bg-background overflow-hidden pt-[var(--app-header-h,80px)]">
        <div className="flex-1 min-h-0 grid grid-cols-[22%_1fr_28%] grid-rows-[1fr] overflow-hidden">
          {/* COLUMN A: GENERATIONS + FILTERS + LIVE */}
          <div className="h-full flex flex-col border-r border-border overflow-hidden">
            {/* Filters section (scrollable) */}
            {selectedModel ? (
              <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                {/* Back + Family Group header */}
                <div className="shrink-0 px-4 py-2.5 border-b border-border">
                  <button
                    onClick={handleBackToFamilies}
                    className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors group mb-1"
                  >
                    <ArrowLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
                    <span className="uppercase font-semibold tracking-wider">{make}</span>
                  </button>
                  <div className="flex items-center justify-between">
                    <h3 className="text-[14px] font-semibold text-foreground">{currentSeriesLabel}</h3>
                    <span className="text-[10px] text-muted-foreground tabular-nums">{formatCount(displayTotal)} cars</span>
                  </div>
                </div>

                {/* Sibling Series Navigation (same family group) */}
                {siblingSeries.length > 1 && (
                  <div className="shrink-0 border-b border-border">
                    <div className="px-4 py-1.5">
                      <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                        Series
                      </span>
                    </div>
                    <div className="max-h-[260px] overflow-y-auto no-scrollbar">
                      {siblingSeries.map(s => {
                        const isActive = selectedFamilyForFeed === s.id
                        return (
                          <button
                            key={s.id}
                            onClick={() => handleSiblingClick(s.id)}
                            className={`w-full flex items-center justify-between px-4 py-2 transition-all ${
                              isActive
                                ? "bg-primary/6 border-l-2 border-l-primary"
                                : "border-l-2 border-l-transparent hover:bg-foreground/2"
                            }`}
                          >
                            <span className={`text-[11px] font-medium ${
                              isActive ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {s.label}
                            </span>
                            <span className={`text-[9px] tabular-nums ${
                              isActive ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {s.carCount}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
                {/* Car Index List — synced with Column B scroll */}
                {viewMode === 'cars' && variantFilteredFeedCars.length > 0 && (
                  <div className="shrink-0 max-h-[40%] flex flex-col border-b border-border overflow-hidden">
                    <div className="shrink-0 px-4 py-1.5 flex items-center justify-between">
                      <span className="text-[8px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                        Cars
                      </span>
                      <span className="text-[9px] tabular-nums text-muted-foreground">
                        {activeCarIndex + 1}/{formatCount(displayTotal)}
                      </span>
                    </div>
                    <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                      {variantFilteredFeedCars.map((car, i) => {
                        const isActive = i === activeCarIndex
                        return (
                          <button
                            key={car.id}
                            ref={(el) => { if (el) carIndexRefs.current.set(i, el); else carIndexRefs.current.delete(i) }}
                            onClick={() => scrollToCar(i)}
                            className={`w-full flex items-center gap-2 px-4 py-1.5 transition-all ${
                              isActive
                                ? "bg-primary/6 border-l-2 border-l-primary"
                                : "border-l-2 border-l-transparent hover:bg-foreground/2"
                            }`}
                          >
                            <span className={`text-[9px] tabular-nums w-4 shrink-0 ${
                              isActive ? "text-primary" : "text-muted-foreground"
                            }`}>
                              {i + 1}
                            </span>
                            <span className={`text-[10px] truncate flex-1 text-left ${
                              isActive ? "text-foreground font-medium" : "text-muted-foreground"
                            }`}>
                              {car.year} {car.model?.replace(/^Porsche\s*/i, "")}
                            </span>
                            {car.currentBid > 0 && (
                              <span className={`text-[9px] tabular-nums shrink-0 ${
                                isActive ? "text-primary" : "text-muted-foreground"
                              }`}>
                                ${(car.currentBid / 1000).toFixed(0)}k
                              </span>
                            )}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Advanced filters (price, year, km, transmission) */}
                <div className="flex-1 min-h-0 overflow-hidden">
                  <AdvancedFilters
                    key={selectedFamilyForFeed || selectedModel.name}
                    familyName={selectedModel.name}
                    onFiltersChange={(advFilters) => {
                      setActiveFilters(prev => ({
                        ...prev,
                        searchQuery: prev?.searchQuery || "",
                        selectedGenerations: prev?.selectedGenerations || [],
                        yearRange: advFilters.yearRange,
                        priceRange: advFilters.priceRange,
                        mileageRanges: advFilters.mileageRanges,
                        transmissions: advFilters.transmissions,
                        bodyTypes: advFilters.bodyTypes,
                        colors: advFilters.colors,
                        statuses: advFilters.statuses,
                      }))
                    }}
                    minPrice={selectedModel.priceMin}
                    maxPrice={selectedModel.priceMax}
                    minYear={parseInt(selectedModel.years.split("–")[0]) || 1960}
                    maxYear={parseInt(selectedModel.years.split("–")[1] || selectedModel.years) || 2026}
                  />
                </div>
              </div>
            ) : (
              <div className="flex-1" />
            )}

            {/* LIVE BIDS (always at bottom) */}
            <div className="shrink-0 max-h-[35%] flex flex-col border-t border-border overflow-hidden">
              {/* Live header */}
              <div className="shrink-0 px-3 py-1.5 flex items-center gap-2 bg-background/40">
                <span className="relative flex size-2">
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-positive opacity-75" />
                  <span className="relative inline-flex size-2 rounded-full bg-positive" />
                </span>
                <span className="text-[10px] font-semibold tracking-[0.15em] uppercase text-positive">
                  LATEST LISTINGS
                </span>
                {displayLiveTotal !== null && displayLiveTotal > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-positive/10 text-[9px] font-bold text-positive">
                    {displayLiveTotal}
                  </span>
                )}
              </div>
              {/* Scrollable live bids */}
              <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
                {liveCars.length === 0 ? (
                  <div className="px-4 py-6 text-center">
                    <span className="text-[11px] text-muted-foreground">No active listings</span>
                  </div>
                ) : (
                  liveCars.map((car) => {
                    const isEndingSoon = car.status === "ENDING_SOON"
                    const makeSlug = car.make.toLowerCase().replace(/\s+/g, "-")
                    return (
                      <Link
                        key={car.id}
                        href={`/cars/${makeSlug}/${car.id}`}
                        className="group flex gap-2.5 px-3 py-2 border-b border-border/50 hover:bg-foreground/2 transition-all"
                      >
                        <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                          <Image
                            src={car.image || car.images?.[0] || "/cars/placeholder.svg"}
                            alt={car.title}
                            fill
                            className="object-cover"
                            sizes="56px"
                          />
                          <div className="absolute top-0.5 right-0.5 size-2 rounded-full bg-positive animate-pulse" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                            {car.year} {car.model}
                          </p>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-[11px] font-display font-medium text-primary">
                              {formatPrice(car.currentBid)}
                            </span>
                            <span className={`flex items-center gap-1 text-[9px] ${isEndingSoon ? "text-destructive" : "text-muted-foreground"}`}>
                              <Clock className="size-2.5" />
                              {timeLeft(new Date(car.endTime), {
                                ended: isAuctionPlatform(car.platform) ? tAuction("time.ended") : tAuction("time.sold"),
                                day: tAuction("time.units.day"),
                                hour: tAuction("time.units.hour"),
                                minute: tAuction("time.units.minute"),
                              })}
                            </span>
                          </div>
                        </div>
                      </Link>
                    )
                  })
                )}
              </div>
            </div>
          </div>

          {/* COLUMN B: MODEL FEED (snap scroll) */}
          <div
            ref={feedRef}
            className={`h-full overflow-y-auto no-scrollbar scroll-smooth ${(viewMode === 'families' || viewMode === 'generations') && !hasActiveFilters ? "snap-y snap-mandatory" : ""}`}
          >
            {viewMode === 'cars' ? (
              // MODE: Viewing specific generation's cars (feed style)
              <>
                {/* Back navigation + sort + variant chips — compact */}
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border px-4 py-1.5">
                  <div className="flex items-center justify-between">
                    <button
                      onClick={handleBackToGenerations}
                      className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors group"
                    >
                      <ArrowLeft className="size-3 group-hover:-translate-x-0.5 transition-transform" />
                      <span className="uppercase font-semibold tracking-wider">
                        {selectedFamilyForFeed} {selectedGeneration ? `/ ${selectedGeneration.toUpperCase()}` : ""}
                      </span>
                    </button>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] text-muted-foreground tabular-nums">{formatCount(displayTotal)} cars</span>
                      <SortSelector sortBy={sortBy} setSortBy={setSortBy} options={carSortOptions} />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-1 overflow-x-auto no-scrollbar">
                    {/* Variant chips */}
                    {availableVariants.length > 0 && (
                      <>
                        <button
                          onClick={() => setSelectedVariantChip(null)}
                          className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                            !selectedVariantChip
                              ? "bg-primary/15 text-primary border border-primary/30"
                              : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                          }`}
                        >
                          All
                        </button>
                        {availableVariants.map(v => (
                          <button
                            key={v.id}
                            onClick={() => setSelectedVariantChip(selectedVariantChip === v.id ? null : v.id)}
                            className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                              selectedVariantChip === v.id
                                ? "bg-primary/15 text-primary border border-primary/30"
                                : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                            }`}
                          >
                            {v.label}
                          </button>
                        ))}
                        <span className="shrink-0 w-px h-3 bg-foreground/10 mx-0.5" />
                      </>
                    )}
                    {/* Status chips */}
                    {feedStatusCounts.live > 0 && (
                      <button
                        onClick={() => setFeedStatusFilter(feedStatusFilter === "live" ? "all" : "live")}
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all inline-flex items-center gap-1 ${
                          feedStatusFilter === "live"
                            ? "bg-positive/15 text-positive border border-positive/30"
                            : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                        }`}
                      >
                        <span className="size-1.5 rounded-full bg-positive" />
                        Live {feedStatusCounts.live}
                      </button>
                    )}
                    {feedStatusCounts.ended > 0 && (
                      <button
                        onClick={() => setFeedStatusFilter(feedStatusFilter === "ended" ? "all" : "ended")}
                        className={`shrink-0 px-2 py-0.5 rounded-full text-[9px] font-semibold transition-all ${
                          feedStatusFilter === "ended"
                            ? "bg-muted-foreground/20 text-muted-foreground border border-muted-foreground/30"
                            : "bg-foreground/3 text-muted-foreground border border-border hover:border-border/80"
                        }`}
                      >
                        Sold {feedStatusCounts.ended}
                      </button>
                    )}
                  </div>
                </div>
                {isLoadingCars && variantFilteredFeedCars.length === 0 ? (
                  <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
                  </div>
                ) : !isLoadingCars && variantFilteredFeedCars.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <Car className="size-12 text-muted-foreground mb-4" />
                    <h3 className="text-[15px] font-semibold text-foreground mb-2">No hay carros</h3>
                    <p className="text-[13px] text-muted-foreground mb-6">
                      No se encontraron carros para esta generación
                    </p>
                    <button
                      onClick={handleBackToGenerations}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold"
                    >
                      Volver a generaciones
                    </button>
                  </div>
                ) : (
                  <>
                    <AnimatePresence mode="popLayout">
                      {variantFilteredFeedCars.map((car, i) => (
                        <motion.div
                          key={car.id}
                          initial={{ opacity: 0, y: 16 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.25, delay: Math.min(i * 0.03, 0.15) }}
                          layout
                        >
                          <CarFeedCard car={car} make={make} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                    {hasMore && (
                      <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                        {isFetchingMore && (
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                        )}
                      </div>
                    )}
                    {!hasMore && infiniteScrollCars.length > 0 && (
                      <p className="text-center text-zinc-500 py-8">
                        Showing all {infiniteScrollCars.length} listings
                      </p>
                    )}
                    {!isLoadingCars && !hasMore && infiniteScrollCars.length === 0 && (
                      <div className="text-center text-zinc-500 py-16">
                        <p>No listings found for these filters.</p>
                      </div>
                    )}
                  </>
                )}
              </>
            ) : viewMode === 'generations' ? (
              // MODE: Viewing generations of a family (snap scroll)
              <>
                {familyGenerations.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center px-8">
                    <Car className="size-12 text-muted-foreground mb-4" />
                    <h3 className="text-[15px] font-semibold text-foreground mb-2">No generations found</h3>
                    <p className="text-[13px] text-muted-foreground mb-6">
                      No se encontraron generaciones para {selectedFamilyForFeed}
                    </p>
                    <button
                      onClick={handleBackToFamilies}
                      className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold"
                    >
                      Volver a familias
                    </button>
                  </div>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {familyGenerations.map((gen, i) => (
                      <motion.div
                        key={gen.id}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
                        layout
                      >
                        <GenerationFeedCard
                          gen={gen}
                          familyName={selectedFamilyForFeed || ""}
                          make={make}
                          onClick={() => handleGenerationClick(gen.id)}
                        />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                )}
              </>
            ) : hasActiveFilters ? (
              // MODE: Filters active from COLUMN C (grid style)
              displayCars.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <Search className="size-12 text-muted-foreground mb-4" />
                  <h3 className="text-[15px] font-semibold text-foreground mb-2">No hay resultados</h3>
                  <p className="text-[13px] text-muted-foreground mb-6">
                    No se encontraron carros que coincidan con tu búsqueda
                  </p>
                  <button
                    onClick={() => setActiveFilters(null)}
                    className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold"
                  >
                    Limpiar filtros
                  </button>
                </div>
              ) : (
                <div className="p-6 space-y-4">
                  {/* Header with filter info */}
                  <div className="flex items-center justify-between pb-3 border-b border-border">
                    <div>
                      <p className="text-[13px] font-semibold text-foreground">
                        {displayCars.length} {displayCars.length === 1 ? "resultado" : "resultados"}
                      </p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {activeFilters.searchQuery && `"${activeFilters.searchQuery}"`}
                        {activeFilters.searchQuery && activeFilters.selectedGenerations.length > 0 && " • "}
                        {activeFilters.selectedGenerations.length > 0 &&
                          activeFilters.selectedGenerations.join(", ")}
                      </p>
                    </div>
                    <button
                      onClick={() => setActiveFilters(null)}
                      className="text-[11px] text-primary hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      <X className="size-3" />
                      Limpiar
                    </button>
                  </div>

                  {/* Car grid */}
                  <div className="grid grid-cols-1 gap-4">
                    <AnimatePresence mode="popLayout">
                      {displayCars.map((car, idx) => (
                        <motion.div
                          key={car.id}
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.2, delay: Math.min(idx * 0.03, 0.15) }}
                          layout
                        >
                          <CarCard car={car} index={idx} />
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                </div>
              )
            ) : (
              // MODE: Default - Show family feed (families with snap scroll)
              <>
              {filteredModels.length > 1 && (
                <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-xl border-b border-border px-5 py-2.5 flex items-center justify-between">
                  <span className="text-[10px] font-semibold tracking-[0.2em] uppercase text-muted-foreground">
                    {filteredModels.length} {filteredModels.length === 1 ? "familia" : "familias"}
                  </span>
                  <SortSelector sortBy={sortBy} setSortBy={setSortBy} options={sortOptions} />
                </div>
              )}
              {isLoadingCars && filteredModels.length === 0 ? (
                <div className="flex items-center justify-center py-20">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white" />
                </div>
              ) : filteredModels.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center px-8">
                  <Car className="size-12 text-muted-foreground mb-4" />
                  <h3 className="text-[15px] font-semibold text-foreground mb-2">{t("empty.title")}</h3>
                  <p className="text-[13px] text-muted-foreground mb-6">{t("empty.subtitle")}</p>
                  <button onClick={clearFilters} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold">
                    {t("empty.clearAll")}
                  </button>
                </div>
              ) : (
                <>
                  <AnimatePresence mode="popLayout">
                    {filteredModels.map((model, i) => (
                      <motion.div
                        key={model.slug}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{ duration: 0.25, delay: Math.min(i * 0.04, 0.2) }}
                        layout
                      >
                        <ModelFeedCard model={model} make={make} onClick={() => handleFamilyClick(model.name)} index={i} />
                      </motion.div>
                    ))}
                  </AnimatePresence>
                  {hasMore && (
                    <div ref={sentinelRef} className="h-20 flex items-center justify-center">
                      {isFetchingMore && (
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white" />
                      )}
                    </div>
                  )}
                </>
              )}
              </>
            )}
          </div>

          {/* COLUMN C: MARKET INTELLIGENCE — synced with center scroll */}
          <div className="h-full overflow-hidden border-l border-primary/8 bg-card">
            {viewMode === 'generations' && familyGenerations[activeGenIndex] ? (
              <GenerationContextPanel
                key={familyGenerations[activeGenIndex].id}
                gen={familyGenerations[activeGenIndex]}
                familyName={selectedFamilyForFeed || ""}
                make={make}
                familyCars={regionFilteredCars.filter(car => extractFamily(car.model, car.year, make) === selectedFamilyForFeed)}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
              />
            ) : viewMode === 'cars' && variantFilteredFeedCars[activeCarIndex] ? (
              <CarContextPanel
                key={variantFilteredFeedCars[activeCarIndex].id}
                car={variantFilteredFeedCars[activeCarIndex]}
                make={make}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
              />
            ) : selectedModel ? (
              <ModelContextPanel
                model={selectedModel}
                make={make}
                cars={displayCars}
                allCars={infiniteScrollCars}
                allModels={filteredModels}
                onOpenAdvisor={() => setShowAdvisorChat(true)}
                dbOwnershipCosts={realOwnershipCosts}
              />
            ) : null}
          </div>
        </div>
      </div>

      {/* Advisor Chat */}
      <AdvisorChat
        open={showAdvisorChat}
        onOpenChange={setShowAdvisorChat}
        initialContext={{ make }}
        conversationId={openChatConversationId ?? null}
      />
    </>
  )
}
