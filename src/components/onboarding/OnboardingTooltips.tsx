"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import { createPortal } from "react-dom"

const STORAGE_KEY_ONBOARDED = "monzahaus-onboarded"

interface TooltipDef {
  id: string
  selector: string
  position: "bottom" | "top" | "left"
}

const TOOLTIPS: TooltipDef[] = [
  { id: "regions", selector: '[data-onboarding="regions"]', position: "bottom" },
  { id: "search", selector: '[data-onboarding="search"]', position: "bottom" },
  { id: "advisor", selector: '[data-onboarding="advisor"]', position: "left" },
]

const STORAGE_PREFIX = "onboarding-tip-"
const DELAY_BETWEEN = 1500
const AUTO_DISMISS = 6000

interface TooltipPosition {
  top: number
  left: number
  arrowDir: "up" | "down" | "right"
}

function getPosition(el: Element, position: TooltipDef["position"]): TooltipPosition {
  const rect = el.getBoundingClientRect()
  const gap = 10

  switch (position) {
    case "bottom":
      return {
        top: rect.bottom + gap,
        left: rect.left + rect.width / 2,
        arrowDir: "up",
      }
    case "top":
      return {
        top: rect.top - gap,
        left: rect.left + rect.width / 2,
        arrowDir: "down",
      }
    case "left":
      return {
        top: rect.top + rect.height / 2,
        left: rect.left - gap,
        arrowDir: "right",
      }
  }
}

function Tooltip({
  text,
  pos,
  onDismiss,
}: {
  text: string
  pos: TooltipPosition
  onDismiss: () => void
}) {
  const style: React.CSSProperties = {
    position: "fixed",
    zIndex: 200,
    ...(pos.arrowDir === "up" && {
      top: pos.top,
      left: pos.left,
      transform: "translateX(-50%)",
    }),
    ...(pos.arrowDir === "down" && {
      top: pos.top,
      left: pos.left,
      transform: "translate(-50%, -100%)",
    }),
    ...(pos.arrowDir === "right" && {
      top: pos.top,
      left: pos.left,
      transform: "translate(-100%, -50%)",
    }),
  }

  return (
    <div
      style={style}
      className="animate-in fade-in slide-in-from-bottom-2 duration-300"
      onClick={onDismiss}
      role="tooltip"
    >
      {/* Arrow */}
      {pos.arrowDir === "up" && (
        <div className="w-3 h-1.5 mx-auto mb-[-1px]">
          <svg viewBox="0 0 12 6" className="w-full h-full fill-[#F1E6F3]">
            <polygon points="6,0 12,6 0,6" />
          </svg>
        </div>
      )}

      <div className="bg-[#F1E6F3] text-[#5D3F66] font-sans text-xs leading-snug px-3.5 py-2.5 rounded-lg shadow-lg max-w-[220px] cursor-pointer">
        {text}
      </div>

      {pos.arrowDir === "down" && (
        <div className="w-3 h-1.5 mx-auto mt-[-1px]">
          <svg viewBox="0 0 12 6" className="w-full h-full fill-[#F1E6F3]">
            <polygon points="0,0 12,0 6,6" />
          </svg>
        </div>
      )}
      {pos.arrowDir === "right" && (
        <div className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-1.5 h-3">
          <svg viewBox="0 0 6 12" className="w-full h-full fill-[#F1E6F3]">
            <polygon points="0,0 6,6 0,12" />
          </svg>
        </div>
      )}
    </div>
  )
}

export function OnboardingTooltips() {
  const t = useTranslations("onboarding.tips")
  const [activeIndex, setActiveIndex] = useState(-1)
  const [pos, setPos] = useState<TooltipPosition | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  const dismiss = useCallback(() => {
    if (activeIndex >= 0 && activeIndex < TOOLTIPS.length) {
      localStorage.setItem(STORAGE_PREFIX + TOOLTIPS[activeIndex].id, "true")
    }
    setActiveIndex((prev) => prev + 1)
    setPos(null)
  }, [activeIndex])

  // Check if we should show tooltips at all
  useEffect(() => {
    if (typeof window === "undefined") return
    // Only show on desktop
    if (window.innerWidth < 768) return
    // Only after onboarding modal has been seen
    if (localStorage.getItem(STORAGE_KEY_ONBOARDED) !== "true") return

    // Find first unseen tooltip
    const firstUnseen = TOOLTIPS.findIndex(
      (tip) => localStorage.getItem(STORAGE_PREFIX + tip.id) !== "true"
    )
    if (firstUnseen === -1) return

    const timer = setTimeout(() => setActiveIndex(firstUnseen), 800)
    return () => clearTimeout(timer)
  }, [])

  // Position the active tooltip
  useEffect(() => {
    if (activeIndex < 0 || activeIndex >= TOOLTIPS.length) return

    const tip = TOOLTIPS[activeIndex]
    // Check if already dismissed
    if (localStorage.getItem(STORAGE_PREFIX + tip.id) === "true") {
      setActiveIndex((prev) => prev + 1)
      return
    }

    const findEl = () => {
      const el = document.querySelector(tip.selector)
      if (el) {
        setPos(getPosition(el, tip.position))
        // Auto-dismiss
        timerRef.current = setTimeout(dismiss, AUTO_DISMISS)
      }
    }

    const showTimer = setTimeout(findEl, DELAY_BETWEEN)
    return () => {
      clearTimeout(showTimer)
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [activeIndex, dismiss])

  if (activeIndex < 0 || activeIndex >= TOOLTIPS.length || !pos) return null

  const tip = TOOLTIPS[activeIndex]

  return createPortal(
    <Tooltip text={t(tip.id)} pos={pos} onDismiss={dismiss} />,
    document.body
  )
}
