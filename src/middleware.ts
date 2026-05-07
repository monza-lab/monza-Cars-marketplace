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

  const segments = pathname.split("/").filter(Boolean)
  if (
    segments.length >= 2 &&
    segments[0] === segments[1] &&
    routing.locales.includes(segments[0] as (typeof routing.locales)[number])
  ) {
    const canonicalPath = `/${[segments[0], ...segments.slice(2)].join("/")}`
    return NextResponse.redirect(new URL(`${canonicalPath}${search}`, request.url), 308)
  }

  if (localeInternalPrefix.test(pathname)) {
    const strippedPath = pathname.replace(/^\/[^/]+/, '')
    return NextResponse.rewrite(new URL(`${strippedPath}${search}`, request.url))
  }

  // API, auth callback, and the public /verify/[hash] anti-forge route must
  // NOT run i18n locale routing. The verify URL is shared on PDF/Excel
  // exports and needs to be locale-free so one canonical link works for
  // every recipient. All three paths still flow through Supabase session
  // refresh (benign for public routes; no-op when no session).
  if (
    pathname.startsWith('/api/') ||
    pathname === '/api' ||
    pathname.startsWith('/auth/') ||
    pathname.startsWith('/verify/')
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
