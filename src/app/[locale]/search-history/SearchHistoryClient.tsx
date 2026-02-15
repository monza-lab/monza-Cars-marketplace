"use client"

import { useState, useEffect } from "react"
import { Clock, Trash2, Search, Sparkles, X } from "lucide-react"
import { useAuth } from "@/lib/auth/AuthProvider"
import { AuthModal } from "@/components/auth/AuthModal"
import {
  getSearchHistory,
  removeSearchEntry,
  clearSearchHistory,
  type SearchHistoryEntry,
} from "@/lib/searchHistory"
import { useTranslations } from "next-intl"
import { Link } from "@/i18n/navigation"

function timeAgo(timestamp: number, t: (key: string) => string): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return t("justNow")
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  return `${weeks}w`
}

function getDateGroup(
  timestamp: number,
  t: (key: string) => string
): string {
  const now = new Date()
  const date = new Date(timestamp)
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const yesterdayStart = todayStart - 86400000
  const weekStart = todayStart - 6 * 86400000

  if (timestamp >= todayStart) return t("today")
  if (timestamp >= yesterdayStart) return t("yesterday")
  if (timestamp >= weekStart) return t("thisWeek")
  return t("older")
}

export default function SearchHistoryClient() {
  const { user, loading: authLoading } = useAuth()
  const t = useTranslations("searchHistory")
  const [entries, setEntries] = useState<SearchHistoryEntry[]>([])
  const [showAuthModal, setShowAuthModal] = useState(false)

  useEffect(() => {
    setEntries(getSearchHistory())
  }, [])

  const handleRemove = (timestamp: number) => {
    removeSearchEntry(timestamp)
    setEntries(getSearchHistory())
  }

  const handleClearAll = () => {
    clearSearchHistory()
    setEntries([])
  }

  // Group entries by date
  const grouped = entries.reduce<Record<string, SearchHistoryEntry[]>>(
    (acc, entry) => {
      const group = getDateGroup(entry.timestamp, t)
      if (!acc[group]) acc[group] = []
      acc[group].push(entry)
      return acc
    },
    {}
  )

  // Preserve group order
  const groupOrder = [t("today"), t("yesterday"), t("thisWeek"), t("older")]
  const orderedGroups = groupOrder.filter((g) => grouped[g])

  // Not authenticated
  if (!authLoading && !user) {
    return (
      <div className="min-h-screen bg-[#0b0b10] pt-28">
        <div className="mx-auto max-w-2xl px-4 text-center">
          <div className="mx-auto size-16 rounded-2xl bg-[rgba(248,180,217,0.08)] flex items-center justify-center mb-6">
            <Clock className="size-7 text-[#F8B4D9]" />
          </div>
          <h1 className="text-2xl font-light text-[#FFFCF7]">{t("title")}</h1>
          <p className="mt-3 text-sm text-[rgba(255,252,247,0.45)]">
            {t("signInRequired")}
          </p>
          <button
            onClick={() => setShowAuthModal(true)}
            className="mt-6 rounded-full bg-[#F8B4D9] px-8 py-2.5 text-[12px] font-semibold tracking-[0.1em] uppercase text-[#0b0b10] hover:bg-[#f4cbde] transition-colors"
          >
            {t("signIn")}
          </button>
          <AuthModal open={showAuthModal} onOpenChange={setShowAuthModal} />
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#0b0b10] pt-28 pb-32">
      {/* Header */}
      <div className="mx-auto max-w-3xl px-4 sm:px-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <div className="flex items-center gap-2 text-[#F8B4D9] mb-3">
              <Clock className="size-4" />
              <span className="text-[11px] font-medium tracking-[0.2em] uppercase">
                {t("kicker")}
              </span>
            </div>
            <h1 className="text-2xl font-light tracking-tight text-[#FFFCF7] sm:text-3xl">
              {t("title")}
            </h1>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 rounded-full border border-white/10 px-4 py-1.5 text-[11px] font-medium text-[#9CA3AF] hover:text-red-400 hover:border-red-400/30 transition-colors"
            >
              <Trash2 className="size-3" />
              {t("clearAll")}
            </button>
          )}
        </div>

        {/* Empty state */}
        {entries.length === 0 && !authLoading && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="mx-auto size-16 rounded-2xl bg-[rgba(248,180,217,0.06)] flex items-center justify-center mb-5">
              <Search className="size-7 text-[#F8B4D9]/40" />
            </div>
            <p className="text-[15px] text-[rgba(255,252,247,0.5)]">
              {t("empty")}
            </p>
            <p className="mt-2 text-[13px] text-[rgba(255,252,247,0.25)]">
              {t("emptyHint")}
            </p>
          </div>
        )}

        {/* Grouped history */}
        {orderedGroups.map((group) => (
          <div key={group} className="mb-6">
            <p className="text-[10px] font-semibold tracking-[0.2em] uppercase text-[rgba(255,252,247,0.3)] mb-3 px-1">
              {group}
            </p>
            <div className="space-y-1">
              {grouped[group].map((entry) => (
                <div
                  key={entry.timestamp}
                  className="group flex items-center gap-3 rounded-xl px-4 py-3 hover:bg-white/[0.03] transition-colors"
                >
                  <Sparkles className="size-4 text-[#F8B4D9]/30 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-[#FFFCF7] truncate">
                      {entry.query}
                    </p>
                  </div>
                  <span className="text-[11px] text-[#4B5563] shrink-0 font-mono">
                    {timeAgo(entry.timestamp, t)}
                  </span>
                  <button
                    onClick={() => handleRemove(entry.timestamp)}
                    className="opacity-0 group-hover:opacity-100 size-7 flex items-center justify-center rounded-lg hover:bg-white/[0.05] text-[#4B5563] hover:text-red-400 transition-all shrink-0"
                    title={t("remove")}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
