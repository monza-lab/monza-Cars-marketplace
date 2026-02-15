'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { AuthModal } from './AuthModal'
import { Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'

interface AuthRequiredPromptProps {
  message?: string
  className?: string
}

export function AuthRequiredPrompt({
  message,
  className = '',
}: AuthRequiredPromptProps) {
  const t = useTranslations('auth')
  const [showAuthModal, setShowAuthModal] = useState(false)
  const displayMessage = message ?? t('analysisRequiresSignInDesc')

  return (
    <>
      <div className={`flex flex-col items-center justify-center p-8 rounded-lg border border-white/10 bg-[#0F1012]/80 backdrop-blur-xl ${className}`}>
        <div className="w-12 h-12 rounded-full bg-[#F8B4D9]/10 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-[#F8B4D9]" />
        </div>
        <h3 className="text-lg font-semibold text-[#FFFCF7] mb-2">
          {t('analysisRequiresSignInTitle')}
        </h3>
        <p className="text-[#9CA3AF] text-center mb-6 max-w-sm">
          {displayMessage}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowAuthModal(true)}
            className="bg-[#F8B4D9] text-[#0b0b10] hover:bg-[#F8B4D9]/90 font-semibold"
          >
            {t('signIn')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAuthModal(true)}
            className="border-white/10 text-[#FFFCF7] hover:bg-white/5"
          >
            {t('createAccountTitle')}
          </Button>
        </div>
        <p className="text-xs text-[#4B5563] mt-4">
          {t('newAccountsCredits')}
        </p>
      </div>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultMode="signin"
      />
    </>
  )
}
