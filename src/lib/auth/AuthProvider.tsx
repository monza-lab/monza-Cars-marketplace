'use client'

import { createContext, useContext, useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User, Session } from '@supabase/supabase-js'

export interface UserProfile {
  id: string
  supabaseId: string
  email: string
  name: string | null
  avatarUrl: string | null
  creditsBalance: number
  freeCreditsUsed: number
  tier: 'FREE' | 'PRO'
  creditResetDate: string
}

interface AuthContextType {
  user: User | null
  session: Session | null
  profile: UserProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>
  signUp: (email: string, password: string, name?: string) => Promise<{ error: Error | null }>
  resendConfirmationEmail: (email: string) => Promise<{ error: Error | null }>
  signInWithGoogle: () => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

type ProfileFetchResult = {
  ok: boolean
  status: number | null
}

const SUPPORTED_LOCALES = new Set(['en', 'es', 'de', 'ja'])

function getLocalePrefixFromPathname(pathname: string): string {
  const firstSegment = pathname.split('/').filter(Boolean)[0]
  if (!firstSegment || !SUPPORTED_LOCALES.has(firstSegment)) {
    return ''
  }
  return `/${firstSegment}`
}

function getApiCandidates(path: string): string[] {
  if (typeof window === 'undefined') {
    return [path]
  }

  const localePrefix = getLocalePrefixFromPathname(window.location.pathname)
  if (!localePrefix) {
    return [path]
  }

  return [`${localePrefix}${path}`, path]
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = useMemo(() => createClient(), [])
  const creatingUserRef = useRef(false)

  const fetchProfile = useCallback(async (accessToken?: string): Promise<ProfileFetchResult> => {
    for (const endpoint of getApiCandidates('/api/user/profile')) {
      try {
        const response = await fetch(endpoint, {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
        })
        if (response.ok) {
          const data = await response.json()
          setProfile(data.profile)
          return { ok: true, status: response.status }
        }

        if (response.status !== 404) {
          return { ok: false, status: response.status }
        }
      } catch (error) {
        console.error('Error fetching profile:', error)
      }
    }

    return { ok: false, status: 404 }
  }, [])

  const createUserProfile = useCallback(async (supabaseUser: User, accessToken?: string): Promise<ProfileFetchResult> => {
    if (creatingUserRef.current) {
      return { ok: false, status: null }
    }

    creatingUserRef.current = true
    try {
      for (const endpoint of getApiCandidates('/api/user/create')) {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
          body: JSON.stringify({
            email: supabaseUser.email,
            name: supabaseUser.user_metadata?.full_name,
          }),
        })

        if (res.ok) {
          return await fetchProfile(accessToken)
        }

        if (res.status !== 404) {
          return { ok: false, status: res.status }
        }
      }

      return { ok: false, status: 404 }
    } catch (error) {
      console.error('Error creating user profile:', error)
      return { ok: false, status: null }
    } finally {
      creatingUserRef.current = false
    }
  }, [fetchProfile])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile()
    }
  }, [user, fetchProfile])

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        setSession(session)
        setUser(session?.user ?? null)

        if (session?.user) {
          let profileResult = await fetchProfile(session.access_token)

          // Email confirmation path can establish auth session before the app profile
          // row exists in Prisma; create it immediately instead of waiting for timing.
          if (!profileResult.ok && profileResult.status === 404) {
            profileResult = await createUserProfile(session.user, session.access_token)
          }

          // Only force sign-out on auth rejection. Other failures (e.g. DB 500)
          // should not destroy a valid auth session.
          if (!profileResult.ok && (profileResult.status === 401 || profileResult.status === 403)) {
            await supabase.auth.signOut()
            setSession(null)
            setUser(null)
            setProfile(null)
          }
        }
      } catch (error) {
        console.error('Error initializing auth:', error)
      } finally {
        setLoading(false)
      }
    }

    initAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session)
        setUser(session?.user ?? null)

        if (event === 'SIGNED_IN' && session?.user) {
          const createResult = await createUserProfile(session.user, session.access_token)
          if (!createResult.ok && (createResult.status === 401 || createResult.status === 403)) {
            await supabase.auth.signOut()
            setSession(null)
            setUser(null)
            setProfile(null)
          }
        } else if (event === 'SIGNED_OUT') {
          setProfile(null)
        }
      }
    )

    return () => {
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile, createUserProfile])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, name?: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
        data: {
          full_name: name,
        },
      },
    })

    if (error) {
      return { error }
    }

    // Supabase may return a user object with no identities when the email already
    // exists (anti-enumeration behavior). Surface a clear sign-in message.
    if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
      return {
        error: new Error('Email already registered. Please sign in or reset your password.'),
      }
    }

    return { error: null }
  }

  const resendConfirmationEmail = async (email: string) => {
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/confirm`,
      },
    })
    return { error }
  }

  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        resendConfirmationEmail,
        signInWithGoogle,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
