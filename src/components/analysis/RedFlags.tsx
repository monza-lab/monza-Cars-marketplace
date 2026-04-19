"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface RedFlagsProps {
  redFlags: string[];
  className?: string;
}

// ---------------------------------------------------------------------------
// Severity helpers
// ---------------------------------------------------------------------------

function getSeverityStyles(index: number, total: number) {
  // First items are most critical - stronger red tints
  const ratio = total <= 1 ? 0 : index / (total - 1);

  if (ratio <= 0.33) {
    // High severity
    return {
      container:
        "bg-destructive/10 border-destructive/30 hover:bg-destructive/15",
      icon: "text-destructive",
      dot: "bg-destructive",
      label: "High",
      labelClass: "text-destructive bg-destructive/15",
    };
  }
  if (ratio <= 0.66) {
    // Medium severity
    return {
      container:
        "bg-destructive/8 border-destructive/25 hover:bg-destructive/12",
      icon: "text-destructive",
      dot: "bg-destructive",
      label: "Medium",
      labelClass: "text-destructive bg-destructive/15",
    };
  }
  // Lower severity
  return {
    container:
      "bg-amber-500/6 border-amber-500/20 hover:bg-amber-500/10",
    icon: "text-destructive",
    dot: "bg-amber-400",
    label: "Monitor",
    labelClass: "text-destructive bg-amber-500/15",
  };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function RedFlags({ redFlags, className }: RedFlagsProps) {
  if (redFlags.length === 0) return null;

  return (
    <div className={cn("space-y-2", className)}>
      {redFlags.map((flag, i) => {
        const severity = getSeverityStyles(i, redFlags.length);

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, duration: 0.25 }}
            className={cn(
              "flex items-start gap-3 rounded-md p-3 border transition-colors",
              severity.container
            )}
          >
            {/* Alert icon */}
            <AlertTriangle
              className={cn("size-4 mt-0.5 shrink-0", severity.icon)}
            />

            {/* Content */}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-zinc-300 leading-relaxed">{flag}</p>
            </div>

            {/* Severity label */}
            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium",
                severity.labelClass
              )}
            >
              {severity.label}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
}
