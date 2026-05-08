import { MonzaHausHelmet, type HelmetTone } from "./MonzaHausHelmet";

/**
 * MonzaHaus wordmark — the brand mark, type-set in Saira 600 uppercase
 * with the official helmet replacing the "O" in MONZAHAUS.
 *
 * Layout: M  + [helmet]  + NZAHAUS
 *
 * Per the v2.1 brand manual, this is the canonical wordmark for any
 * "logo" placement: site header, email signature, OG images, footer.
 * Saira is reserved for this component; never use it for body or
 * headlines (those live in Cormorant + Karla).
 */

interface MonzaHausWordmarkProps {
  /**
   * Visual size of the wordmark text. Maps to a CSS font-size; the
   * helmet glyph scales relative to it via 0.78em width.
   * Default: "md" (1.125rem ≈ 18px) — matches the legacy "MONZA"
   * heading in the global header.
   */
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  /**
   * Tone preset for the helmet inset. Should match the background
   * the wordmark sits on. The text always uses currentColor so the
   * caller controls it via Tailwind text-* utilities.
   */
  tone?: HelmetTone;
  /** Tailwind / className passthrough on the outer span. */
  className?: string;
  /**
   * Render as an h1 instead of a span. Use for hero placements where
   * the wordmark IS the page title.
   */
  asHeading?: boolean;
}

const SIZE_TO_REM: Record<NonNullable<MonzaHausWordmarkProps["size"]>, string> = {
  xs: "0.75rem", // 12px — captions
  sm: "0.875rem", // 14px — inline signatures
  md: "1.125rem", // 18px — default header
  lg: "1.5rem", // 24px — desktop header / cards
  xl: "2.5rem", // 40px — hero
};

export function MonzaHausWordmark({
  size = "md",
  tone = "lavender-deep",
  className,
  asHeading = false,
}: MonzaHausWordmarkProps) {
  const fontSize = SIZE_TO_REM[size];
  const Tag: "h1" | "span" = asHeading ? "h1" : "span";
  return (
    <Tag
      className={className}
      style={{
        fontFamily: "var(--font-mark, 'Saira', system-ui, sans-serif)",
        fontWeight: 600,
        letterSpacing: "0.025em",
        textTransform: "uppercase",
        display: "inline-flex",
        alignItems: "baseline",
        lineHeight: 1,
        fontSize,
      }}
      aria-label="MonzaHaus"
    >
      <span aria-hidden="true">M</span>
      <span
        aria-hidden="true"
        style={{
          display: "inline-block",
          width: "0.78em",
          height: "0.79em",
          margin: "0 0.03em",
          verticalAlign: "baseline",
          transform: "translateY(0.07em)",
        }}
      >
        <MonzaHausHelmet
          tone={tone}
          className="block w-full h-full"
          label="O"
        />
      </span>
      <span aria-hidden="true">NZAHAUS</span>
    </Tag>
  );
}

export type { MonzaHausWordmarkProps };
