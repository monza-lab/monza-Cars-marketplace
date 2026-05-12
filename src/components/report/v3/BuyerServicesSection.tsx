import type { BuyerServices } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface BuyerServicesSectionProps {
  data: BuyerServices | null
}

const AVAILABILITY_STYLE: Record<string, string> = {
  readily_available: "text-green-600 dark:text-green-400",
  available: "text-blue-600 dark:text-blue-400",
  limited: "text-amber-600 dark:text-amber-400",
  scarce: "text-red-600 dark:text-red-400",
}

const AVAILABILITY_LABEL: Record<string, string> = {
  readily_available: "Readily Available",
  available: "Available",
  limited: "Limited",
  scarce: "Scarce",
}

function fmtRange(range: { low: number; high: number }): string {
  const fmt = (v: number) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v)
  return `${fmt(range.low)} — ${fmt(range.high)}`
}

export function BuyerServicesSection({ data }: BuyerServicesSectionProps) {
  if (!data) return null

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Buyer Services</h2>
        <DataTrustBadge level="ai_estimated" />
      </div>

      {/* Parts availability */}
      {data.partsAvailability && (
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Parts Availability</h3>
            <span className={`text-sm font-bold ${AVAILABILITY_STYLE[data.partsAvailability.overallRating] ?? ""}`}>
              {AVAILABILITY_LABEL[data.partsAvailability.overallRating] ?? data.partsAvailability.overallRating}
            </span>
          </div>
          <div className="space-y-1 text-sm text-muted-foreground">
            <p><span className="font-medium text-foreground">OEM:</span> {data.partsAvailability.oemNote}</p>
            <p><span className="font-medium text-foreground">Aftermarket:</span> {data.partsAvailability.aftermarketNote}</p>
          </div>
          {(data.partsAvailability?.commonParts?.length ?? 0) > 0 && (
            <div className="mt-3">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] uppercase tracking-wide text-muted-foreground border-b border-border">
                    <th className="text-left pb-1 font-medium">Part</th>
                    <th className="text-left pb-1 font-medium">Availability</th>
                    <th className="text-right pb-1 font-medium">Price Range</th>
                  </tr>
                </thead>
                <tbody>
                  {data.partsAvailability.commonParts.map((part, i) => (
                    <tr key={i} className="border-b border-border/50 last:border-0">
                      <td className="py-1.5 text-foreground">{part.name}</td>
                      <td className="py-1.5 text-muted-foreground">{part.availability}</td>
                      <td className="py-1.5 text-right font-mono text-muted-foreground">{part.priceRange}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Insurance estimates */}
      {data.insuranceEstimates && (
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Insurance Estimates</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800/40 p-3">
              <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Collector Policy</p>
              <p className="mt-1 text-sm font-bold font-mono text-foreground">
                {fmtRange(data.insuranceEstimates.collectorPolicy.annualPremium)}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Mileage limit: {data.insuranceEstimates.collectorPolicy.mileageLimit}
              </p>
              {data.insuranceEstimates.collectorPolicy.providers.length > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Providers: {data.insuranceEstimates.collectorPolicy.providers.join(", ")}
                </p>
              )}
            </div>
            {data.insuranceEstimates.dailyDriver && (
              <div className="rounded-lg bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700/40 p-3">
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Daily Driver Policy</p>
                <p className="mt-1 text-sm font-bold font-mono text-foreground">
                  {fmtRange(data.insuranceEstimates.dailyDriver.annualPremium)}
                </p>
              </div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-2 italic">
            {data.insuranceEstimates.notes} &middot; Category: {data.insuranceEstimates.vehicleCategory}
          </p>
        </div>
      )}

      {/* Transport estimates */}
      {data.transportEstimates && (
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-semibold text-foreground">Transport Estimates</h3>
            <span className="text-xs font-medium text-muted-foreground capitalize">
              Recommended: {data.transportEstimates.recommendation}
            </span>
          </div>
          {(data.transportEstimates?.specialHandling?.length ?? 0) > 0 && (
            <div className="mb-2">
              <p className="text-xs text-muted-foreground">
                Special handling: {data.transportEstimates.specialHandling.join(", ")}
              </p>
            </div>
          )}
          {data.transportEstimates.routes.map((route, i) => (
            <div key={i} className="mb-2 last:mb-0">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">{route.type} Transport</p>
              <div className="grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-muted-foreground">Short Haul</p>
                  <p className="font-mono text-foreground">{route.shortHaul.perMile}/mi</p>
                  <p className="text-[10px] text-muted-foreground">{route.shortHaul.example}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Medium Haul</p>
                  <p className="font-mono text-foreground">{route.mediumHaul.perMile}/mi</p>
                  <p className="text-[10px] text-muted-foreground">{route.mediumHaul.example}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Long Haul</p>
                  <p className="font-mono text-foreground">{route.longHaul.perMile}/mi</p>
                  <p className="text-[10px] text-muted-foreground">{route.longHaul.example}</p>
                </div>
              </div>
            </div>
          ))}
          {data.transportEstimates.seasonalNote && (
            <p className="text-xs text-muted-foreground mt-2 italic">{data.transportEstimates.seasonalNote}</p>
          )}
        </div>
      )}

      {/* Original MSRP */}
      {data.originalMsrp && (
        <div className="rounded-lg border border-border bg-background/50 p-4">
          <h3 className="text-sm font-semibold text-foreground mb-2">Original MSRP</h3>
          <div className="flex items-baseline gap-4">
            {data.originalMsrp.basePrice != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Base</p>
                <p className="text-sm font-bold font-mono text-foreground">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data.originalMsrp.basePrice)}
                </p>
              </div>
            )}
            {data.originalMsrp.adjustedForInflation != null && (
              <div>
                <p className="text-[10px] uppercase tracking-wide text-muted-foreground">Inflation-Adjusted</p>
                <p className="text-sm font-bold font-mono text-foreground">
                  {new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(data.originalMsrp.adjustedForInflation)}
                </p>
              </div>
            )}
          </div>
          {data.originalMsrp.note && (
            <p className="text-xs text-muted-foreground mt-1">{data.originalMsrp.note}</p>
          )}
        </div>
      )}
    </section>
  )
}
