import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Prevent link-preview/head checks from consuming one-time confirmation tokens.
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'
  const redirectUrl = next.startsWith('http') ? next : new URL(next, origin).toString()
  const successResponse = NextResponse.redirect(redirectUrl)

  if (token_hash && type) {
    const supabase = await createClient({ response: successResponse })
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      return successResponse
    }

    console.error('Email confirmation error:', error.message)
  }

  if (code) {
    const supabase = await createClient({ response: successResponse })
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      return successResponse
    }

    console.error('Email confirmation code exchange error:', error.message)
  }

  return NextResponse.redirect(
    `${origin}/?error=confirmation_failed`
  )
}
