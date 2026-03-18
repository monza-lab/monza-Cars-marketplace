"use client"
import { useState, useCallback } from "react"
import type { ListingReport } from "@/lib/reports/types"

interface UseReportResult {
  report: ListingReport | null
  loading: boolean
  error: string | null
  generating: boolean
  triggerGeneration: () => Promise<void>
  creditUsed: number
  creditsRemaining: number | null
}

export function useReport(listingId: string): UseReportResult {
  const [report, setReport] = useState<ListingReport | null>(null)
  const [loading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [creditUsed, setCreditUsed] = useState(0)
  const [creditsRemaining, setCreditsRemaining] = useState<number | null>(null)

  const triggerGeneration = useCallback(async () => {
    if (!listingId) return
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId }),
      })
      const data = await res.json()
      if (data.success) {
        setReport(data.data)
        setCreditUsed(data.creditUsed ?? 0)
        setCreditsRemaining(data.creditsRemaining ?? null)
      } else {
        setError(data.error || "Report generation failed")
      }
    } catch {
      setError("Failed to generate report")
    } finally {
      setGenerating(false)
    }
  }, [listingId])

  return { report, loading, error, generating, triggerGeneration, creditUsed, creditsRemaining }
}

// Keep old export name for backward compatibility
export const useAnalysis = useReport
