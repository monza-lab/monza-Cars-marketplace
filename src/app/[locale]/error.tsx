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
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(248,180,217,0.03),transparent_70%)]" />

      <div className="relative text-center max-w-md">
        {/* Icon */}
        <div className="mx-auto mb-6 flex size-16 items-center justify-center rounded-2xl bg-[#FB923C]/10">
          <AlertTriangle className="size-8 text-[#FB923C]" />
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold tracking-tight text-[#FFFCF7] sm:text-3xl">
          Something went wrong
        </h1>
        <p className="mt-3 text-[14px] text-[#6B7280] leading-relaxed">
          An unexpected error occurred. This has been logged automatically.
          Try refreshing the page or head back to the dashboard.
        </p>

        {/* Error digest (dev info) */}
        {error.digest && (
          <p className="mt-3 text-[11px] font-mono text-[#4B5563]">
            Error ID: {error.digest}
          </p>
        )}

        {/* Decorative separator */}
        <div className="mx-auto my-8 flex items-center gap-3">
          <div className="h-px w-16 bg-gradient-to-r from-transparent to-white/10" />
          <div className="size-1.5 rounded-full bg-[#FB923C]/50" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent to-white/10" />
        </div>

        {/* Actions */}
        <div className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <button
            onClick={reset}
            className="flex items-center gap-2 rounded-xl bg-[#F8B4D9] px-6 py-3 text-[13px] font-semibold text-[#0b0b10] transition-colors hover:bg-[#f4cbde]"
          >
            <RotateCcw className="size-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-6 py-3 text-[13px] font-medium text-[#D1D5DB] transition-colors hover:bg-white/[0.08]"
          >
            <Home className="size-4" />
            Back to Home
          </Link>
        </div>

        {/* Bottom tag */}
        <p className="mt-12 text-[10px] uppercase tracking-widest text-[#4B5563]">
          Monza Lab &middot; Investment-Grade Automotive Assets
        </p>
      </div>
    </div>
  )
}
