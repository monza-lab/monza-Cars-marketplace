"use client";

import { Popover as PopoverPrimitive } from "radix-ui";
import { ChevronDown, X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type FilterPillProps = {
  label: string;
  value?: string | null;
  active?: boolean;
  onClear?: () => void;
  children: ReactNode;
  align?: "start" | "center" | "end";
  contentClassName?: string;
};

export function FilterPill({
  label,
  value,
  active,
  onClear,
  children,
  align = "start",
  contentClassName,
}: FilterPillProps) {
  const isActive = !!active || !!value;

  return (
    <PopoverPrimitive.Root>
      <PopoverPrimitive.Trigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 h-8 px-3 rounded-full border text-[11px] font-medium tracking-wide transition-all select-none",
            isActive
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-foreground/[0.03] border-border text-foreground hover:border-primary/30 hover:bg-foreground/[0.05]",
          )}
        >
          <span className={cn(isActive && "font-semibold")}>
            {isActive && value ? value : label}
          </span>
          {isActive && onClear ? (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                onClear();
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.stopPropagation();
                  e.preventDefault();
                  onClear();
                }
              }}
              aria-label={`Clear ${label}`}
              className="inline-flex items-center justify-center -mr-1 size-4 rounded-full hover:bg-primary/15 transition-colors"
            >
              <X className="size-2.5" />
            </span>
          ) : (
            <ChevronDown className="size-3 opacity-60" />
          )}
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align={align}
          sideOffset={8}
          className={cn(
            "z-50 rounded-xl border border-border bg-popover text-popover-foreground shadow-xl",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
            "data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
            "data-[side=bottom]:slide-in-from-top-2",
            "min-w-[280px] max-w-[90vw]",
            contentClassName,
          )}
        >
          {children}
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}
