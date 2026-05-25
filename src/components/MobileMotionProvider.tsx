"use client"

import { MotionConfig } from "framer-motion"
import { useIsMobile } from "@/lib/useMediaQuery"

export function MobileMotionProvider({ children }: { children: React.ReactNode }) {
  const isMobile = useIsMobile()
  return (
    <MotionConfig reducedMotion={isMobile ? "always" : "user"}>
      {children}
    </MotionConfig>
  )
}
