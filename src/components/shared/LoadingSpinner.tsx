"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LoadingSpinnerProps {
  size?: "sm" | "md" | "lg";
  showText?: boolean;
  text?: string;
  className?: string;
}

const sizeMap = {
  sm: { container: "size-6", border: "border-2" },
  md: { container: "size-10", border: "border-3" },
  lg: { container: "size-16", border: "border-4" },
} as const;

const textSizeMap = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
} as const;

export function LoadingSpinner({
  size = "md",
  showText = false,
  text = "Loading...",
  className,
}: LoadingSpinnerProps) {
  const { container, border } = sizeMap[size];

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3",
        className
      )}
    >
      <div className="relative">
        {/* Outer glow ring */}
        <motion.div
          className={cn("absolute inset-0 rounded-full", container)}
          style={{
            boxShadow: "0 0 15px rgba(245, 158, 11, 0.3)",
          }}
          animate={{
            boxShadow: [
              "0 0 10px rgba(245, 158, 11, 0.2)",
              "0 0 25px rgba(245, 158, 11, 0.4)",
              "0 0 10px rgba(245, 158, 11, 0.2)",
            ],
          }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
          }}
        />

        {/* Track ring */}
        <div
          className={cn("rounded-full border-zinc-800/60", container, border)}
        />

        {/* Spinning gradient ring */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full",
            container,
            border,
            "border-transparent border-t-amber-500 border-r-amber-400/50"
          )}
          animate={{ rotate: 360 }}
          transition={{
            duration: 1,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Secondary counter-rotating ring */}
        <motion.div
          className={cn(
            "absolute inset-0 rounded-full",
            container,
            border,
            "border-transparent border-b-amber-600/30"
          )}
          animate={{ rotate: -360 }}
          transition={{
            duration: 1.8,
            repeat: Infinity,
            ease: "linear",
          }}
        />

        {/* Center dot pulse */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.5,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          <div
            className={cn(
              "rounded-full bg-amber-500",
              size === "sm" && "size-1",
              size === "md" && "size-1.5",
              size === "lg" && "size-2.5"
            )}
          />
        </motion.div>
      </div>

      {showText && (
        <motion.p
          className={cn(
            "font-medium tracking-wide text-destructive/80",
            textSizeMap[size]
          )}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{
            duration: 2,
            repeat: Infinity,
            ease: [0.4, 0, 0.2, 1],
          }}
        >
          {text}
        </motion.p>
      )}
    </div>
  );
}
