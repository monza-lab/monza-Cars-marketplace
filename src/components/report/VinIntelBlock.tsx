"use client"

import type { VinIntelligence } from "@/lib/fairValue/types"

interface VinIntelBlockProps {
  vinIntel: VinIntelligence | null | undefined
  vin: string | null | undefined
}

export function VinIntelBlock({ vinIntel, vin }: VinIntelBlockProps) {
  if (!vinIntel || !vinIntel.vinDecoded) {
    if (!vin) return null
    return (
      <section className="rounded-xl border border-border bg-card p-5 space-y-2">
        <h3 className="font-serif text-[15px] font-semibold">{/* [HARDCODED] */}VIN Intelligence</h3>
        <p className="text-[13px] text-muted-foreground">
          {/* [HARDCODED] */}VIN <span className="font-mono">{vin}</span> — could not be decoded.
        </p>
      </section>
    )
  }

  return (
    <section className="rounded-xl border border-border bg-card p-5 space-y-3">
      <h3 className="font-serif text-[15px] font-semibold">{/* [HARDCODED] */}VIN Intelligence</h3>

      <p className="text-[13px] font-mono text-foreground">{vin}</p>

      <div className="grid grid-cols-2 gap-3 text-[13px]">
        {vinIntel.plant && (
          <div>
            <p className="text-muted-foreground">{/* [HARDCODED] */}Factory</p>
            <p className="font-medium">{vinIntel.plant}</p>
          </div>
        )}
        {vinIntel.bodyHint && (
          <div>
            <p className="text-muted-foreground">{/* [HARDCODED] */}Body/Generation</p>
            <p className="font-medium">{vinIntel.bodyHint}</p>
          </div>
        )}
        {vinIntel.modelYearFromVin && (
          <div>
            <p className="text-muted-foreground">{/* [HARDCODED] */}Model Year (VIN)</p>
            <p className="font-medium">{vinIntel.modelYearFromVin}</p>
          </div>
        )}
      </div>

      {!vinIntel.yearMatchesListing && (
        <div className="rounded-lg bg-red-50 dark:bg-red-950/20 p-3 text-[12px] text-red-700 dark:text-red-400">
          {/* [HARDCODED] */}<strong>Warning:</strong> VIN model year does not match listing year
        </div>
      )}

      {vinIntel.warnings.length > 0 && (
        <ul className="space-y-1">
          {vinIntel.warnings.map((w, i) => (
            <li key={i} className="text-[12px] text-amber-600 dark:text-amber-400">{w}</li>
          ))}
        </ul>
      )}
    </section>
  )
}
