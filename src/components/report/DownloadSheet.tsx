"use client"

import { useEffect } from "react"
import { Download, FileSpreadsheet, FileText, X } from "lucide-react"

interface DownloadSheetProps {
  open: boolean
  onClose: () => void
  listingId: string
  reportHash: string | null
  verifyHref?: string
}

export function DownloadSheet({
  open,
  onClose,
  listingId,
  reportHash,
  verifyHref,
}: DownloadSheetProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [open, onClose])

  if (!open) return null

  const pdfHref = `/api/reports/${listingId}/pdf`
  const excelHref = `/api/reports/${listingId}/excel`
  const shortHash = reportHash ? reportHash.slice(0, 12) : null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="download-sheet-heading"
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm md:items-center"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-2xl bg-card p-6 shadow-2xl md:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              {/* [HARDCODED] */}Haus Report
            </p>
            <h3
              id="download-sheet-heading"
              className="mt-1 font-serif text-[22px] font-semibold leading-tight md:text-[24px]"
            >
              {/* [HARDCODED] */}Download report
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close download sheet" /* [HARDCODED] */
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-foreground/10"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-5 space-y-3">
          <DownloadOption
            href={pdfHref}
            filename={`haus-report-${shortHash ?? listingId}.pdf`}
            icon={<FileText className="size-5" />}
            label="PDF"
            description="Editorial 4–6 page document. Hash-verifiable." /* [HARDCODED] */
          />
          <DownloadOption
            href={excelHref}
            filename={`haus-report-${shortHash ?? listingId}.xlsx`}
            icon={<FileSpreadsheet className="size-5" />}
            label="Excel"
            description="Interactive model with live formulas across 4 sheets." /* [HARDCODED] */
          />
        </div>

        {shortHash && (
          <div className="mt-5 rounded-lg bg-foreground/5 px-3 py-2.5 text-[11px] font-mono">
            <span className="text-muted-foreground">{/* [HARDCODED] */}Hash · </span>
            <span className="text-foreground">{shortHash}</span>
            {verifyHref && (
              <>
                <span className="mx-1.5 text-muted-foreground">·</span>
                <a
                  href={verifyHref}
                  className="text-primary hover:underline"
                >
                  {/* [HARDCODED] */}Verify
                </a>
              </>
            )}
          </div>
        )}

        <p className="mt-4 text-[11px] italic leading-relaxed text-muted-foreground">
          {/* [HARDCODED] */}Downloads are included with your Haus Report.
        </p>
      </div>
    </div>
  )
}

interface DownloadOptionProps {
  href: string
  filename: string
  icon: React.ReactNode
  label: string
  description: string
}

function DownloadOption({
  href,
  filename,
  icon,
  label,
  description,
}: DownloadOptionProps) {
  return (
    <a
      href={href}
      download={filename}
      className="flex items-center gap-3 rounded-xl border border-border bg-card/40 p-4 transition-colors hover:border-primary/50 hover:bg-primary/5"
    >
      <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <span className="text-[14px] font-semibold">{label}</span>
        <p className="mt-0.5 text-[12px] text-muted-foreground">{description}</p>
      </div>
      <Download className="size-4 shrink-0 text-muted-foreground" />
    </a>
  )
}
