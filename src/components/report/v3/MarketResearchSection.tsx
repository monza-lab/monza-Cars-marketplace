import type { MarketResearch } from "@/lib/reports/types-v3"
import { DataTrustBadge } from "../DataTrustBadge"

interface MarketResearchSectionProps {
  data: MarketResearch | null
}

const SENTIMENT_STYLE: Record<string, string> = {
  positive: "border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20",
  mixed: "border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/20",
  negative: "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-950/20",
}

const SENTIMENT_DOT: Record<string, string> = {
  positive: "bg-green-500",
  mixed: "bg-amber-500",
  negative: "bg-red-500",
}

export function MarketResearchSection({ data }: MarketResearchSectionProps) {
  if (!data) return null

  return (
    <section className="space-y-4 rounded-2xl border border-border bg-card p-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <h2 className="text-xl font-semibold text-foreground">Market Research</h2>
        <DataTrustBadge level="ai_analysis" />
      </div>

      {/* Expert consensus */}
      {(data.expertConsensus?.compiledAnalysis?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Expert Consensus</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {data.expertConsensus!.compiledAnalysis.map((item, i) => (
              <div
                key={i}
                className={`rounded-lg border p-3 ${SENTIMENT_STYLE[item.sentiment] ?? "border-border bg-background/50"}`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${SENTIMENT_DOT[item.sentiment] ?? "bg-gray-400"}`} />
                  <span className="text-xs font-semibold uppercase tracking-wide text-foreground">{item.category}</span>
                </div>
                <p className="text-sm text-muted-foreground">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Owner sentiment */}
      {data.ownerSentiment && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-foreground">Owner Sentiment</h3>

          {(data.ownerSentiment?.commonPraise?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">What Owners Love</p>
              <ul className="space-y-1">
                {data.ownerSentiment!.commonPraise.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-green-500 mt-0.5 shrink-0">+</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.ownerSentiment?.commonComplaints?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-red-600 dark:text-red-400 mb-1">Common Complaints</p>
              <ul className="space-y-1">
                {data.ownerSentiment!.commonComplaints.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-red-500 mt-0.5 shrink-0">-</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {(data.ownerSentiment?.ownerTips?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">Owner Tips</p>
              <ul className="space-y-1">
                {data.ownerSentiment!.ownerTips.map((item, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <span className="text-blue-500 mt-0.5 shrink-0">&#8226;</span>
                    <span className="text-muted-foreground">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Heritage */}
      {data.heritage && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Heritage</h3>
          <p className="text-sm leading-relaxed text-muted-foreground">{data.heritage}</p>
        </div>
      )}

      {/* Events */}
      {(data.relevantEvents?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-2">Relevant Events</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {data.relevantEvents.map((event, i) => (
              <div key={i} className="rounded-lg border border-border bg-background/50 p-3">
                <p className="text-sm font-medium text-foreground">{event.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {event.frequency} &middot; {event.location}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{event.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Clubs */}
      {(data.ownerClubs?.length ?? 0) > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-1">Owner Clubs</h3>
          <div className="flex flex-wrap gap-2">
            {data.ownerClubs.map((club, i) => (
              <span key={i} className="inline-flex items-center rounded-full bg-gray-100 dark:bg-gray-800 px-3 py-1 text-xs text-foreground">
                {club}
              </span>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}
