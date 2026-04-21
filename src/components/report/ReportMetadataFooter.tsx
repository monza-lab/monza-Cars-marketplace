import Link from "next/link"
import { ArrowUpRight } from "lucide-react"

interface ReportMetadataFooterProps {
  generatedAt: string
  reportHash: string | null
  modifierVersion: string
  extractionVersion: string
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })
}

function shortHash(h: string | null): string {
  if (!h) return "—"
  return h.length > 12 ? h.slice(0, 12) : h
}

export function ReportMetadataFooter({
  generatedAt,
  reportHash,
  modifierVersion,
  extractionVersion,
}: ReportMetadataFooterProps) {
  return (
    <footer className="border-t border-border px-4 py-4">
      <p className="text-[11px] leading-relaxed text-muted-foreground">
        Haus Report · Generated {fmtDate(generatedAt)} · Hash:{" "}
        <span className="font-mono">{shortHash(reportHash)}</span> · Modifier library{" "}
        {modifierVersion} · Extraction {extractionVersion}
        {reportHash && (
          <>
            {" · "}
            <Link
              href={`/verify/${reportHash}`}
              className="inline-flex items-center gap-0.5 text-primary hover:underline"
            >
              Verify this report
              <ArrowUpRight className="size-3" />
            </Link>
          </>
        )}
      </p>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70">
        Content is provided for informational and educational purposes only. Market
        signals, price benchmarks, and analytical assessments do not constitute
        financial, investment, legal, or tax advice.
      </p>
    </footer>
  )
}
