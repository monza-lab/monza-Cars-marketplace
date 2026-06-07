"use client"

import { useState, useEffect } from "react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { LandingPage } from "./LandingPage"
import { DashboardClient } from "@/components/dashboard/DashboardClient"
import { ViewPreferenceRedirect } from "@/components/layout/ViewPreferenceRedirect"
import { MonzaInfinityLoader } from "@/components/shared/MonzaInfinityLoader"
import type { DashboardData } from "@/lib/dashboardCache"

const EXPLORED_KEY = "monzahaus-explored"

interface HomeGateProps {
  data: DashboardData
}

export function HomeGate({ data }: HomeGateProps) {
  const { user, loading } = useAuth()
  const [hasExplored, setHasExplored] = useState<boolean | null>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasExplored(localStorage.getItem(EXPLORED_KEY) === "true")
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  if (loading || hasExplored === null) {
    return <MonzaInfinityLoader />
  }

  // Show landing only for new visitors who haven't explored yet
  if (!user && !hasExplored) {
    return <LandingPage />
  }

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
