"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { ChevronDown, Check } from "lucide-react"

// ─── DROPDOWN SELECT ───
export function DropdownSelect({
  label,
  value,
  options,
  onChange,
  icon: Icon,
}: {
  label: string
  value: string
  options: { label: string; value: string }[]
  onChange: (value: string) => void
  icon?: React.ComponentType<{ className?: string }>
}) {
  const [open, setOpen] = useState(false)
  const selectedOption = options.find(o => o.value === value)

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-xl bg-foreground/5 border border-border px-4 py-2.5 text-[12px] font-medium text-muted-foreground hover:bg-foreground/10 transition-colors min-w-[160px]"
      >
        {Icon && <Icon className="size-4 text-primary" />}
        <span className="flex-1 text-left">{selectedOption?.label || label}</span>
        <ChevronDown className={`size-4 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="absolute top-full left-0 mt-2 w-full min-w-[200px] rounded-xl bg-card border border-border shadow-xl z-50 overflow-hidden"
            >
              {options.map((option) => (
                <button
                  key={option.value}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`
                    w-full flex items-center justify-between px-4 py-3 text-[12px] transition-colors
                    ${option.value === value
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-foreground/5"
                    }
                  `}
                >
                  {option.label}
                  {option.value === value && <Check className="size-4" />}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
