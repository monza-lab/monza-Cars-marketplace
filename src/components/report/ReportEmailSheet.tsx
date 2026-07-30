"use client"

import { FormEvent, useState } from "react"
import { Loader2, Mail } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { readStoredAttribution } from "@/lib/marketing/attribution"

const DEVICE_KEY = "monzahaus_report_device"

async function waitForV3Completion(response: Response): Promise<void> {
  const contentType = response.headers.get("content-type") ?? ""
  if (contentType.includes("application/json")) {
    const result = await response.json() as { cached?: boolean; error?: string }
    if (!response.ok) throw new Error(result.error || "Report generation failed. Please retry.")
    if (result.cached) return
    throw new Error("Report generation ended without a complete report.")
  }
  if (!response.ok || !response.body) {
    throw new Error("Report generation failed. Please retry.")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let currentEvent = ""
  let completed = false
  let failure: string | null = null

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split("\n")
    buffer = lines.pop() ?? ""

    for (const line of lines) {
      if (line.startsWith("event: ")) {
        currentEvent = line.slice(7).trim()
        continue
      }
      if (!line.startsWith("data: ") || !currentEvent) continue
      const data = JSON.parse(line.slice(6)) as {
        message?: string
        report?: { stepsCompleted?: number; stepsFailed?: number }
      }
      if (currentEvent === "error") {
        failure = data.message || "Report generation failed. Please retry."
      } else if (
        currentEvent === "complete"
        && data.report?.stepsCompleted === 10
        && data.report?.stepsFailed === 0
      ) {
        completed = true
      }
      currentEvent = ""
    }
  }

  if (failure) throw new Error(failure)
  if (!completed) throw new Error("The thorough report did not complete. Please retry.")
}

function reportDeviceId(): string {
  const existing = window.localStorage.getItem(DEVICE_KEY)
  if (existing) return existing
  const created = crypto.randomUUID()
  window.localStorage.setItem(DEVICE_KEY, created)
  return created
}

export function ReportEmailSheet({
  open,
  listingId,
  onOpenChange,
  onGenerated,
  onAuthRequired,
  onClaimRequired,
}: {
  open: boolean
  listingId: string
  onOpenChange: (open: boolean) => void
  onGenerated: (token: string) => void
  onAuthRequired?: (email: string) => void
  onClaimRequired?: (email: string) => void
}) {
  const [email, setEmail] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const attribution = readStoredAttribution()
      const accessResponse = await fetch("/api/report-access/request", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          email,
          listingId,
          deviceId: reportDeviceId(),
          ...(attribution ? { attribution } : {}),
        }),
      })
      const access = await accessResponse.json() as { ok: boolean; token?: string; code?: string }
      if (!access.ok || !access.token) {
        if (access.code === "AUTH_REQUIRED") return onAuthRequired?.(email)
        if (access.code === "CLAIM_REQUIRED") return onClaimRequired?.(email)
        throw new Error(access.code === "RATE_LIMITED"
          ? "Too many report requests. Please try again in an hour."
          : access.code === "DISPOSABLE_EMAIL"
            ? "Please use a permanent email address."
            : "We could not start this report.")
      }

      const reportResponse = await fetch("/api/analyze/v3", {
        method: "POST",
        headers: { "content-type": "application/json", "x-report-access-token": access.token },
        body: JSON.stringify({ listingId }),
      })
      await waitForV3Completion(reportResponse)
      onGenerated(access.token)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Report generation failed. Please retry.")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={submitting ? undefined : onOpenChange}>
      <DialogContent className="bottom-0 top-auto w-full max-w-lg translate-y-0 rounded-b-none rounded-t-lg border-border bg-card p-6 sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-lg">
        <DialogTitle className="font-serif text-2xl">Generate Haus Report</DialogTitle>
        <DialogDescription className="text-sm leading-relaxed text-muted-foreground">
          Enter your email. Your report will open here and arrive in your inbox.
        </DialogDescription>
        <form onSubmit={submit} className="mt-4 space-y-3">
          <label className="block text-xs font-semibold text-foreground" htmlFor="report-email">Email</label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input id="report-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={submitting} className="h-12 w-full rounded-md border border-border bg-background pl-10 pr-3 text-base outline-none focus-visible:ring-2 focus-visible:ring-primary" placeholder="you@example.com" />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <button type="submit" disabled={submitting || !email} className="flex h-12 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-semibold text-primary-foreground disabled:opacity-60">
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Generating your report..." : "Generate Haus Report - free"}
          </button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
