'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { fireMetaEvent } from '@/lib/marketing/metaPixel'
import {
  Dialog,
  DialogContent,
} from '@/components/ui/dialog'
import { useTranslations } from 'next-intl'
import { Loader2, ChevronDown } from 'lucide-react'

interface AuthModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  defaultMode?: 'signin' | 'signup'
}

export function AuthModal({ open, onOpenChange, defaultMode = 'signin' }: AuthModalProps) {
  const t = useTranslations('auth')
  const [mode, setMode] = useState<'signin' | 'signup'>(defaultMode)
  const [showPassword, setShowPassword] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState<null | 'google' | 'magic' | 'password'>(null)
  const [error, setError] = useState<string | null>(null)
  const [magicSent, setMagicSent] = useState(false)
  const [signupConfirmation, setSignupConfirmation] = useState(false)

  const {
    signIn,
    signUp,
    resendConfirmationEmail,
    signInWithGoogle,
    signInWithMagicLink,
  } = useAuth()

  // Reset transient state when modal toggles
  useEffect(() => {
    if (!open) {
      setMagicSent(false)
      setSignupConfirmation(false)
      setError(null)
      setShowPassword(false)
      setLoading(null)
    } else {
      setMode(defaultMode)
    }
  }, [open, defaultMode])

  const handleGoogle = async () => {
    setLoading('google')
    setError(null)
    try {
      const { error } = await signInWithGoogle()
      if (error) {
        setError(error.message)
      } else {
        fireMetaEvent('CompleteRegistration', {
          pixelParams: { content_name: 'free_signup', status: 'completed' },
        })
      }
    } catch {
      setError(t('unexpectedError'))
    } finally {
      setLoading(null)
    }
  }

  const handleMagic = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email) {
      setError(t('emailRequired'))
      return
    }
    setLoading('magic')
    setError(null)
    try {
      const { error } = await signInWithMagicLink(email)
      if (error) {
        setError(error.message)
      } else {
        setMagicSent(true)
        if (mode === 'signup') {
          fireMetaEvent('CompleteRegistration', {
            pixelParams: { content_name: 'free_signup_magic', status: 'pending_email' },
            email,
          })
        }
      }
    } catch {
      setError(t('unexpectedError'))
    } finally {
      setLoading(null)
    }
  }

  const handlePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading('password')
    setError(null)
    try {
      if (mode === 'signin') {
        const { error } = await signIn(email, password)
        if (error) setError(error.message)
        else onOpenChange(false)
      } else {
        const { error } = await signUp(email, password, name)
        if (error) {
          setError(error.message)
        } else {
          fireMetaEvent('CompleteRegistration', {
            pixelParams: { content_name: 'free_signup', status: 'completed' },
            email,
          })
          setSignupConfirmation(true)
        }
      }
    } catch {
      setError(t('unexpectedError'))
    } finally {
      setLoading(null)
    }
  }

  const handleResendConfirmation = async () => {
    if (!email) return
    setLoading('magic')
    try {
      await resendConfirmationEmail(email)
    } finally {
      setLoading(null)
    }
  }

  const isSignup = mode === 'signup'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={[
          'p-0 gap-0 border-border bg-card overflow-y-auto',
          // Mobile: bottom sheet — force-override Radix center positioning
          '!left-0 !right-0 !bottom-0 !top-auto !translate-x-0 !translate-y-0 !max-w-none !rounded-t-3xl !rounded-b-none max-h-[92dvh]',
          // Desktop: re-center as standard modal
          'sm:!left-[50%] sm:!top-[50%] sm:!bottom-auto sm:!right-auto sm:!translate-x-[-50%] sm:!translate-y-[-50%]',
          'sm:!max-w-[420px] sm:!rounded-2xl sm:max-h-[90vh]',
        ].join(' ')}
      >
        {/* Mobile drag handle */}
        <div className="sm:hidden flex justify-center pt-3 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-foreground/15" />
        </div>

        {/* Header */}
        <div className="px-6 pt-4 sm:pt-7 pb-2">
          <h2 className="font-display text-[26px] sm:text-[24px] leading-tight font-medium text-foreground">
            {isSignup ? t('createAccountTitle') : t('welcomeBack')}
          </h2>
          <p className="mt-1.5 text-[13px] text-muted-foreground">
            {isSignup ? t('createAccountDesc') : t('signInDesc')}
          </p>
        </div>

        {/* Body */}
        <div className="px-6 pb-6 sm:pb-7 pt-4 space-y-3.5">
          {/* States: magic sent or signup confirmation */}
          {(magicSent || signupConfirmation) ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/[0.05] p-5 text-center">
              <p className="text-[14px] font-semibold text-foreground">
                {/* [HARDCODED] */}Check your inbox
              </p>
              <p className="mt-1.5 text-[12px] text-muted-foreground">
                {/* [HARDCODED] */}We sent a one-tap link to
                <br />
                <span className="text-foreground font-medium">{email}</span>
              </p>
              {signupConfirmation && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={loading === 'magic'}
                  className="mt-3 text-[11px] text-muted-foreground hover:text-primary underline underline-offset-2"
                >
                  {t('resendConfirmation')}
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Google — primary 1-tap action */}
              <button
                type="button"
                onClick={handleGoogle}
                disabled={loading !== null}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-foreground/[0.05] border border-border text-foreground text-[14px] font-medium active:bg-foreground/[0.1] disabled:opacity-60 transition-colors"
              >
                {loading === 'google' ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
                    <path
                      fill="#4285F4"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="#34A853"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="#EA4335"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                )}
                {t('continueWithGoogle')}
              </button>

              {/* OR divider */}
              <div className="flex items-center gap-3 py-1">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                  {t('or')}
                </span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Email + magic link (default for signup AND signin) */}
              {!showPassword ? (
                <form onSubmit={handleMagic} className="space-y-3">
                  {isSignup && (
                    <div>
                      <label className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                        {t('name')}
                      </label>
                      <input
                        type="text"
                        placeholder={t('namePlaceholder')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        className="mt-1 w-full bg-background border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      required
                      className="mt-1 w-full bg-background border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading !== null || !email}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold active:bg-primary/85 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading === 'magic' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      /* [HARDCODED] */ 'Continue with email'
                    )}
                  </button>
                  <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                    {t('magicLinkDesc')}
                  </p>
                </form>
              ) : (
                <form onSubmit={handlePassword} className="space-y-3">
                  {isSignup && (
                    <div>
                      <label className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                        {t('name')}
                      </label>
                      <input
                        type="text"
                        placeholder={t('namePlaceholder')}
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        autoComplete="name"
                        className="mt-1 w-full bg-background border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                      />
                    </div>
                  )}
                  <div>
                    <label className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                      {t('email')}
                    </label>
                    <input
                      type="email"
                      placeholder={t('emailPlaceholder')}
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      required
                      className="mt-1 w-full bg-background border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] tracking-[0.22em] uppercase text-muted-foreground">
                      {t('password')}
                    </label>
                    <input
                      type="password"
                      placeholder={t('passwordPlaceholder')}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={isSignup ? 'new-password' : 'current-password'}
                      required
                      minLength={6}
                      className="mt-1 w-full bg-background border border-border rounded-xl px-4 py-3 text-[14px] text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={loading !== null || !email || !password}
                    className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-[14px] font-semibold active:bg-primary/85 disabled:opacity-60 transition-colors flex items-center justify-center gap-2"
                  >
                    {loading === 'password' ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      isSignup ? t('createAccountTitle') : t('signIn')
                    )}
                  </button>
                </form>
              )}

              {/* Toggle password ⇄ magic link */}
              <button
                type="button"
                onClick={() => {
                  setShowPassword((v) => !v)
                  setError(null)
                }}
                className="w-full flex items-center justify-center gap-1.5 text-[11px] tracking-wide text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                <ChevronDown
                  className={`size-3 transition-transform ${showPassword ? 'rotate-180' : ''}`}
                />
                {showPassword
                  ? /* [HARDCODED] */ 'Use email link instead'
                  : /* [HARDCODED] */ 'Use password instead'}
              </button>

              {error && (
                <p className="text-[12px] text-destructive text-center">{error}</p>
              )}

              {/* Mode switch */}
              <p className="text-center text-[12px] text-muted-foreground pt-1">
                {isSignup
                  ? t('switchToSignIn')
                  : t('switchToSignUp')
                }
                {' '}
                <button
                  type="button"
                  onClick={() => {
                    setMode(isSignup ? 'signin' : 'signup')
                    setError(null)
                  }}
                  className="text-primary font-medium hover:underline"
                >
                  {isSignup
                    ? /* [HARDCODED] */ 'Sign in →'
                    : /* [HARDCODED] */ 'Create account →'}
                </button>
              </p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
