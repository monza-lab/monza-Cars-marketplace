"use client"

import { createContext, useContext, useEffect, useState, useCallback } from "react"

// Cookie/consent rules:
// 1. State is "pending" until the user clicks Accept or Reject in the banner.
// 2. While pending, NO non-essential cookie loads (Vercel Analytics,
//    Speed Insights, Meta Pixel, Google Analytics). This is required by
//    GDPR Art. 6 / ePrivacy and California CIPA pre-consent rules.
// 3. The Global Privacy Control (GPC) signal — if the browser sends it,
//    we treat the visit as "rejected" automatically and never show the
//    banner. The user can still flip to "accepted" via the cookie
//    preferences link, but the default is privacy-protective.
// 4. The decision persists in localStorage as `monzahaus_cookie_consent`.
// 5. The Cookie Policy lists every cookie/storage key the site sets.

const STORAGE_KEY = "monzahaus_cookie_consent"

export type ConsentValue = "accepted" | "rejected"
export type ConsentState = "pending" | ConsentValue

interface ConsentContextValue {
  consent: ConsentState
  accept: () => void
  reject: () => void
  reset: () => void
}

const ConsentContext = createContext<ConsentContextValue | null>(null)

declare global {
  interface Navigator {
    globalPrivacyControl?: boolean
  }
}

export function ConsentProvider({ children }: { children: React.ReactNode }) {
  const [consent, setConsent] = useState<ConsentState>("pending")

  useEffect(() => {
    if (typeof window === "undefined") return

    // Honor Global Privacy Control: if the browser signals GPC, treat as
    // rejected and persist so we never show the banner on this device.
    if (navigator.globalPrivacyControl === true) {
      try {
        window.localStorage.setItem(STORAGE_KEY, "rejected")
      } catch {
        // localStorage might be disabled — keep state in memory.
      }
      setConsent("rejected")
      return
    }

    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "accepted" || stored === "rejected") {
        setConsent(stored)
      }
    } catch {
      // localStorage unavailable; remain pending in-memory.
    }
  }, [])

  const persist = useCallback((value: ConsentValue) => {
    setConsent(value)
    try {
      window.localStorage.setItem(STORAGE_KEY, value)
    } catch {
      // best-effort
    }
  }, [])

  const accept = useCallback(() => persist("accepted"), [persist])
  const reject = useCallback(() => persist("rejected"), [persist])
  const reset = useCallback(() => {
    setConsent("pending")
    try {
      window.localStorage.removeItem(STORAGE_KEY)
    } catch {
      // best-effort
    }
  }, [])

  return (
    <ConsentContext.Provider value={{ consent, accept, reject, reset }}>
      {children}
    </ConsentContext.Provider>
  )
}

export function useConsent(): ConsentContextValue {
  const ctx = useContext(ConsentContext)
  if (!ctx) {
    // Allow components that ship before the provider mounts (e.g. server
    // components hydrating slowly) to render with a safe default.
    return {
      consent: "pending",
      accept: () => {},
      reject: () => {},
      reset: () => {},
    }
  }
  return ctx
}
