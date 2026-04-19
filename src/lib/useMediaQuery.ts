"use client";

import { useEffect, useState } from "react";

/**
 * Returns true when the given media query matches.
 * Safe for SSR — hydrates to `false` then re-evaluates on mount.
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(query);
    setMatches(mql.matches);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** <768px → mobile (Tailwind `md` breakpoint). */
export function useIsMobile(): boolean {
  return useMediaQuery("(max-width: 767px)");
}
