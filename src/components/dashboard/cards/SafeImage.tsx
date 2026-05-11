"use client"

import { useState, useCallback } from "react"
import Image from "next/image"

/**
 * Minimum natural-pixel area for a "real" car photo. Images below this
 * threshold are treated as CDN placeholders (e.g. AutoTrader's
 * `no_image.png` served via 307 redirect for delisted listings).
 *
 * AutoTrader's placeholder is ~1.5 KB / ~200×150 px = 30 000 px².
 * Real car photos optimised by Next.js at w=384 are at least 384×256 = 98 304 px².
 * Threshold set at 50 000 px² to safely separate the two.
 */
const MIN_IMAGE_AREA = 50_000

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
    if (!useFallback && fallbackSrc) {
      setUseFallback(true)
    } else {
      setFallbackFailed(true)
    }
  }, [useFallback, fallbackSrc])

  const handleLoad = useCallback(
    (e: React.SyntheticEvent<HTMLImageElement>) => {
      const img = e.currentTarget
      // Detect CDN placeholder images that load successfully but are
      // tiny (e.g. AutoTrader's no_image.png served via 307 redirect).
      if (img.naturalWidth * img.naturalHeight < MIN_IMAGE_AREA) {
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
