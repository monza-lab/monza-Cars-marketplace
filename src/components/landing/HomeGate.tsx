"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { LandingPage } from "./LandingPage"
import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { ViewPreferenceRedirect } from "@/components/layout/ViewPreferenceRedirect"
import { MonzaInfinityLoader } from "@/components/shared/MonzaInfinityLoader"
import { AuthModal } from "@/components/auth/AuthModal"
import type { DashboardData } from "@/lib/dashboardCache"

const EXPLORED_KEY = "monzahaus-explored"

interface HomeGateProps {
  data: DashboardData
  authError?: string | null
}

export function HomeGate({ data, authError }: HomeGateProps) {
  const { user, loading } = useAuth()
  const [hasExplored, setHasExplored] = useState<boolean | null>(null)
  const [recoveryAuthOpen, setRecoveryAuthOpen] = useState(false)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasExplored(localStorage.getItem(EXPLORED_KEY) === "true")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const showLanding = !user && hasExplored !== true
  const showConfirmationRecovery = authError === "confirmation_failed"

  if (showLanding) {
    return (
      <>
        <LandingPage />
        {showConfirmationRecovery && (
          <div className="fixed left-1/2 top-24 z-[120] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-destructive/30 bg-card/95 p-4 text-center shadow-2xl backdrop-blur-xl">
            <p className="text-sm font-semibold text-foreground">
              Your email link expired or could not be confirmed.
            </p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Resend the link or create your free account again to continue with 3 reports.
            </p>
            <button
              type="button"
              onClick={() => setRecoveryAuthOpen(true)}
              className="mt-3 inline-flex h-10 items-center justify-center rounded-full bg-primary px-5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary/85 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              Resend or try again
            </button>
          </div>
        )}
        <AuthModal
          open={recoveryAuthOpen}
          onOpenChange={setRecoveryAuthOpen}
          defaultMode="signup"
        />
      </>
    )
  }

  if (loading || hasExplored === null) {
    return <MonzaInfinityLoader />
  }

  // Show landing only for new visitors who haven't explored yet
  return (
    <>
      <ViewPreferenceRedirect current="monza" />
      <DashboardClient
        auctions={data.auctions}
        valuationListings={data.valuationListings}
        regionalValByFamily={data.regionalValByFamily}
        liveRegionTotals={data.regionTotals}
        liveNowTotal={data.liveNow}
        seriesCounts={data.seriesCounts}
        seriesCountsByRegion={data.seriesCountsByRegion}
      />
    </>
  )
}
