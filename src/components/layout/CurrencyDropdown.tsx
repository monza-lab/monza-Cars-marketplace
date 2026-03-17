"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"
import { useCurrency, type Currency } from "@/lib/CurrencyContext"

const CURRENCY_OPTIONS: { value: Currency; label: string; symbol: string }[] = [
  { value: "USD", label: "USD", symbol: "$" },
  { value: "EUR", label: "EUR", symbol: "€" },
  { value: "GBP", label: "GBP", symbol: "£" },
  { value: "JPY", label: "JPY", symbol: "¥" },
]

export function CurrencyDropdown() {
  const { currency, setCurrency } = useCurrency()
  const [open, setOpen] = useState(false)
  const currentOption = CURRENCY_OPTIONS.find(o => o.value === currency)!

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-foreground/5 transition-colors border border-transparent hover:border-border"
      >
        <span className="text-primary">{currentOption.symbol}</span>
        <span>{currentOption.label}</span>
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
              className="absolute top-full right-0 mt-2 w-32 rounded-xl bg-card border border-border shadow-xl z-50 overflow-hidden"
            >
              {CURRENCY_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    setCurrency(option.value)
                    setOpen(false)
                  }}
                  className={`
                    w-full flex items-center justify-between px-3 py-2.5 text-[11px] font-medium transition-colors
                    ${option.value === currency
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-foreground/5"
                    }
                  `}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-center">{option.symbol}</span>
                    <span>{option.label}</span>
                  </span>
                  {option.value === currency && <Check className="size-3.5" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
