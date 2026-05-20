"use client"

import { useState, useCallback } from "react"
import Image from "next/image"
import { markImageUrlFailed } from "@/lib/imageFailureStore"

/**
 * Minimum natural-pixel area for a "real" car photo. Images below this
 * threshold are treated as CDN placeholders (e.g. AutoTrader's
 * `no_image.png` served via 307 redirect for delisted listings).
 *
 * AutoTrader's placeholder is ~1.5 KB / ~200×150 px = 30 000 px².
 * On tablets / narrow viewports Next.js may serve w=256 images whose
 * area is ~43 500 px². Threshold at 36 000 catches the placeholder
 * while allowing legitimately-optimised small renditions through.
 */
const MIN_IMAGE_AREA = 36_000

export function SafeImage({
  src,
  alt,
  fallback,
  fallbackSrc,
  onLoad: callerOnLoad,
  ...restProps
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode; fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const handleError = useCallback(() => {
    // Report the URL to the runtime failure store so the feed hooks
    // can drop the card on the next render. We do this on the very
    // first failure (before falling back to fallbackSrc) because a
    // card whose primary image fails is the one we want to hide —
    // we don't want a feed of fallback graphics.
    if (typeof src === "string") {
      markImageUrlFailed(src)
    }
    if (!useFallback && fallbackSrc) {
      setUseFallback(true)
    } else {
      setFallbackFailed(true)
    }
  }, [useFallback, fallbackSrc, src])

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      // Detect CDN placeholder images that load successfully but are
      // tiny (e.g. AutoTrader's no_image.png served via 307 redirect).
      // Only run this check when the browser fetched a large enough
      // rendition. Small thumbnails (sizes="56px") produce naturalWidth
      // ~64 px even for real photos, which would be falsely flagged.
      if (img.naturalWidth >= 200 && img.naturalWidth * img.naturalHeight < MIN_IMAGE_AREA) {
        handleError()
      } else {
        callerOnLoad?.(e)
      }
    },
    [handleError, callerOnLoad],
  )

  const activeSrc = !useFallback ? src : fallbackSrc
  // Show fallback ReactNode when all image sources are exhausted:
  // - no src at all
  // - primary failed and no fallbackSrc to try (fallbackFailed while !useFallback)
  // - fallbackSrc also failed (fallbackFailed while useFallback)
  if (!activeSrc || fallbackFailed) return <>{fallback}</>
  return (
    <Image
      key={String(activeSrc)}
      src={activeSrc}
      alt={alt}
      onError={handleError}
      onLoad={handleLoad}
      {...restProps}
    />
  )
}
