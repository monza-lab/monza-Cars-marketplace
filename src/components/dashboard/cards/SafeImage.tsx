"use client"

import { useState } from "react"
import Image from "next/image"

export function SafeImage({
  src,
  alt,
  fallback,
  fallbackSrc,
  ...props
}: React.ComponentProps<typeof Image> & { fallback: React.ReactNode; fallbackSrc?: string }) {
  const [useFallback, setUseFallback] = useState(false)
  const [fallbackFailed, setFallbackFailed] = useState(false)

  const activeSrc = !useFallback ? src : fallbackSrc
  if (!activeSrc || (useFallback && fallbackFailed)) return <>{fallback}</>
  return (
    <Image
      key={String(activeSrc)}
      src={activeSrc}
      alt={alt}
      onError={() => {
        if (!useFallback && fallbackSrc) {
          setUseFallback(true)
        } else {
          setFallbackFailed(true)
        }
      }}
      {...props}
    />
  )
}
