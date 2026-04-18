'use client'

import { Button } from '@/components/ui/button'
import { Coins } from 'lucide-react'
import { Link } from '@/i18n/navigation'

interface NoCreditsPromptProps {
  onPurchase?: () => void
  className?: string
}

export function NoCreditsPrompt({
  onPurchase,
  className = '',
}: NoCreditsPromptProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 rounded-lg border border-destructive/20 bg-card backdrop-blur-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <Coins className="w-6 h-6 text-destructive" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-2">
        No Credits Remaining
      </h3>
      <p className="text-muted-foreground text-center mb-6 max-w-sm">
        You&apos;ve used all your analysis credits. Purchase more to continue analyzing vehicles.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-sm">
        <CreditPackage amount={5} price={12.99} popular={false} label="Starter" />
        <CreditPackage amount={25} price={49.99} popular={true} label="Collector" />
        <CreditPackage amount={"∞"} price={59.99} popular={false} label="Pro /mo" />
      </div>

      <Button
        onClick={onPurchase}
        className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold w-full max-w-sm"
      >
        Purchase Credits
      </Button>

      <Link
        href="/pricing"
        className="text-[11px] text-primary hover:text-primary/80 mt-3 transition-colors"
      >
        View all plans →
      </Link>

      <p className="text-xs text-muted-foreground mt-3">
        Free credits reset on the 1st of each month
      </p>
    </div>
  )
}

function CreditPackage({
  amount,
  price,
  popular,
  label,
}: {
  amount: number | string
  price: number
  popular: boolean
  label: string
}) {
  return (
    <div
      className={`relative p-3 rounded-lg border text-center ${
        popular
          ? 'border-primary/50 bg-primary/5'
          : 'border-border bg-foreground/5'
      }`}
    >
      {popular && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-primary text-primary-foreground rounded-full font-semibold">
          Best
        </span>
      )}
      <div className="text-xl font-bold text-foreground">{amount}</div>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-semibold text-positive mt-1">${price}</div>
    </div>
  )
}
