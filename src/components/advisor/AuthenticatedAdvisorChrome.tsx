"use client"

import { useAuth } from "@/lib/auth/AuthProvider"
import { AdvisorFab } from "./AdvisorFab"
import { AdvisorDrawer } from "./AdvisorDrawer"

export function AuthenticatedAdvisorChrome() {
  const { user, loading } = useAuth()
  if (loading || !user) return null
  return <><AdvisorFab /><AdvisorDrawer /></>
}
