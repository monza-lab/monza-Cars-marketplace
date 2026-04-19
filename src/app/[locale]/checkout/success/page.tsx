"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { CheckCircle2, Loader2 } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { track } from "@/lib/analytics/events"

export default function CheckoutSuccessPage() {
  const { profile, refreshProfile } = useAuth()
  const [timeoutFired, setTimeoutFired] = useState(false)
  const trackedRef = useRef(false)

  const profileLoaded =
    profile?.tier === "MONTHLY" ||
    profile?.tier === "ANNUAL" ||
    profile?.tier === "PACK_OWNER"
  const ready = profileLoaded || timeoutFired

  useEffect(() => {
    // Stripe webhook may land before or after the user returns.
    // Poll profile up to 10 seconds, then stop and show the success view anyway.
    const interval = setInterval(() => {
      void refreshProfile()
    }, 1500)

    const timeout = setTimeout(() => {
      clearInterval(interval)
      setTimeoutFired(true)
    }, 10_000)

    return () => {
      clearInterval(interval)
      clearTimeout(timeout)
    }
  }, [refreshProfile])

  useEffect(() => {
    if (!ready || trackedRef.current) return
    trackedRef.current = true
    const sessionId =
      typeof window !== "undefined"
        ? new URLSearchParams(window.location.search).get("session_id") ?? ""
        : ""
    track({
      event: "checkout_completed",
      payload: { planId: profile?.tier ?? "unknown", amount: 0, sessionId },
    })
  }, [ready, profile])

  const isSubscription = profile?.tier === "MONTHLY" || profile?.tier === "ANNUAL"

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-foreground/2 p-8 text-center">
      {ready ? (
        <>
          <div className="inline-flex items-center justify-center size-12 rounded-full bg-positive/10 mb-4">
            <CheckCircle2 className="size-6 text-positive" />
          </div>
          <h1 className="text-xl font-bold text-foreground mb-2">You&apos;re all set</h1>
          <p className="text-[13px] text-muted-foreground mb-6">
            Your Reports are ready.
            {isSubscription ? " Watchlist is unlocked." : ""}
          </p>
          <div className="flex flex-col gap-2">
            <Link
              href="/"
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/80 transition-colors"
            >
              Generate your first report →
            </Link>
            <Link
              href="/account"
              className="w-full py-3 rounded-xl bg-foreground/6 border border-border text-[13px] font-medium hover:bg-foreground/10 transition-colors"
            >
              View billing details
            </Link>
          </div>
        </>
      ) : (
        <>
          <Loader2 className="size-8 animate-spin mx-auto text-muted-foreground mb-4" />
          <h1 className="text-lg font-semibold text-foreground mb-1">Processing payment</h1>
          <p className="text-[12px] text-muted-foreground">
            Hang on — Stripe is confirming your purchase. This usually takes a few seconds.
          </p>
        </>
      )}
    </div>
  )
}
