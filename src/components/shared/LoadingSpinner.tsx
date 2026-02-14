"use client";

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
        {/* Track ring */}
        <div
          className={cn("rounded-full border-zinc-800/60", container, border)}
        />

        {/* Spinning gradient ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full animate-spin",
            container,
            border,
            "border-transparent border-t-amber-500 border-r-amber-400/50"
          )}
        />

        {/* Center dot pulse */}
        <div className="absolute inset-0 flex items-center justify-center animate-pulse">
          <div
            className={cn(
              "rounded-full bg-amber-500",
              size === "sm" && "size-1",
              size === "md" && "size-1.5",
              size === "lg" && "size-2.5"
            )}
          />
        </div>
      </div>

      {showText && (
        <p
          className={cn(
            "font-medium tracking-wide text-amber-500/80 animate-pulse",
            textSizeMap[size]
          )}
        >
          {text}
        </p>
      )}
    </div>
  );
}
