// src/components/detail/ListingHook.tsx
"use client"

import { useLocale } from "next-intl"
import type { ReactNode } from "react"
import { useListingRewrite } from "@/hooks/useListingRewrite"

interface ListingHookProps {
  listingId: string
  fallback: ReactNode
}

const SUPPORTED = new Set(["en", "es", "de", "ja"])

export function ListingHook({ listingId, fallback }: ListingHookProps) {
  const locale = useLocale()
  const safeLocale = SUPPORTED.has(locale) ? locale : "en"
  const { data, isLoading } = useListingRewrite(listingId, safeLocale)

  if (isLoading) {
    return (
      <div aria-busy="true" className="space-y-2">
        <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
        <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
        <div className="h-3 w-4/6 animate-pulse rounded bg-muted" />
      </div>
    )
  }

  if (!data) {
    return <>{fallback}</>
  }

  return (
    <div>
      <p className="text-[14px] italic leading-relaxed text-foreground">{data.headline}</p>
      {data.highlights.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {data.highlights.map((h, i) => (
            <li key={i} className="flex gap-2 text-[13px] text-muted-foreground">
              <span className="text-primary">•</span>
              <span>{h}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
