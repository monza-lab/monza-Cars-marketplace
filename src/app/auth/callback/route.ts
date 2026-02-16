import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
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

  if (code) {
    const supabase = await createClient()
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

    if (!exchangeError) {
      return NextResponse.redirect(`${origin}${next}`)
    }

    console.error('Code exchange error:', exchangeError.message)
  }

  return NextResponse.redirect(`${origin}/?error=auth_callback_error`)
}
