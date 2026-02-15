'use client'

import { Button } from '@/components/ui/button'
import { Zap } from 'lucide-react'

interface NoCreditsPromptProps {
  onPurchase?: () => void
  className?: string
}

export function NoCreditsPrompt({
  onPurchase,
  className = '',
}: NoCreditsPromptProps) {
  return (
    <div className={`flex flex-col items-center justify-center p-8 rounded-lg border border-[#FB923C]/20 bg-[#0F1012]/80 backdrop-blur-xl ${className}`}>
      <div className="w-12 h-12 rounded-full bg-[#FB923C]/10 flex items-center justify-center mb-4">
        <Zap className="w-6 h-6 text-[#FB923C]" />
      </div>
      <h3 className="text-lg font-semibold text-[#FFFCF7] mb-2">
        No Credits Remaining
      </h3>
      <p className="text-[#9CA3AF] text-center mb-6 max-w-sm">
        You&apos;ve used all your analysis credits. Purchase more to continue analyzing vehicles.
      </p>

      <div className="grid grid-cols-3 gap-3 mb-6 w-full max-w-sm">
        <CreditPackage amount={5} price={9} popular={false} />
        <CreditPackage amount={15} price={19} popular={true} />
        <CreditPackage amount={50} price={49} popular={false} />
      </div>

      <Button
        onClick={onPurchase}
        className="bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#F8B4D9]/90 font-semibold w-full max-w-sm"
      >
        Purchase Credits
      </Button>

      <p className="text-xs text-[#4B5563] mt-4">
        Free credits reset on the 1st of each month
      </p>
    </div>
  )
}

function CreditPackage({
  amount,
  price,
  popular,
}: {
  amount: number
  price: number
  popular: boolean
}) {
  return (
    <div
      className={`relative p-3 rounded-lg border text-center ${
        popular
          ? 'border-[#F8B4D9]/50 bg-[#F8B4D9]/5'
          : 'border-white/10 bg-white/5'
      }`}
    >
      {popular && (
        <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[10px] uppercase tracking-wider px-2 py-0.5 bg-[#F8B4D9] text-[#0b0b10] rounded-full font-semibold">
          Best
        </span>
      )}
      <div className="text-xl font-bold text-[#FFFCF7]">{amount}</div>
      <div className="text-xs text-[#9CA3AF]">credits</div>
      <div className="text-sm font-semibold text-[#34D399] mt-1">${price}</div>
    </div>
  )
}
