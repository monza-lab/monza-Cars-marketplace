"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Input } from "@/components/ui/input";

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  defaultValue?: string;
  className?: string;
}

export function SearchBar({
  onSearch,
  placeholder = "Search vehicles, makes, models...",
  defaultValue = "",
  className,
}: SearchBarProps) {
  const [value, setValue] = useState(defaultValue);
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced search callback
  const debouncedSearch = useCallback(
    (query: string) => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      debounceRef.current = setTimeout(() => {
        onSearch(query);
      }, 300);
    },
    [onSearch]
  );

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    setValue(newValue);
    debouncedSearch(newValue);
  };

  const handleClear = () => {
    setValue("");
    onSearch("");
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      handleClear();
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Background glow on focus */}
      <div
        className={cn(
          "absolute -inset-0.5 rounded-xl bg-gradient-to-r from-primary/0 via-primary/0 to-primary/80/0 opacity-0 blur-sm transition-all duration-500",
          isFocused &&
            "from-primary/20 via-primary/10 to-primary/80/20 opacity-100"
        )}
      />

      <div
        className={cn(
          "relative flex items-center overflow-hidden rounded-xl border bg-card/80 transition-all duration-300",
          isFocused
            ? "border-primary/40 shadow-lg shadow-primary/5"
            : "border-border hover:border-border"
        )}
      >
        {/* Search icon */}
        <div className="flex shrink-0 items-center pl-4">
          <Search
            className={cn(
              "size-4 transition-colors duration-300",
              isFocused ? "text-destructive" : "text-muted-foreground/80"
            )}
          />
        </div>

        {/* Input */}
        <Input
          ref={inputRef}
          type="text"
          value={value}
          onChange={handleChange}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 focus-visible:ring-offset-0 placeholder:text-muted-foreground/80"
        />

        {/* Clear button */}
        {value && (
          <button
            onClick={handleClear}
            className="mr-3 flex shrink-0 items-center justify-center rounded-md p-1 text-muted-foreground/80 transition-colors hover:bg-foreground/5 hover:text-foreground/80"
            aria-label="Clear search"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
    </div>
  );
}
