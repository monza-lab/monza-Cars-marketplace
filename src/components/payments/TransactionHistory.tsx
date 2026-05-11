"use client"

import { Clock } from "lucide-react"

// ─── TYPES ───

type TransactionType =
  | "FREE_MONTHLY"
  | "PURCHASE"
  | "ANALYSIS_USED"
  | "BONUS"
  | "REFUND"

interface Transaction {
  id: string
  date: string
  type: TransactionType
  description: string
  amount: number // positive = added, negative = used
}

// ─── BADGE CONFIG ───

const TYPE_CONFIG: Record<
  TransactionType,
  { label: string; color: string; bg: string }
> = {
  FREE_MONTHLY: {
    label: "Free",
    color: "text-positive",
    bg: "bg-positive/10",
  },
  PURCHASE: {
    label: "Purchase",
    color: "text-primary",
    bg: "bg-primary/10",
  },
  ANALYSIS_USED: {
    label: "Analysis",
    color: "text-muted-foreground",
    bg: "bg-foreground/5",
  },
  BONUS: {
    label: "Bonus",
    color: "text-[#FBBF24]",
    bg: "bg-[#FBBF24]/10",
  },
  REFUND: {
    label: "Refund",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
}

// ─── COMPONENT ───
// Honest-by-data: transactions must come from a real API call. Pass an empty
// array (default) until the backend wires getTransactionHistory().

interface TransactionHistoryProps {
  transactions?: Transaction[]
}

export function TransactionHistory({ transactions = [] }: TransactionHistoryProps) {
  return (
    <div className="rounded-2xl border border-border bg-foreground/2 overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-border">
        <div className="flex items-center gap-2">
          <Clock className="size-4 text-muted-foreground" />
          <h3 className="text-[14px] font-semibold text-foreground">
            Transaction History
          </h3>
        </div>
      </div>

      {/* Transactions list */}
      <div className="divide-y divide-border">
        {transactions.map((tx) => {
          const config = TYPE_CONFIG[tx.type]
          const isPositive = tx.amount > 0
          return (
            <div
              key={tx.id}
              className="flex items-center justify-between px-5 py-3.5 hover:bg-foreground/2 transition-colors"
            >
              <div className="flex items-center gap-3 min-w-0">
                <span className="text-[11px] text-muted-foreground tabular-nums shrink-0 w-16">
                  {new Date(tx.date).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
                <span
                  className={`text-[9px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full shrink-0 ${config.color} ${config.bg}`}
                >
                  {config.label}
                </span>
                <span className="text-[12px] text-muted-foreground truncate">
                  {tx.description}
                </span>
              </div>
              <span
                className={`text-[13px] font-semibold shrink-0 ml-3 ${
                  isPositive ? "text-positive" : "text-muted-foreground"
                }`}
              >
                {isPositive ? "+" : ""}
                {tx.amount} credit{Math.abs(tx.amount) !== 1 ? "s" : ""}
              </span>
            </div>
          )
        })}
      </div>

      {/* Empty state */}
      {transactions.length === 0 && (
        <div className="py-8 text-center">
          <span className="text-[12px] text-muted-foreground">
            No transactions yet
          </span>
        </div>
      )}
    </div>
  )
}
