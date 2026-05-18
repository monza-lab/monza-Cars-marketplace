// @vitest-environment jsdom

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useWatchlist, type WatchlistItem } from './useWatchlist'

const KEY = 'monza:watchlist:v1'

function makeItem(id: string, overrides: Partial<Omit<WatchlistItem, 'addedAt' | 'id'>> = {}) {
  return {
    id,
    brand: 'Porsche',
    model: '992 GT3',
    year: 2023,
    priceUsd: 250000,
    image: 'https://example.com/img.jpg',
    platform: 'BRING_A_TRAILER',
    href: `/cars/porsche/${id}`,
    ...overrides,
  }
}

describe('useWatchlist', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('starts empty', () => {
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.items).toEqual([])
    expect(result.current.ids).toEqual([])
    expect(result.current.count).toBe(0)
    expect(result.current.has('car-1')).toBe(false)
  })

  it('adds an item', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add(makeItem('car-1')))
    expect(result.current.ids).toEqual(['car-1'])
    expect(result.current.has('car-1')).toBe(true)
    expect(result.current.items[0].brand).toBe('Porsche')
    expect(typeof result.current.items[0].addedAt).toBe('number')
  })

  it('does not duplicate when adding the same id twice', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add(makeItem('car-1')))
    act(() => result.current.add(makeItem('car-1')))
    expect(result.current.count).toBe(1)
  })

  it('removes by id', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add(makeItem('car-1')))
    act(() => result.current.add(makeItem('car-2')))
    act(() => result.current.remove('car-1'))
    expect(result.current.ids).toEqual(['car-2'])
  })

  it('toggle adds when missing, removes when present', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.toggle(makeItem('car-1')))
    expect(result.current.has('car-1')).toBe(true)
    act(() => result.current.toggle(makeItem('car-1')))
    expect(result.current.has('car-1')).toBe(false)
  })

  it('clear empties the list', () => {
    const { result } = renderHook(() => useWatchlist())
    act(() => result.current.add(makeItem('car-1')))
    act(() => result.current.add(makeItem('car-2')))
    act(() => result.current.clear())
    expect(result.current.items).toEqual([])
  })

  it('hydrates stored items from an effect, not during render', async () => {
    localStorage.setItem(KEY, JSON.stringify([makeItem('car-1', { brand: 'Ferrari', model: '296 GTB' })]))
    const getItem = vi.spyOn(Storage.prototype, 'getItem')

    const { result } = renderHook(() => useWatchlist())

    await waitFor(() => expect(result.current.ids).toEqual(['car-1']))
    expect(result.current.items[0].brand).toBe('Ferrari')
    expect(getItem).toHaveBeenCalledTimes(1)
  })

  it('persists across mounts via localStorage', async () => {
    const first = renderHook(() => useWatchlist())
    act(() => first.result.current.add(makeItem('car-1', { brand: 'Ferrari', model: '296 GTB' })))
    first.unmount()

    const second = renderHook(() => useWatchlist())
    await waitFor(() => expect(second.result.current.ids).toEqual(['car-1']))
    expect(second.result.current.items[0].brand).toBe('Ferrari')
  })

  it('handles corrupted localStorage gracefully', () => {
    localStorage.setItem(KEY, 'not valid json')
    const { result } = renderHook(() => useWatchlist())
    expect(result.current.items).toEqual([])
  })

  it('drops invalid entries in stored array', async () => {
    localStorage.setItem(
      KEY,
      JSON.stringify([
        makeItem('car-1'),
        'not an object',
        { id: 'car-2' /* missing required fields */ },
        makeItem('car-3'),
      ]),
    )
    const { result } = renderHook(() => useWatchlist())
    await waitFor(() => expect(result.current.ids).toEqual(['car-1', 'car-3']))
  })

  it('syncs across instances via custom event', () => {
    const a = renderHook(() => useWatchlist())
    const b = renderHook(() => useWatchlist())

    act(() => a.result.current.add(makeItem('car-1')))

    expect(a.result.current.ids).toEqual(['car-1'])
    expect(b.result.current.ids).toEqual(['car-1'])
  })
})
