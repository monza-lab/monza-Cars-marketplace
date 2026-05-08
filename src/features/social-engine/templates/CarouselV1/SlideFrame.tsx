// Note: brand-tokens.css is loaded via `src/app/internal/carousel/layout.tsx` for
// the Next.js render path, and inlined directly into the HTML wrapper by
// `scripts/generate-daily-batch.ts` for the v0.5 CLI path. We intentionally
// do NOT import the CSS here because tsx (used by the CLI) cannot parse CSS.
import type { ReactNode } from "react";

export function SlideFrame({ children, theme = "dark" }: { children: ReactNode; theme?: "dark" | "light" | "rose" }) {
  const bg =
    theme === "dark" ? "var(--obsidian, #0E0E0D)"
    : theme === "light" ? "var(--cream, #FDFBF9)"
    : "linear-gradient(140deg, #5D3F66 0%, #D6BEDC 50%, #8d3a56 100%)";
  return (
    <>
      <link
        rel="stylesheet"
        href="https://fonts.googleapis.com/css2?family=Cormorant:wght@300;400;500;600&family=Karla:wght@300;400;500;600;700&family=Geist+Mono&display=block"
      />
      <div
        style={{
          width: 1080,
          height: 1350,
          position: "relative",
          overflow: "hidden",
          background: bg,
          fontFamily: "Karla, sans-serif",
          color: theme === "light" ? "#141413" : "#E8E2DE",
        }}
      >
        {children}
      </div>
    </>
  );
}
