import { ArrowDown, ArrowUpRight } from "lucide-react"
import { Link } from "@/i18n/navigation"
import { FreeReportAllowanceNote } from "./FreeReportAllowanceNote"

export function ReportHeroCard({
  totalTracked,
  sampleReportUrl,
}: {
  totalTracked: number
  sampleReportUrl: string | null
}) {
  const proof = `6 platforms · 4 markets · ${totalTracked.toLocaleString("en-US")} cars tracked`
  const sampleHref = sampleReportUrl || "/sample-report"

  return (
    <section
      id="haus-report-hero"
      className="relative overflow-hidden rounded-xl border border-primary/35 bg-[linear-gradient(135deg,var(--card)_0%,color-mix(in_oklab,var(--primary)_10%,var(--card))_100%)] p-4 shadow-sm sm:col-span-2 sm:p-7"
      aria-labelledby="haus-report-hero-title"
    >
      <div className="relative z-10 max-w-2xl">
        <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-primary">Haus Report</p>
        <h1 id="haus-report-hero-title" className="mt-2 max-w-xl font-serif text-[27px] leading-[1.05] text-foreground sm:mt-3 sm:text-4xl">
          Know what any Porsche is actually worth.
        </h1>
        <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground sm:mt-3 sm:text-base">
          Pick any car below — your first investment-grade report is free. No account needed.
        </p>
        <p className="mt-2 text-[11px] font-medium tracking-wide text-foreground/80 sm:mt-4 sm:text-xs">{proof}</p>
        <div className="mt-3 flex flex-row flex-wrap items-center gap-3 sm:mt-5">
          {sampleReportUrl ? (
            <a
              href={sampleHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              See a sample report
              <ArrowUpRight className="size-4" />
            </a>
          ) : (
            <Link
              href={sampleHref}
              className="inline-flex min-h-11 items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
            >
              See a sample report
              <ArrowUpRight className="size-4" />
            </Link>
          )}
          <a href="#browse-results" className="inline-flex items-center gap-1 text-sm font-medium text-foreground/75 hover:text-primary">
            or pick a car below
            <ArrowDown className="size-3.5" />
          </a>
        </div>
        <div className="mt-2 sm:mt-4"><FreeReportAllowanceNote /></div>
      </div>
      <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full border border-primary/15" />
      <div aria-hidden="true" className="absolute -right-8 -top-10 size-40 rounded-full border border-primary/15" />
    </section>
  )
}
