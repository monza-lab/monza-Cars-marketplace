"use client"

import { useEffect, useRef, useState, useCallback } from "react"

export function useScrollReveal(_threshold = 0.15) {
  const ref = useRef<HTMLDivElement>(null)
  const [isVisible, setIsVisible] = useState(false)

  const check = useCallback(() => {
    const el = ref.current
    if (!el || isVisible) return

    const rect = el.getBoundingClientRect()
    if (rect.top < window.innerHeight + 200) {
      setIsVisible(true)
    }
  }, [isVisible])

  useEffect(() => {
    if (isVisible) return

    // Check immediately
    check()

    // Listen on all scrollable parents + window
    const el = ref.current
    if (!el) return

    const listeners: { target: EventTarget; handler: () => void }[] = []
    const handler = () => check()

    // Walk up and attach to any scrollable ancestor
    let parent = el.parentElement
    while (parent) {
      const style = getComputedStyle(parent)
      if (style.overflowY === "auto" || style.overflowY === "scroll") {
        parent.addEventListener("scroll", handler, { passive: true })
        listeners.push({ target: parent, handler })
      }
      parent = parent.parentElement
    }

    window.addEventListener("scroll", handler, { passive: true })
    listeners.push({ target: window, handler })

    // Re-check on next frame (handles instant scrollTo)
    requestAnimationFrame(check)

    return () => {
      for (const { target, handler } of listeners) {
        target.removeEventListener("scroll", handler)
      }
    }
  }, [check, isVisible])

  return { ref, isVisible }
}
