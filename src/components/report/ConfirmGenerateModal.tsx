"use client"

import * as Dialog from "@radix-ui/react-dialog"
import { X, Check, Coins } from "lucide-react"
import type { CollectorCar } from "@/lib/curatedCars"

interface ConfirmGenerateModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  car: CollectorCar
  cost: number
  balance: number
  onConfirm: () => void
  isUnlimited?: boolean
}

const INCLUDED_SECTIONS = [
  "Executive summary",
  "Identity & spec",
  "Fair value & comparables",
  "Performance benchmark",
  "Risk score & due diligence",
  "Market context & timing",
  "Similar listings nearby",
  "Final verdict",
  "PDF + Excel downloadables",
]

export function ConfirmGenerateModal({
  open,
  onOpenChange,
  car,
  cost,
  balance,
  onConfirm,
  isUnlimited = false,
}: ConfirmGenerateModalProps) {
  const balanceAfter = balance - cost

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <Dialog.Content
          className="fixed left-1/2 top-1/2 z-50 grid w-[calc(100%-2rem)] max-w-[480px] -translate-x-1/2 -translate-y-1/2 gap-5 rounded-2xl border border-border bg-background p-6 shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:slide-in-from-bottom-4 md:p-7"
        >
          <Dialog.Close
            aria-label="Close"
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-4" />
          </Dialog.Close>

          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Haus Report
            </p>
            <Dialog.Title className="mt-2 font-serif text-[26px] leading-tight tracking-tight text-foreground">
              {car.title}
            </Dialog.Title>
            <Dialog.Description className="mt-1 text-[13px] text-muted-foreground">
              {car.year} · {car.make} · acquisition analysis
            </Dialog.Description>
          </div>

          <div className="rounded-xl border border-border bg-foreground/[0.02] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Includes {INCLUDED_SECTIONS.length} sections
            </p>
            <ul className="mt-3 space-y-1.5">
              {INCLUDED_SECTIONS.map(section => (
                <li
                  key={section}
                  className="flex items-center gap-2 text-[13px] text-foreground"
                >
                  <Check className="size-3.5 shrink-0 text-primary" />
                  <span>{section}</span>
                </li>
              ))}
            </ul>
          </div>

          {isUnlimited ? (
            <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-4 text-[13px]">
              <div className="flex items-center gap-2">
                <Check className="size-4 text-primary shrink-0" />
                <span className="font-medium text-foreground">Included with your plan</span>
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground ml-6">No pistons deducted</p>
            </div>
          ) : (
            <div className="rounded-xl border border-border bg-foreground/[0.02] p-4 font-mono text-[13px] tabular-nums">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">Cost</span>
                <span className="flex items-center gap-1.5 text-foreground">
                  <Coins className="size-3.5 text-primary" />
                  {cost} pistons
                </span>
              </div>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-muted-foreground">Balance</span>
                <span className="text-foreground">
                  {balance} → {balanceAfter} pistons
                </span>
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 md:flex-row md:justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="rounded-xl px-5 py-3 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground transition-colors hover:bg-foreground/5"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-primary px-6 py-3 text-[12px] font-semibold uppercase tracking-wider text-background transition-transform hover:bg-primary/85 active:scale-[0.97]"
            >
              Generate report
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
