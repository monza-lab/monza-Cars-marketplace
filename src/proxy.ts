import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import createIntlMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Create the intl middleware
const intlMiddleware = createIntlMiddleware(routing)

export async function proxy(request: NextRequest) {
  // First, handle i18n routing
  const intlResponse = intlMiddleware(request)

  // If intl middleware returned a redirect, return it
  if (intlResponse.status !== 200) {
    return intlResponse
  }

  // Now handle Supabase auth
  let supabaseResponse = NextResponse.next({
    request,
    headers: intlResponse.headers,
  })

  // Copy cookies from intl response
  intlResponse.cookies.getAll().forEach((cookie) => {
    supabaseResponse.cookies.set(cookie.name, cookie.value, cookie)
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''

  // Build safety: if env vars are missing during build, provide placeholders 
  // to avoid @supabase/ssr validation errors.
  const supabase = createServerClient(
    supabaseUrl || 'https://placeholder-url.supabase.co',
    supabaseAnonKey || 'placeholder-key',
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
            headers: intlResponse.headers,
          })
          // Re-copy intl cookies
          intlResponse.cookies.getAll().forEach((cookie) => {
            supabaseResponse.cookies.set(cookie.name, cookie.value, cookie)
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Refresh session if expired - required for Server Components
  await supabase.auth.getUser()

  return supabaseResponse
}

export const config = {
  matcher: [
    // Match all pathnames except for:
    // - API routes
    // - Static files
    // - Next.js internals
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
}
