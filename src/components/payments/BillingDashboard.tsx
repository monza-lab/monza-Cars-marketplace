"use client"

import { useState } from "react"
import Link from "next/link"
import { useAuth } from "@/lib/auth/AuthProvider"
import { Coins, RefreshCw, FileText, CreditCard } from "lucide-react"
import { TransactionHistory } from "./TransactionHistory"
import { track } from "@/lib/analytics/events"

export function BillingDashboard() {
  const { profile, refreshProfile } = useAuth()
  const [refreshing, setRefreshing] = useState(false)
  const [canceling, setCanceling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const credits = profile?.creditsBalance ?? 0
  const packCredits = profile?.packCreditsBalance ?? 0
  const tier = profile?.tier ?? "FREE"
  const isSubscribed = tier === "MONTHLY" || tier === "ANNUAL"
  const periodEnd = profile?.subscriptionPeriodEnd
    ? new Date(profile.subscriptionPeriodEnd).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null

  const handleRefresh = async () => {
    setRefreshing(true)
    await refreshProfile()
    setTimeout(() => setRefreshing(false), 600)
  }

  const handleCancel = async () => {
    if (
      !confirm(
        "Cancel subscription? You'll keep access until the end of your current billing period.",
      )
    )
      return
    setCanceling(true)
    setCancelError(null)
    try {
      const res = await fetch("/api/billing/cancel-subscription", { method: "POST" })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? "Failed to cancel")
      }
      track({ event: "subscription_canceled", payload: { tier } })
      await refreshProfile()
    } catch (err) {
      setCancelError(err instanceof Error ? err.message : "Failed to cancel")
    } finally {
      setCanceling(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-border bg-foreground/2 p-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center size-8 rounded-lg bg-primary/10">
            <Coins className="size-4 text-primary" />
          </div>
          <div>
            <h3 className="text-[14px] font-semibold text-foreground">Reports Balance</h3>
            <p className="text-[11px] text-muted-foreground">Your available Reports</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-5">
          <div className="rounded-xl border border-border bg-foreground/2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <FileText className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">
                {isSubscribed ? "This month" : "Free monthly"}
              </span>
            </div>
            <span
              className={`text-2xl font-bold ${
                credits > 0 ? "text-primary" : "text-destructive"
              }`}
            >
              {credits}
            </span>
          </div>
          <div className="rounded-xl border border-border bg-foreground/2 p-4">
            <div className="flex items-center gap-2 mb-1">
              <CreditCard className="size-3.5 text-muted-foreground" />
              <span className="text-[11px] text-muted-foreground">Pack (never expire)</span>
            </div>
            <span
              className={`text-2xl font-bold ${
                packCredits > 0 ? "text-primary" : "text-muted-foreground"
              }`}
            >
              {packCredits}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between py-2 border-t border-border pt-3 mb-4">
          <span className="text-[12px] text-muted-foreground">Current Plan</span>
          <span
            className={`text-[11px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full ${
              isSubscribed
                ? "bg-primary/10 text-primary"
                : "bg-foreground/5 text-muted-foreground"
            }`}
          >
            {tier}
          </span>
        </div>

        {isSubscribed && periodEnd && (
          <p className="text-[11px] text-muted-foreground mb-4">
            Renews on <strong>{periodEnd}</strong>
          </p>
        )}

        {cancelError && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/[0.06] p-3 mb-3">
            <p className="text-[12px] text-destructive">{cancelError}</p>
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/4 border border-border text-[12px] font-medium text-muted-foreground hover:bg-foreground/8 transition-colors"
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </button>
          {isSubscribed ? (
            <button
              onClick={handleCancel}
              disabled={canceling}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-foreground/4 border border-border text-[12px] font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors disabled:opacity-60"
            >
              {canceling ? "Canceling…" : "Cancel Subscription"}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-primary-foreground text-[12px] font-semibold hover:bg-primary/80 transition-colors"
            >
              <Coins className="size-3.5" />
              Upgrade
            </Link>
          )}
        </div>
      </div>

      <TransactionHistory />
    </div>
  )
}
