import type { HausReport, RemarkableClaim } from "@/lib/fairValue/types"
import type { RegionalMarketStats } from "@/lib/reports/types"
import { ExternalLink } from "lucide-react"

interface SourceRow {
  name: string
  detail: string | null
  url: string | null
  captureDate: string | null
}

interface SourcesCategory {
  label: string
  rows: SourceRow[]
}

interface ReportSourcesBlockProps {
  regions?: RegionalMarketStats[]
  remarkableClaims?: RemarkableClaim[]
  signalsExtractedAt?: string | null
  extractionVersion?: string
  modifierCitationUrls?: Array<{ key: string; url: string | null }>
}

function uniqueBy<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>()
  return items.filter((item) => {
    const key = keyFn(item)
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function buildCategories({
  regions = [],
  remarkableClaims = [],
  signalsExtractedAt,
  extractionVersion,
  modifierCitationUrls = [],
}: ReportSourcesBlockProps): SourcesCategory[] {
  // 1) Market data sources (from regional stats)
  const marketRows: SourceRow[] = regions.flatMap((r) =>
    r.sources.map((source) => ({
      name: source,
      detail: `${r.region} · ${r.totalListings} listings`, // [HARDCODED]
      url: null,
      captureDate: r.newestDate,
    }))
  )

  // 2) Reference pack citations (from Tier 2+ claims)
  const referencePackRows: SourceRow[] = remarkableClaims
    .filter((c) => c.source_type === "reference_pack" && c.source_url)
    .map((c) => ({
      name: hostname(c.source_url!) ?? "reference", // [HARDCODED]
      detail: null,
      url: c.source_url,
      captureDate: c.capture_date,
    }))

  // 3) KB citations (from Tier 2+ claims)
  const kbRows: SourceRow[] = remarkableClaims
    .filter((c) => c.source_type === "kb_entry")
    .map((c) => ({
      name: c.source_url ? (hostname(c.source_url) ?? "KB entry") : `KB ${c.source_ref}`, // [HARDCODED]
      detail: null,
      url: c.source_url,
      captureDate: c.capture_date,
    }))

  // 4) Specialist agent sources (from Tier 3 claims)
  const agentRows: SourceRow[] = remarkableClaims
    .filter((c) => c.source_type === "specialist_agent")
    .map((c) => ({
      name: c.source_url ? (hostname(c.source_url) ?? "specialist finding") : "specialist finding", // [HARDCODED]
      detail: null,
      url: c.source_url,
      captureDate: c.capture_date,
    }))

  // 5) Modifier citations
  const modifierRows: SourceRow[] = modifierCitationUrls
    .filter((m) => m.url)
    .map((m) => ({
      name: hostname(m.url!) ?? "modifier citation", // [HARDCODED]
      detail: m.key.replace(/_/g, " "),
      url: m.url,
      captureDate: null,
    }))

  void signalsExtractedAt
  void extractionVersion

  return [
    { label: "Market data", rows: uniqueBy(marketRows, (r) => `${r.name}|${r.detail}`) }, // [HARDCODED]
    { label: "Modifier citations", rows: uniqueBy(modifierRows, (r) => r.url ?? r.name) }, // [HARDCODED]
    { label: "Reference pack", rows: uniqueBy(referencePackRows, (r) => r.url ?? r.name) }, // [HARDCODED]
    { label: "Knowledge base", rows: uniqueBy(kbRows, (r) => r.url ?? r.name) }, // [HARDCODED]
    { label: "Specialist agent", rows: uniqueBy(agentRows, (r) => r.url ?? r.name) }, // [HARDCODED]
  ].filter((cat) => cat.rows.length > 0)
}

function hostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "")
  } catch {
    return null
  }
}

export function ReportSourcesBlock(props: ReportSourcesBlockProps) {
  const categories = buildCategories(props)

  if (categories.length === 0) {
    return null
  }

  return (
    <section className="px-4 py-6" aria-labelledby="sources-heading">
      <h2
        id="sources-heading"
        className="font-serif text-[18px] font-semibold md:text-[20px]"
      >
        {/* [HARDCODED] */}Sources
      </h2>

      <div className="mt-4 space-y-5">
        {categories.map((cat) => (
          <div key={cat.label}>
            <h3 className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {cat.label}
            </h3>
            <ul className="mt-2 grid grid-cols-1 gap-2 md:grid-cols-2">
              {cat.rows.map((row, i) => (
                <li
                  key={`${row.url ?? row.name}-${i}`}
                  className="rounded-lg border border-border bg-card/30 p-3 text-[12px]"
                >
                  {row.url ? (
                    <a
                      href={row.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                    >
                      {row.name} <ExternalLink className="size-3" />
                    </a>
                  ) : (
                    <span className="font-medium">{row.name}</span>
                  )}
                  {row.detail && (
                    <p className="mt-0.5 text-[11px] text-muted-foreground">{row.detail}</p>
                  )}
                  {row.captureDate && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">
                      {/* [HARDCODED] */}Captured {row.captureDate}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  )
}

// Re-export HausReport for callers that want to pass a full report object
export type { HausReport }
