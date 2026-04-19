"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";

type RangeFilterProps = {
  label: string;
  unit?: string;
  min: number;
  max: number;
  step?: number;
  valueMin: number | null;
  valueMax: number | null;
  onChange: (min: number | null, max: number | null) => void;
  onClear: () => void;
  format?: (n: number) => string;
};

export function RangeFilter({
  label,
  unit,
  min,
  max,
  step = 1,
  valueMin,
  valueMax,
  onChange,
  onClear,
  format,
}: RangeFilterProps) {
  const [local, setLocal] = useState<[number, number]>([valueMin ?? min, valueMax ?? max]);

  useEffect(() => {
    setLocal([valueMin ?? min, valueMax ?? max]);
  }, [valueMin, valueMax, min, max]);

  const fmt = format ?? ((n: number) => n.toLocaleString("en-US"));

  const commit = (next: [number, number]) => {
    setLocal(next);
    const [lo, hi] = next;
    onChange(lo === min ? null : lo, hi === max ? null : hi);
  };

  return (
    <div className="p-4 w-[320px]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-medium tracking-[0.15em] uppercase text-muted-foreground">
          {label}
        </p>
        {(valueMin !== null || valueMax !== null) && (
          <button
            onClick={onClear}
            className="text-[10px] text-muted-foreground hover:text-foreground transition-colors"
          >
            Reset
          </button>
        )}
      </div>

      <div className="flex items-center justify-between mb-4 text-[13px] tabular-nums font-medium text-foreground">
        <span>{fmt(local[0])}{unit ? ` ${unit}` : ""}</span>
        <span className="text-muted-foreground">–</span>
        <span>{fmt(local[1])}{unit ? ` ${unit}` : ""}</span>
      </div>

      <SliderPrimitive.Root
        className="relative flex items-center select-none touch-none w-full h-5"
        value={local}
        onValueChange={(v) => setLocal([v[0], v[1]])}
        onValueCommit={(v) => commit([v[0], v[1]])}
        min={min}
        max={max}
        step={step}
        minStepsBetweenThumbs={1}
      >
        <SliderPrimitive.Track className="bg-border relative grow rounded-full h-[3px]">
          <SliderPrimitive.Range className="absolute bg-primary rounded-full h-full" />
        </SliderPrimitive.Track>
        <SliderPrimitive.Thumb
          className={cn(
            "block size-4 rounded-full bg-primary border-2 border-background shadow-md",
            "hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          aria-label="Minimum"
        />
        <SliderPrimitive.Thumb
          className={cn(
            "block size-4 rounded-full bg-primary border-2 border-background shadow-md",
            "hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          )}
          aria-label="Maximum"
        />
      </SliderPrimitive.Root>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <div>
          <label className="block text-[9px] tracking-[0.15em] uppercase text-muted-foreground mb-1">
            Min
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={local[0]}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isFinite(n)) return;
              const clamped = Math.max(min, Math.min(n, local[1]));
              setLocal([clamped, local[1]]);
            }}
            onBlur={() => commit(local)}
            className="w-full h-8 px-2 rounded-md bg-foreground/[0.03] border border-border text-[12px] tabular-nums focus:outline-none focus:border-primary/40"
          />
        </div>
        <div>
          <label className="block text-[9px] tracking-[0.15em] uppercase text-muted-foreground mb-1">
            Max
          </label>
          <input
            type="number"
            inputMode="numeric"
            value={local[1]}
            onChange={(e) => {
              const n = parseInt(e.target.value, 10);
              if (!Number.isFinite(n)) return;
              const clamped = Math.min(max, Math.max(n, local[0]));
              setLocal([local[0], clamped]);
            }}
            onBlur={() => commit(local)}
            className="w-full h-8 px-2 rounded-md bg-foreground/[0.03] border border-border text-[12px] tabular-nums focus:outline-none focus:border-primary/40"
          />
        </div>
      </div>
    </div>
  );
}
