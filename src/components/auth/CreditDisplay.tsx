'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { Coins } from 'lucide-react'

interface CreditDisplayProps {
  onClick?: () => void
}

export function CreditDisplay({ onClick }: CreditDisplayProps) {
  const { profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 animate-pulse">
        <div className="w-3 h-3 bg-foreground/10 rounded" />
        <div className="w-8 h-3 bg-foreground/10 rounded" />
      </div>
    )
  }

  if (!profile) {
    return null
  }

  const credits = profile.creditsBalance

  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-foreground/5 hover:bg-foreground/10 transition-colors border border-border"
    >
      <Coins className={`w-3.5 h-3.5 ${credits > 0 ? 'text-primary' : 'text-[#FB923C]'}`} />
      <span className="text-sm font-medium text-foreground">
        {credits}
      </span>
      <span className="text-xs text-muted-foreground hidden sm:inline">
        credits
      </span>
    </button>
  )
}
