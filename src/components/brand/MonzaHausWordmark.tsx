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
   * Tone preset for the helmet inset. Should match the background
   * the wordmark sits on. The text always uses currentColor so the
   * caller controls it via Tailwind text-* utilities.
   */
  tone?: HelmetTone;
  /**
   * Tailwind / className passthrough on the outer element. The
   * caller controls the wordmark's font-size here (e.g. `text-lg`,
   * `text-[18px] md:text-[24px]`) and the helmet inset scales with
   * it automatically via em-based sizing.
   */
  className?: string;
  /**
   * Render as an h1 instead of a span. Use for hero placements where
   * the wordmark IS the page title.
   */
  asHeading?: boolean;
}

export function MonzaHausWordmark({
  tone = "lavender-deep",
  className,
  asHeading = false,
}: MonzaHausWordmarkProps) {
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
