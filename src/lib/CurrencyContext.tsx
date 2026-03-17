"use client"

import { createContext, useContext, useState, useEffect, useCallback, useMemo, type ReactNode } from "react"
import { formatRegionalPrice } from "./regionPricing"

export type Currency = "USD" | "EUR" | "GBP" | "JPY"
type Rates = Record<string, number>

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  USD: "$",
  EUR: "€",
  GBP: "£",
  JPY: "¥",
}

const FALLBACK_RATES: Rates = { EUR: 0.92, GBP: 0.79, JPY: 149.5 }
const STORAGE_KEY = "monza-currency"

type CurrencyContextType = {
  currency: Currency
  setCurrency: (c: Currency) => void
  rates: Rates
  isLoading: boolean
  convertFromUsd: (amount: number) => number
  formatPrice: (usdAmount: number) => string
  currencySymbol: string
}

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "USD",
  setCurrency: () => {},
  rates: FALLBACK_RATES,
  isLoading: true,
  convertFromUsd: (a) => a,
  formatPrice: (a) => `$${a}`,
  currencySymbol: "$",
})

function getInitialCurrency(): Currency {
  if (typeof window === "undefined") return "USD"
  const stored = localStorage.getItem(STORAGE_KEY)
  if (stored && ["USD", "EUR", "GBP", "JPY"].includes(stored)) return stored as Currency
  return "USD"
}

export function CurrencyProvider({ children }: { children: ReactNode }) {
  const [currency, setCurrencyState] = useState<Currency>("USD")
  const [rates, setRates] = useState<Rates>(FALLBACK_RATES)
  const [isLoading, setIsLoading] = useState(true)

  // Read from localStorage on mount
  useEffect(() => {
    setCurrencyState(getInitialCurrency())
  }, [])

  // Fetch rates on mount
  useEffect(() => {
    let cancelled = false
    async function fetchRates() {
      try {
        const res = await fetch("/api/exchange-rates")
        if (!res.ok) throw new Error("Failed to fetch rates")
        const data = await res.json()
        if (!cancelled && data.rates) {
          setRates(data.rates)
        }
      } catch {
        // Keep fallback rates
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    fetchRates()
    return () => { cancelled = true }
  }, [])

  const setCurrency = useCallback((c: Currency) => {
    setCurrencyState(c)
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, c)
    }
  }, [])

  const convertFromUsd = useCallback(
    (amount: number) => {
      if (currency === "USD") return amount
      return amount * (rates[currency] || 1)
    },
    [currency, rates]
  )

  const currencySymbol = CURRENCY_SYMBOLS[currency]

  const formatPrice = useCallback(
    (usdAmount: number) => {
      const converted = currency === "USD" ? usdAmount : usdAmount * (rates[currency] || 1)
      return formatRegionalPrice(converted, currencySymbol)
    },
    [currency, rates, currencySymbol]
  )

  const value = useMemo(
    () => ({ currency, setCurrency, rates, isLoading, convertFromUsd, formatPrice, currencySymbol }),
    [currency, setCurrency, rates, isLoading, convertFromUsd, formatPrice, currencySymbol]
  )

  return (
    <CurrencyContext.Provider value={value}>
      {children}
    </CurrencyContext.Provider>
  )
}

export function useCurrency() {
  return useContext(CurrencyContext)
}
