"use client";

import { Check } from "lucide-react";
import {
  DRIVE_OPTIONS,
  STEERING_OPTIONS,
  PLATFORM_OPTIONS,
  type ClassicFilters,
} from "./types";
import { cn } from "@/lib/utils";

type MoreFiltersProps = {
  filters: ClassicFilters;
  onChange: (updater: Partial<ClassicFilters>) => void;
  onClear: () => void;
};

function Group({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { id: string; label: string }[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const toggle = (id: string) => {
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);
  };

  return (
    <div>
      <p className="text-[10px] font-medium tracking-[0.15em] uppercase text-muted-foreground mb-2">
        {label}
      </p>
      <div className="space-y-1">
        {options.map((opt) => {
          const checked = value.includes(opt.id);
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => toggle(opt.id)}
              className={cn(
                "w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-left text-[12px] transition-colors",
                checked
                  ? "bg-primary/8 text-foreground"
                  : "text-foreground hover:bg-foreground/[0.04]",
              )}
            >
              <span
                className={cn(
                  "size-3.5 rounded border flex items-center justify-center shrink-0",
                  checked ? "bg-primary border-primary" : "border-border",
                )}
              >
                {checked && <Check className="size-2.5 text-primary-foreground" strokeWidth={3} />}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function MoreFilters({ filters, onChange, onClear }: MoreFiltersProps) {
  const hasAny = filters.drive.length || filters.steering.length || filters.platform.length;

  return (
    <div className="w-[560px] max-h-[70vh] overflow-y-auto p-4">
      <div className="flex items-center justify-between mb-4">
        <p className="text-[13px] font-medium text-foreground">More filters</p>
        {hasAny ? (
          <button
            onClick={onClear}
            className="text-[11px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset all
          </button>
        ) : null}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <Group
          label="Drive"
          options={DRIVE_OPTIONS}
          value={filters.drive}
          onChange={(v) => onChange({ drive: v })}
        />
        <Group
          label="Steering"
          options={STEERING_OPTIONS}
          value={filters.steering}
          onChange={(v) => onChange({ steering: v })}
        />
        <Group
          label="Platform"
          options={PLATFORM_OPTIONS}
          value={filters.platform}
          onChange={(v) => onChange({ platform: v })}
        />
      </div>
    </div>
  );
}
