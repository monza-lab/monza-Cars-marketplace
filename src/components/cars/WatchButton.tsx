'use client'

import { Heart } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useWatchlist, type WatchlistItem } from '@/hooks/useWatchlist'

interface WatchButtonProps {
  item: Omit<WatchlistItem, 'addedAt'>
  /** 'overlay' floats on top of a card image; 'inline' sits in card body */
  variant?: 'overlay' | 'inline'
  className?: string
}

export function WatchButton({ item, variant = 'overlay', className = '' }: WatchButtonProps) {
  const t = useTranslations('watchlist')
  const { has, toggle } = useWatchlist()
  const isWatched = has(item.id)

  const base =
    'inline-flex items-center justify-center rounded-full transition-all duration-200 active:scale-90 ' +
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary'

  const styles = {
    overlay:
      'size-9 bg-background/85 backdrop-blur-md border border-border/60 ' +
      'hover:bg-background hover:border-primary/40 shadow-sm',
    inline: 'size-8 bg-foreground/[0.04] hover:bg-foreground/[0.08] border border-border/40',
  }[variant]

  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault()
        e.stopPropagation()
        toggle(item)
      }}
      aria-label={isWatched ? t('remove') : t('add')}
      aria-pressed={isWatched}
      className={`${base} ${styles} ${className}`}
    >
      <Heart
        className={`size-4 transition-colors duration-200 ${
          isWatched ? 'fill-primary text-primary' : 'text-foreground/70 hover:text-primary'
        }`}
        strokeWidth={1.75}
      />
    </button>
  )
}
