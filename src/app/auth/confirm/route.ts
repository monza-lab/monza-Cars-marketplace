import { type EmailOtpType } from '@supabase/supabase-js'
import { NextResponse, type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Prevent link-preview/head checks from consuming one-time confirmation tokens.
export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const rawTokenHash = searchParams.get('token_hash')
  const type = searchParams.get('type') as EmailOtpType | null
  const code = searchParams.get('code')
  const rawNext = searchParams.get('next') ?? '/'
  const recovered = recoverTokenHashFromNext(rawNext, rawTokenHash)
  const token_hash = recovered.tokenHash
  const next = recovered.next
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

function recoverTokenHashFromNext(next: string, tokenHash: string | null): {
  next: string
  tokenHash: string | null
} {
  if (tokenHash || !next.includes('token_hash=')) {
    return { next, tokenHash }
  }

  const tokenMatch = next.match(/[?&]token_hash=([^&]+)/)
  const recoveredToken = tokenMatch?.[1] ? decodeURIComponent(tokenMatch[1]) : null
  if (!recoveredToken) {
    return { next, tokenHash }
  }

  const [beforeToken] = next.split(/[?&]token_hash=/)
  const cleanNext = beforeToken.endsWith('?') || beforeToken.endsWith('&')
    ? beforeToken.slice(0, -1)
    : beforeToken

  return {
    next: cleanNext || '/',
    tokenHash: recoveredToken,
  }
}
