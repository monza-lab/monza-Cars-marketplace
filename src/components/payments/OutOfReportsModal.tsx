"use client"

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import { Coins } from "lucide-react"
import Link from "next/link"

interface OutOfReportsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  nextResetDate?: string | null
}

export function OutOfReportsModal({
  open,
  onOpenChange,
  nextResetDate,
}: OutOfReportsModalProps) {
  const formattedDate = nextResetDate
    ? new Date(nextResetDate).toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
      })
    : "the 1st of next month"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border text-foreground max-w-md">
        <DialogHeader>
          <div className="inline-flex items-center justify-center size-10 rounded-lg bg-primary/10 mb-3">
            <Coins className="size-5 text-primary" />
          </div>
          <DialogTitle className="text-[17px] font-bold text-foreground">
            You&apos;ve used your 3 Free Reports this month
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-[13px]">
            Your next reset is {formattedDate}. Upgrade now to keep analyzing Porsches.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 mt-2">
          <Link
            href="/pricing"
            onClick={() => onOpenChange(false)}
            className="block w-full py-3 rounded-xl bg-primary text-primary-foreground text-[13px] font-semibold hover:bg-primary/80 transition-colors text-center"
          >
            Go Unlimited — $59/mo · Reports + Watchlist + Alerts
          </Link>
          <Link
            href="/pricing"
            onClick={() => onOpenChange(false)}
            className="block w-full py-3 rounded-xl bg-foreground/6 border border-border text-[13px] font-medium hover:bg-foreground/10 transition-colors text-center"
          >
            Or buy a Pack of 5 that never expires — $39
          </Link>
        </div>
      </DialogContent>
    </Dialog>
  )
}
