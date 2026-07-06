'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { AuthModal } from './AuthModal'
import { Lock } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { useAuth } from '@/lib/auth/AuthProvider'

interface AuthRequiredPromptProps {
  message?: string
  className?: string
}

export function AuthRequiredPrompt({
  message,
  className = '',
}: AuthRequiredPromptProps) {
  const t = useTranslations('auth')
  const router = useRouter()
  const { user } = useAuth()
  const [showAuthModal, setShowAuthModal] = useState(false)
  const displayMessage = message ?? t('analysisRequiresSignInDesc')

  useEffect(() => {
    if (user) {
      router.refresh()
    }
  }, [router, user])

  return (
    <>
      <div className={`flex flex-col items-center justify-center p-8 rounded-lg border border-border bg-card backdrop-blur-xl ${className}`}>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-4">
          <Lock className="w-6 h-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t('analysisRequiresSignInTitle')}
        </h3>
        <p className="text-muted-foreground text-center mb-6 max-w-sm">
          {displayMessage}
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={() => setShowAuthModal(true)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold"
          >
            {t('createAccountTitle')}
          </Button>
          <Button
            variant="outline"
            onClick={() => setShowAuthModal(true)}
            className="border-border text-foreground hover:bg-foreground/5"
          >
            {t('signIn')}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          {t('newAccountsCredits')}
        </p>
      </div>

      <AuthModal
        open={showAuthModal}
        onOpenChange={setShowAuthModal}
        defaultMode="signup"
      />
    </>
  )
}
