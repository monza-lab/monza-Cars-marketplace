"use client"

import { useEffect } from "react"
import Link from "next/link"
import { XCircle } from "lucide-react"
import { track } from "@/lib/analytics/events"

export default function CheckoutCancelPage() {
  useEffect(() => {
    track({
      event: "checkout_cancelled",
      payload: { planId: "", reason: "user_back" },
    })
  }, [])

  return (
    <div className="max-w-md w-full rounded-2xl border border-border bg-foreground/2 p-8 text-center">
      <div className="inline-flex items-center justify-center size-12 rounded-full bg-muted/30 mb-4">
        <XCircle className="size-6 text-muted-foreground" />
      </div>
      <h1 className="text-xl font-bold text-foreground mb-2">No charge was made</h1>
      <p className="text-[13px] text-muted-foreground mb-6">
        You backed out of checkout. Pick up where you left off?
      </p>
      <Link
        href="/pricing"
        className="inline-block py-3 px-5 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/80 transition-colors"
      >
        Back to Pricing →
      </Link>
    </div>
  )
}
