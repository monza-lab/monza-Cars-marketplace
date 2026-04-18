"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "radix-ui";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

type BottomSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  footer?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  showHandle?: boolean;
};

export function BottomSheet({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
  className,
  showHandle = true,
}: BottomSheetProps) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/45 backdrop-blur-sm",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
          )}
        />
        <DialogPrimitive.Content
          className={cn(
            "fixed bottom-0 left-0 right-0 z-50 flex flex-col",
            "bg-background border-t border-border rounded-t-2xl shadow-2xl",
            "max-h-[92vh] min-h-[40vh]",
            "data-[state=open]:animate-in data-[state=closed]:animate-out",
            "data-[state=open]:slide-in-from-bottom data-[state=closed]:slide-out-to-bottom",
            "data-[state=open]:duration-200 data-[state=closed]:duration-150",
            "focus:outline-none",
            "pb-[env(safe-area-inset-bottom)]",
            className,
          )}
        >
          {showHandle && (
            <div className="flex justify-center pt-2 pb-1 select-none">
              <div className="h-1 w-10 rounded-full bg-foreground/15" />
            </div>
          )}
          {(title || description) && (
            <div className="px-5 pt-1 pb-3 flex items-start justify-between gap-4 border-b border-border">
              <div className="flex-1 min-w-0">
                {title && (
                  <DialogPrimitive.Title className="text-[16px] font-display font-medium text-foreground">
                    {title}
                  </DialogPrimitive.Title>
                )}
                {description && (
                  <DialogPrimitive.Description className="mt-0.5 text-[12px] text-muted-foreground">
                    {description}
                  </DialogPrimitive.Description>
                )}
              </div>
              <DialogPrimitive.Close
                className="size-8 -mr-2 -mt-0.5 inline-flex items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-foreground/5 transition-colors"
                aria-label="Close"
              >
                <X className="size-4" />
              </DialogPrimitive.Close>
            </div>
          )}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            {children}
          </div>
          {footer && (
            <div className="border-t border-border p-3 bg-background/95 backdrop-blur-sm">
              {footer}
            </div>
          )}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
