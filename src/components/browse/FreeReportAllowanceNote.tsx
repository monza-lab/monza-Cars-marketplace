"use client"

import { useSyncExternalStore } from "react"
import { REPORT_GENERATED_DEVICE_KEY, REPORT_GENERATED_EVENT } from "@/lib/reportFunnel"

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange)
  window.addEventListener(REPORT_GENERATED_EVENT, onChange)
  return () => {
    window.removeEventListener("storage", onChange)
    window.removeEventListener(REPORT_GENERATED_EVENT, onChange)
  }
}

function clientSnapshot() {
  return window.localStorage.getItem(REPORT_GENERATED_DEVICE_KEY) === "true"
}

export function FreeReportAllowanceNote() {
  const hasGenerated = useSyncExternalStore(subscribe, clientSnapshot, () => false)

  return (
    <p className="text-xs text-muted-foreground">
      {hasGenerated
        ? "2 free reports left on this device — create an account to use them."
        : "Your first three reports are free — the first by email, two more with an account."}
    </p>
  )
}
