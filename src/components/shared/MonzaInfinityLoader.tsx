"use client"

export function MonzaInfinityLoader({ label = "Loading cars" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#0b0b10]">
      {/* Ambient glow behind the infinity */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[200px] rounded-full bg-[#F8B4D9]/[0.04] blur-3xl" />

      {/* Infinity SVG */}
      <div className="relative w-full max-w-[320px] aspect-[2/1]">
        <svg viewBox="0 0 200 100" className="w-full h-full" aria-hidden="true">
          <defs>
            <linearGradient id="infinityGlow" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#F8B4D9" stopOpacity="0.2" />
              <stop offset="50%" stopColor="#F8B4D9" stopOpacity="1" />
              <stop offset="100%" stopColor="#F8B4D9" stopOpacity="0.2" />
            </linearGradient>
            <filter id="softGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
            </filter>
          </defs>

          {/* Track — faint infinity outline */}
          <path
            d="M 50 50 C 50 25, 75 25, 100 50 C 125 75, 150 75, 150 50 C 150 25, 125 25, 100 50 C 75 75, 50 75, 50 50"
            fill="none"
            stroke="#F8B4D9"
            strokeOpacity="0.08"
            strokeWidth="2"
            strokeLinecap="round"
          />

          {/* Outer glow worm */}
          <path
            d="M 50 50 C 50 25, 75 25, 100 50 C 125 75, 150 75, 150 50 C 150 25, 125 25, 100 50 C 75 75, 50 75, 50 50"
            fill="none"
            stroke="url(#infinityGlow)"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="40 260"
            filter="url(#softGlow)"
            className="animate-infinity-worm"
          />

          {/* Core bright worm */}
          <path
            d="M 50 50 C 50 25, 75 25, 100 50 C 125 75, 150 75, 150 50 C 150 25, 125 25, 100 50 C 75 75, 50 75, 50 50"
            fill="none"
            stroke="url(#infinityGlow)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="40 260"
            className="animate-infinity-worm"
          />
        </svg>
      </div>

      {/* Label */}
      <div className="mt-6 flex flex-col items-center gap-2">
        <p className="text-[14px] font-medium tracking-wide text-[#F8B4D9]/80">
          {label}
        </p>
        <div className="flex gap-1">
          <span className="size-1 rounded-full bg-[#F8B4D9]/60 animate-bounce [animation-delay:0ms]" />
          <span className="size-1 rounded-full bg-[#F8B4D9]/60 animate-bounce [animation-delay:150ms]" />
          <span className="size-1 rounded-full bg-[#F8B4D9]/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>

      {/* Bottom branding */}
      <p className="absolute bottom-8 text-[10px] uppercase tracking-[0.25em] text-white/10 font-medium">
        Monza Lab
      </p>
    </div>
  )
}
