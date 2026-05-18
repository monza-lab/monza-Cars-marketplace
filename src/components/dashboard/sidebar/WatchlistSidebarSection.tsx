'use client'

import { Link } from '@/i18n/navigation'
import { Heart, Car, X } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useCurrency } from '@/lib/CurrencyContext'
import { SafeImage } from '../cards/SafeImage'
import { platformShort } from '../constants'
import { useWatchlist } from '@/hooks/useWatchlist'

export function WatchlistSidebarSection() {
  const t = useTranslations('watchlist')
  const { formatPrice } = useCurrency()
  const { items, remove, clear } = useWatchlist()

  if (items.length === 0) {
    return (
      <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-6 py-10">
        <div className="size-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center mb-3">
          <Heart className="size-5 text-primary-foreground" strokeWidth={1.5} />
        </div>
        <p className="text-[12px] font-medium text-foreground">{t('empty')}</p>
        <p className="mt-1 text-[11px] text-muted-foreground max-w-[200px] leading-relaxed">
          {t('emptyHint')}
        </p>
      </div>
    )
  }

  // Most-recently-added first.
  const sorted = [...items].sort((a, b) => b.addedAt - a.addedAt)

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      {/* Items list */}
      <div className="flex-1 min-h-0 overflow-y-auto no-scrollbar">
        {sorted.map((item) => (
          <div
            key={item.id}
            className="group relative px-4 py-2.5 border-b border-border/50 hover:bg-foreground/2 transition-all"
          >
            <Link href={item.href} className="flex gap-3">
              {/* Thumbnail */}
              <div className="relative w-14 h-11 rounded-lg overflow-hidden shrink-0 bg-card">
                {item.image ? (
                  <SafeImage
                    src={item.image}
                    alt={`${item.brand} ${item.model}`}
                    fill
                    className="object-cover"
                    sizes="56px"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    fallback={
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Car className="size-3.5 text-muted-foreground" />
                      </div>
                    }
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <Car className="size-3.5 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                  {item.year ? `${item.year} ` : ''}
                  {item.brand} {item.model}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {item.priceUsd !== null ? (
                    <span className="text-[12px] font-display font-medium text-primary">
                      {formatPrice(item.priceUsd)}
                    </span>
                  ) : (
                    <span className="text-[11px] text-muted-foreground italic">—</span>
                  )}
                </div>
                {item.platform && (
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[8px] text-muted-foreground">
                      {platformShort[item.platform] || item.platform}
                    </span>
                  </div>
                )}
              </div>
            </Link>

            {/* Remove button — overlay, appears on hover */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                remove(item.id)
              }}
              aria-label={t('remove')}
              className="absolute top-1/2 right-2 -translate-y-1/2 size-6 rounded-full bg-background/90 border border-border/60 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-background hover:border-destructive/40 transition-all"
            >
              <X className="size-3 text-muted-foreground hover:text-destructive transition-colors" strokeWidth={2} />
            </button>
          </div>
        ))}
      </div>

      {/* Clear all footer */}
      {items.length > 1 && (
        <div className="shrink-0 border-t border-border/50 px-4 py-2">
          <button
            type="button"
            onClick={() => clear()}
            className="text-[10px] text-muted-foreground hover:text-foreground underline underline-offset-4 decoration-foreground/25 hover:decoration-foreground transition-colors"
          >
            {t('clearAll')}
          </button>
        </div>
      )}
    </div>
  )
}
