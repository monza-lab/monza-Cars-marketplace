"use client"

import { useState, useEffect, useCallback } from "react"

// ─── CONSTANTS ───
const INITIAL_TOKENS = 3000
const COST_PER_ANALYSIS = 1000
const STORAGE_KEYS = {
  user: "monza_user",
  tokens: "monza_tokens",
  analyzedCars: "monza_analyzed_cars",
  plan: "monza_plan",
} as const

// ─── TYPES ───
export interface MonzaUser {
  name: string
  email: string
  registeredAt: string
}

export type PlanId = "single" | "explorer" | "unlimited"

export interface UseTokensReturn {
  user: MonzaUser | null
  tokens: number
  analyzedCars: string[]
  isRegistered: boolean
  isLoading: boolean
  /** Register a new user and grant initial tokens */
  register: (name: string, email: string) => void
  /** Consume tokens for generating an analysis. Returns true if success, false if insufficient. */
  consumeForAnalysis: (carId: string) => boolean
  /** Check if a car analysis was already generated (no token cost to re-download) */
  hasAnalyzed: (carId: string) => boolean
  /** Add tokens to balance (after purchase) */
  addTokens: (amount: number) => void
  /** Set the user's active plan */
  setPlan: (planId: PlanId) => void
  /** Current active plan (null = free tier) */
  currentPlan: PlanId | null
  /** Number of analyses remaining */
  analysesRemaining: number
  /** Total analyses generated so far */
  analysesUsed: number
  /** Cost per analysis */
  costPerAnalysis: number
}

// ─── HELPERS ───
function getStoredUser(): MonzaUser | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.user)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function getStoredTokens(): number {
  if (typeof window === "undefined") return 0
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.tokens)
    return raw ? parseInt(raw, 10) : 0
  } catch {
    return 0
  }
}

function getStoredAnalyzedCars(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.analyzedCars)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function getStoredPlan(): PlanId | null {
  if (typeof window === "undefined") return null
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.plan)
    return raw as PlanId | null
  } catch {
    return null
  }
}

// ─── HOOK ───
export function useTokens(): UseTokensReturn {
  const [user, setUser] = useState<MonzaUser | null>(null)
  const [tokens, setTokens] = useState(0)
  const [analyzedCars, setAnalyzedCars] = useState<string[]>([])
  const [currentPlan, setCurrentPlan] = useState<PlanId | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // Hydrate from localStorage on mount
  useEffect(() => {
    setUser(getStoredUser())
    setTokens(getStoredTokens())
    setAnalyzedCars(getStoredAnalyzedCars())
    setCurrentPlan(getStoredPlan())
    setIsLoading(false)
  }, [])

  const register = useCallback((name: string, email: string) => {
    const newUser: MonzaUser = { name, email, registeredAt: new Date().toISOString() }

    localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(newUser))
    localStorage.setItem(STORAGE_KEYS.tokens, String(INITIAL_TOKENS))
    localStorage.setItem(STORAGE_KEYS.analyzedCars, "[]")

    setUser(newUser)
    setTokens(INITIAL_TOKENS)
    setAnalyzedCars([])
  }, [])

  const hasAnalyzed = useCallback((carId: string) => {
    return analyzedCars.includes(carId)
  }, [analyzedCars])

  const consumeForAnalysis = useCallback((carId: string): boolean => {
    // Already analyzed → free re-download
    if (analyzedCars.includes(carId)) return true

    // Not enough tokens
    if (tokens < COST_PER_ANALYSIS) return false

    // Deduct and record
    const newTokens = tokens - COST_PER_ANALYSIS
    const newAnalyzed = [...analyzedCars, carId]

    localStorage.setItem(STORAGE_KEYS.tokens, String(newTokens))
    localStorage.setItem(STORAGE_KEYS.analyzedCars, JSON.stringify(newAnalyzed))

    setTokens(newTokens)
    setAnalyzedCars(newAnalyzed)
    return true
  }, [tokens, analyzedCars])

  const addTokens = useCallback((amount: number) => {
    const newTokens = tokens + amount
    localStorage.setItem(STORAGE_KEYS.tokens, String(newTokens))
    setTokens(newTokens)
  }, [tokens])

  const setPlan = useCallback((planId: PlanId) => {
    localStorage.setItem(STORAGE_KEYS.plan, planId)
    setCurrentPlan(planId)
  }, [])

  return {
    user,
    tokens,
    analyzedCars,
    isRegistered: user !== null,
    isLoading,
    register,
    consumeForAnalysis,
    hasAnalyzed,
    addTokens,
    setPlan,
    currentPlan,
    analysesRemaining: Math.floor(tokens / COST_PER_ANALYSIS),
    analysesUsed: analyzedCars.length,
    costPerAnalysis: COST_PER_ANALYSIS,
  }
}
