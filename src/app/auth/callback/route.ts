import { NextResponse } from 'next/server'
import { type EmailOtpType } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const tokenHash = searchParams.get('token_hash')
  const otpType = searchParams.get('type') as EmailOtpType | null
  const next = searchParams.get('next') ?? '/'

  // Handle error redirects from Supabase (e.g. user denied consent)
  const error = searchParams.get('error')
  const errorDescription = searchParams.get('error_description')
  if (error) {
    console.error('Auth callback error:', error, errorDescription)
    const params = new URLSearchParams({ error })
    if (errorDescription) params.set('error_description', errorDescription)
    return NextResponse.redirect(`${origin}/?${params.toString()}`)
  }

  const supabase = await createClient()

  if (tokenHash && otpType) {
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType,
    })

    if (!verifyError) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('OTP verification error:', verifyError.message)
    return NextResponse.redirect(`${origin}/?error=confirmation_failed`)
  }

  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('Code exchange error:', exchangeError.message)
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_error`)
}
