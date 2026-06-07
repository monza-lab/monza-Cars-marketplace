"use client"

/**
 * MonzaHaus unified loader — helmet with breathing lavender glow.
 * Adapts to light/dark mode via CSS custom properties (--primary).
 *
 * variant="page"    → fixed fullscreen overlay  (loading.tsx, HomeGate)
 * variant="section" → min-h-screen in-flow      (Suspense fallbacks inside pages)
 */

interface MonzaHelmetLoaderProps {
  label?: string
  variant?: "page" | "section"
}

export function MonzaInfinityLoader({
  label,
  variant = "page",
}: MonzaHelmetLoaderProps) {
  const isPage = variant === "page"

  return (
    <div
      className={`${
        isPage ? "fixed inset-0 z-50" : "min-h-[60vh]"
      } flex flex-col items-center justify-center bg-background`}
    >
      {/* Ambient lavender glow — breathes softly behind the helmet */}
      <div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl animate-helmet-glow pointer-events-none"
        style={{ background: "var(--primary)" }}
      />

      {/* Helmet with subtle breathing animation */}
      <div className="relative animate-helmet-breathe">
        <svg
          viewBox="0 0 120 121"
          width={48}
          height={48}
          role="img"
          aria-label="Loading"
          className="drop-shadow-[0_0_24px_var(--primary)]"
        >
          {/* Shell — --primary = lavender-deep (light) / heritage-lavender (dark) */}
          <path
            d="M60 3C36 3 12 18 7 40C2 57 2 72 6 86L15 103C23 113 38 118 57 118L60 118L63 118C82 118 97 113 105 103L114 86C118 72 118 57 113 40C108 18 84 3 60 3Z"
            fill="var(--primary)"
          />
          {/* Visor */}
          <path
            d="M14 46C14 36 33 30 60 30C87 30 106 36 106 46L106 68C105 77 86 83 60 83C34 83 15 77 14 68Z"
            fill="#0E0E0D"
          />
          {/* Strap */}
          <path
            d="M26 90Q60 86 94 90"
            stroke="#0E0E0D"
            strokeWidth={3}
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </div>

      {/* Loading dots */}
      <div className="mt-6 flex gap-1.5">
        <span className="size-1 rounded-full bg-primary/50 animate-bounce [animation-delay:0ms]" />
        <span className="size-1 rounded-full bg-primary/50 animate-bounce [animation-delay:150ms]" />
        <span className="size-1 rounded-full bg-primary/50 animate-bounce [animation-delay:300ms]" />
      </div>

      {/* Bottom branding — only on fullscreen page variant */}
      {isPage && (
        <p className="absolute bottom-8 text-[10px] uppercase tracking-[0.25em] text-foreground/[0.08] font-medium select-none">
          MonzaHaus
        </p>
      )}
    </div>
  )
}
