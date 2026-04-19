import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const handleI18nRouting = createMiddleware(routing)
const localeInternalPrefix = new RegExp(
  `^/(${routing.locales.join('|')})/(api|trpc|_next|_vercel)(?:/|$)`
)

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (localeInternalPrefix.test(pathname)) {
    const strippedPath = pathname.replace(/^\/[^/]+/, '')
    return NextResponse.rewrite(new URL(`${strippedPath}${search}`, request.url))
  }

  // API and auth callback routes must refresh the Supabase session cookie,
  // but must NOT run i18n locale routing (see docs/login-overview.md Issue 3).
  if (
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname.startsWith('/auth/')
  ) {
    return updateSession(request)
  }

  return handleI18nRouting(request)
}

export const config = {
  matcher: [
    // Pages + API routes (locale routing OR Supabase session refresh).
    // Exclude static assets, Next internals, and trpc (no trpc app routes).
    '/((?!trpc|_next|_vercel|.*\\..*).*)',
    // Locale-prefixed paths (including /en/api/* → rewritten above)
    '/:locale(en|es|de|ja)/:path*',
  ],
}
