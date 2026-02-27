"use client";

import { motion } from "framer-motion";

interface MonzaLoaderProps {
  label?: string;
  className?: string;
}

export function PorscheWheelSpinner({
  label = "MONZA",
  className,
}: MonzaLoaderProps) {
  return (
    <div
      className={`flex h-screen w-full flex-col items-center justify-center bg-[#0b0b10] ${className ?? ""}`}
    >
      {/* Ring container */}
      <div className="relative flex items-center justify-center" style={{ width: 64, height: 64 }}>
        {/* Static track ring — barely visible */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: "1px solid rgba(248,180,217,0.08)",
          }}
        />

        {/* Rotating arc — the only moving element */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox="0 0 64 64" fill="none" className="h-full w-full">
            <circle
              cx="32"
              cy="32"
              r="31"
              stroke="url(#arcGrad)"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeDasharray="146"
              strokeDashoffset="100"
            />
            <defs>
              <linearGradient id="arcGrad" x1="0" y1="0" x2="64" y2="64">
                <stop offset="0%" stopColor="#F8B4D9" stopOpacity="0" />
                <stop offset="60%" stopColor="#F8B4D9" stopOpacity="0.7" />
                <stop offset="100%" stopColor="#F8B4D9" stopOpacity="1" />
              </linearGradient>
            </defs>
          </svg>
        </motion.div>

        {/* Subtle glow behind the ring */}
        <motion.div
          className="absolute inset-[-12px] rounded-full"
          style={{
            background: "radial-gradient(circle, rgba(248,180,217,0.06) 0%, transparent 70%)",
          }}
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Brand text */}
      <motion.span
        className="mt-8 text-[11px] font-light tracking-[0.35em] text-[#F8B4D9]/50"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3, duration: 0.8 }}
      >
        {label}
      </motion.span>
    </div>
  );
}
