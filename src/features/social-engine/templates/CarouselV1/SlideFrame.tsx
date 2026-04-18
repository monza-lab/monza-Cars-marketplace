import "../../styles/brand-tokens.css";
import type { ReactNode } from "react";

export function SlideFrame({ children, theme = "dark" }: { children: ReactNode; theme?: "dark" | "light" | "rose" }) {
  const bg =
    theme === "dark" ? "var(--obsidian, #0E0A0C)"
    : theme === "light" ? "var(--cream, #FDFBF9)"
    : "linear-gradient(140deg, #5C1A33 0%, #7A2E4A 50%, #8d3a56 100%)";
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
          color: theme === "light" ? "#2A2320" : "#E8E2DE",
        }}
      >
        {children}
      </div>
    </>
  );
}
