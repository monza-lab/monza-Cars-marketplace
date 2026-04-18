"use client"

import { useEffect } from "react"
import { AlertTriangle, RotateCcw, Home } from "lucide-react"
import Link from "next/link"

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[Monza Error Boundary]", error)
  }, [error])

  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center px-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(212,115,138,0.03),transparent_70%)]" />

      <div className="relative text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="size-8 text-destructive" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-[14px] text-muted-foreground leading-relaxed">
          An unexpected error occurred. This has been logged automatically.
          Try refreshing the page or head back to the dashboard.
        </p>

        {/* Error digest (dev info) */}
        {error.digest && (
          <p className="mt-3 text-[11px] tabular-nums text-muted-foreground">
            Error ID: {error.digest}
          </p>
        )}

        {/* Decorative separator */}
        <div className="mx-auto my-8 flex items-center gap-3">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/10" />
          <div className="size-1.5 rounded-full bg-destructive/50" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/80"
          >
            <RotateCcw className="size-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-border bg-foreground/4 px-6 py-3 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-foreground/8"
          >
            <Home className="size-4" />
            Back to Home
          </Link>
        </div>

        {/* Bottom tag */}
        <p className="mt-12 text-[10px] uppercase tracking-widest text-muted-foreground">
          Monza Lab &middot; Investment-Grade Automotive Assets
        </p>
      </div>
    </div>
  )
}
