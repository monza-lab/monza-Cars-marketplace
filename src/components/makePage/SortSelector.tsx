"use client"

import { useState, useRef, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ArrowUpDown, ChevronDown } from "lucide-react"
import { SORT_LABELS } from "@/lib/makePageConstants"

// ─── SORT SELECTOR (compact inline for Column B) ───
export function SortSelector({
  sortBy,
  setSortBy,
  options,
}: {
  sortBy: string
  setSortBy: (v: string) => void
  options: { key: string; value: string }[]
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handleClick)
    return () => document.removeEventListener("mousedown", handleClick)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowUpDown className="size-3" />
        <span className="font-medium">{SORT_LABELS[sortBy] || "Ordenar"}</span>
        <ChevronDown className={`size-3 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full mt-1.5 w-40 bg-card border border-border rounded-xl shadow-2xl overflow-hidden z-50"
          >
            {options.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setSortBy(opt.value); setOpen(false) }}
                className={`w-full text-left px-3 py-2 text-[11px] transition-colors ${
                  sortBy === opt.value
                    ? "text-primary bg-primary/8"
                    : "text-muted-foreground hover:text-foreground hover:bg-foreground/5"
                }`}
              >
                {SORT_LABELS[opt.value]}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
