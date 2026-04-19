"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Option = { id: string; label: string };

type CheckboxFilterProps = {
  label: string;
  options: readonly Option[];
  value: string[];
  onChange: (next: string[]) => void;
  onClear: () => void;
};

export function CheckboxFilter({ label, options, value, onChange, onClear }: CheckboxFilterProps) {
  const toggle = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter((v) => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div className="p-4 w-[280px]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
          {label}
        </p>
        {value.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>
      <div className="space-y-1">
        {options.map((opt) => {
          const checked = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-[13px] transition-colors",
                checked
                  ? "bg-primary/8 text-foreground"
                  : "text-foreground hover:bg-foreground/[0.04]",
              )}
            >
              <span
                className={cn(
                  "size-4 rounded border flex items-center justify-center transition-colors shrink-0",
                  checked ? "bg-primary border-primary" : "border-border bg-foreground/[0.02]",
                )}
              >
                {checked && <Check className="size-3 text-primary-foreground" strokeWidth={3} />}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
