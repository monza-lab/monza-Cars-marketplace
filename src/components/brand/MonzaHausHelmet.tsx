/**
 * MonzaHaus Helmet — official mark, standalone.
 *
 * Renders the canonical helmet path inline so colors can adapt to theme
 * via props (or fall back to brand defaults). For most surfaces use the
 * paired <MonzaHausWordmark /> instead — this component is reserved for
 * favicons, app icons, profile pictures, watermarks, and other contexts
 * where the wordmark is too verbose.
 *
 * Path geometry from the v2.1 brand manual; identical to the static SVGs
 * in /public/brand/ but inline so currentColor / theme tokens apply.
 */

type HelmetTone =
  | "lavender-on-cream" // default light: deep lavender shell, ink visor
  | "lavender-on-noir" // default dark: heritage lavender shell, ink visor
  | "cream-on-lavender" // for placement on lavender backgrounds
  | "heritage" // standalone heritage lavender (transparent bg)
  | "lavender-deep"; // standalone lavender deep (transparent bg)

interface MonzaHausHelmetProps {
  /**
   * Pixel size (square). When omitted the SVG fills its container at
   * 100% — useful when embedding inside the wordmark (which sets the
   * container to a 0.78em×0.79em box).
   */
  size?: number;
  /** Color preset matching the surface where this helmet sits. */
  tone?: HelmetTone;
  /** Optional className passthrough (Tailwind etc.) */
  className?: string;
  /** Optional aria-label override. Defaults to "MonzaHaus". */
  label?: string;
}

const TONES: Record<HelmetTone, { shell: string; visor: string; strap: string }> = {
  "lavender-on-cream": { shell: "#D6BEDC", visor: "#0E0E0D", strap: "#0E0E0D" },
  "lavender-on-noir": { shell: "#E1CCE5", visor: "#0E0E0D", strap: "#0E0E0D" },
  "cream-on-lavender": { shell: "#FDFBF9", visor: "#3F2A47", strap: "#3F2A47" },
  heritage: { shell: "#E1CCE5", visor: "#0E0E0D", strap: "#0E0E0D" },
  "lavender-deep": { shell: "#D6BEDC", visor: "#0E0E0D", strap: "#0E0E0D" },
};

export function MonzaHausHelmet({
  size,
  tone = "lavender-on-cream",
  className,
  label = "MonzaHaus",
}: MonzaHausHelmetProps) {
  const { shell, visor, strap } = TONES[tone];
  const dimensions = size === undefined
    ? { width: "100%" as const, height: "100%" as const }
    : { width: size, height: size };
  return (
    <svg
      viewBox="0 0 120 121"
      {...dimensions}
      role="img"
      aria-label={label}
      className={className}
    >
      <path
        d="M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z"
        fill={shell}
      />
      <path
        d="M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z"
        fill={visor}
      />
      <path
        d="M26 90Q60 86 94 90"
        stroke={strap}
        strokeWidth={3}
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export type { MonzaHausHelmetProps, HelmetTone };
