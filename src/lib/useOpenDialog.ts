"use client"

import { useEffect, useState } from "react"

/**
 * Radix marks an open dialog (and our BottomSheet, which is a Radix dialog)
 * with role="dialog" + data-state="open". Anything fixed to the viewport that
 * outranks the dialog's z-index — the cookie banner, a rescue CTA — has to know
 * a dialog is up, or it lands on top of the very moment it was meant to
 * support: on mobile the consent card covered "No password. No card…" and the
 * Privacy Policy link exactly while we were asking for an email.
 */
export const OPEN_DIALOG_SELECTOR =
  '[role="dialog"][data-state="open"], [role="alertdialog"][data-state="open"]'

export function hasOpenDialog(scope: ParentNode | null | undefined): boolean {
  if (!scope || typeof scope.querySelector !== "function") return false
  return scope.querySelector(OPEN_DIALOG_SELECTOR) !== null
}

export function useOpenDialog(): boolean {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const sync = () => setOpen(hasOpenDialog(document.body))
    sync()

    const observer = new MutationObserver(sync)
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["role", "data-state"],
    })
    return () => observer.disconnect()
  }, [])

  return open
}
