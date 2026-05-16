'use client'

import { useCallback, useEffect, useState } from 'react'

const STORAGE_KEY = 'monza:watchlist:v1'
const EVENT_NAME = 'monza:watchlist:change'

export interface WatchlistItem {
  id: string
  brand: string
  model: string
  year: number | null
  priceUsd: number | null
  image: string | null
  platform: string | null
  href: string
  addedAt: number
}

function isItem(value: unknown): value is WatchlistItem {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return typeof v.id === 'string' && typeof v.brand === 'string' && typeof v.href === 'string'
}

function readStorage(): WatchlistItem[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isItem)
  } catch {
    return []
  }
}

function writeStorage(items: WatchlistItem[]) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items))
    window.dispatchEvent(new CustomEvent(EVENT_NAME))
  } catch {
    // localStorage full or unavailable — silent fallback
  }
}

export function useWatchlist() {
  const [items, setItems] = useState<WatchlistItem[]>(() => readStorage())

  useEffect(() => {
    const handler = () => setItems(readStorage())
    window.addEventListener('storage', handler)
    window.addEventListener(EVENT_NAME, handler)
    return () => {
      window.removeEventListener('storage', handler)
      window.removeEventListener(EVENT_NAME, handler)
    }
  }, [])

  const add = useCallback((item: Omit<WatchlistItem, 'addedAt'>) => {
    setItems((current) => {
      if (current.some((v) => v.id === item.id)) return current
      const next = [...current, { ...item, addedAt: Date.now() }]
      writeStorage(next)
      return next
    })
  }, [])

  const remove = useCallback((id: string) => {
    setItems((current) => {
      if (!current.some((v) => v.id === id)) return current
      const next = current.filter((v) => v.id !== id)
      writeStorage(next)
      return next
    })
  }, [])

  const toggle = useCallback((item: Omit<WatchlistItem, 'addedAt'>) => {
    setItems((current) => {
      const exists = current.some((v) => v.id === item.id)
      const next = exists
        ? current.filter((v) => v.id !== item.id)
        : [...current, { ...item, addedAt: Date.now() }]
      writeStorage(next)
      return next
    })
  }, [])

  const has = useCallback((id: string) => items.some((v) => v.id === id), [items])

  const clear = useCallback(() => {
    setItems([])
    writeStorage([])
  }, [])

  return { items, ids: items.map((v) => v.id), count: items.length, add, remove, toggle, has, clear }
}
