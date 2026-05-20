/**
 * Runtime store of image URLs that failed to load (404, CORS, CDN
 * placeholder under MIN_IMAGE_AREA, etc.).
 *
 * Why this exists: `hasPhoto` in `photoSort.ts` filters by URL pattern,
 * which catches our own `/cars/placeholder.svg` and obvious "no_image"
 * paths. It cannot catch BaT / Cars-and-Bids URLs that are real and
 * non-placeholder by name but actually serve a CORS-blocked 403, a
 * 307-redirect-to-placeholder, or a 200×150 tracking pixel. Those slip
 * through and surface as visually-broken cards in the curated feed.
 *
 * SafeImage reports failures here; feed hooks subscribe so their memos
 * re-compute and drop the offending cards. Frontend-only — backend
 * keeps the rows, and the URL set lives only in the browser session.
 */

"use client"

import { useSyncExternalStore } from "react"

const failedUrls = new Set<string>()
const listeners = new Set<() => void>()
// Version counter — useSyncExternalStore needs a stable identity for
// memoization, so we bump a number instead of returning the Set itself.
let version = 0

export function markImageUrlFailed(url: string | null | undefined): void {
  if (!url) return
  if (failedUrls.has(url)) return
  failedUrls.add(url)
  version += 1
  for (const cb of listeners) cb()
}

export function isImageUrlFailed(url: string | null | undefined): boolean {
  if (!url) return false
  return failedUrls.has(url)
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

function getSnapshot(): number {
  return version
}

function getServerSnapshot(): number {
  return 0
}

/**
 * Subscribes the calling component to image-failure events. Returns the
 * current "version" of the failure set — a monotonic counter that ticks
 * up whenever a new URL is marked failed. Components don't need the
 * counter value itself; they just include it in `useMemo` dependency
 * arrays so the memo re-runs after every new failure.
 *
 * Usage:
 *   const failureVersion = useImageFailureVersion()
 *   const visible = useMemo(() => filter(...), [data, failureVersion])
 */
export function useImageFailureVersion(): number {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)
}
