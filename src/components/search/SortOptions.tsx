"use client";

import { ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export type SortOption =
  | "ending-soon"
  | "price-low-high"
  | "price-high-low"
  | "recently-added"
  | "year-new-old"
  | "year-old-new";

interface SortOptionsProps {
  value: SortOption;
  onChange: (value: SortOption) => void;
  className?: string;
}

const sortOptions: { value: SortOption; label: string }[] = [
  { value: "ending-soon", label: "Ending Soon" },
  { value: "price-low-high", label: "Price: Low to High" },
  { value: "price-high-low", label: "Price: High to Low" },
  { value: "recently-added", label: "Recently Added" },
  { value: "year-new-old", label: "Year: Newest First" },
  { value: "year-old-new", label: "Year: Oldest First" },
];

export function SortOptions({ value, onChange, className }: SortOptionsProps) {
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-zinc-500">
        <ArrowUpDown className="size-3.5" />
        <span className="hidden sm:inline">Sort by</span>
      </div>

      <Select value={value} onValueChange={(v) => onChange(v as SortOption)}>
        <SelectTrigger
          className={cn(
            "w-[180px] border-zinc-800 bg-zinc-950/80 text-sm text-zinc-200",
            "transition-all duration-200",
            "hover:border-zinc-700",
            "focus:border-amber-500/40 focus:ring-amber-500/10",
            "data-[state=open]:border-amber-500/40 data-[state=open]:ring-1 data-[state=open]:ring-amber-500/10"
          )}
        >
          <SelectValue placeholder="Sort by..." />
        </SelectTrigger>

        <SelectContent
          className="border-zinc-800 bg-zinc-950 shadow-xl shadow-black/40"
          position="popper"
          sideOffset={4}
        >
          {sortOptions.map((option) => (
            <SelectItem
              key={option.value}
              value={option.value}
              className={cn(
                "cursor-pointer text-sm text-zinc-300",
                "focus:bg-amber-500/10 focus:text-destructive",
                "data-[state=checked]:text-destructive"
              )}
            >
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
