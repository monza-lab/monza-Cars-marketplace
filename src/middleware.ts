import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'
import { updateSession } from '@/lib/supabase/middleware'

const localeInternalPrefix = new RegExp(
  `^/(${routing.locales.join('|')})/(api|trpc|_next|_vercel)(?:/|$)`
)

// English-only mode: strip legacy locale prefixes from incoming URLs.
// /es/x → /x, /de/x → /x, /ja/x → /x. Lets old links + indexed pages
// resolve to the English version instead of 404ing. Remove this block
// when re-enabling other locales (see src/i18n/routing.ts).
const HIDDEN_LOCALES = ['es', 'de', 'ja'] as const
const hiddenLocalePrefix = new RegExp(`^/(${HIDDEN_LOCALES.join('|')})(/|$)`)

export default async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (hiddenLocalePrefix.test(pathname)) {
    let stripped = pathname
    while (hiddenLocalePrefix.test(stripped)) {
      stripped = stripped.replace(hiddenLocalePrefix, '/') || '/'
    }
    stripped = stripped.replace(/\/{2,}/g, '/') || '/'
    return NextResponse.redirect(new URL(`${stripped}${search}`, request.url), 308)
  }

  const segments = pathname.split("/").filter(Boolean)
  if (
    segments.length >= 2 &&
    segments[0] === segments[1] &&
    routing.locales.includes(segments[0] as (typeof routing.locales)[number])
  ) {
    const canonicalPath = `/${[segments[0], ...segments.slice(2)].join("/")}`
    return NextResponse.redirect(new URL(`${canonicalPath}${search}`, request.url), 308)
  }

  if (segments[0] === routing.defaultLocale) {
    return NextResponse.next()
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

  // English-only mode with locale-free public URLs. next-intl's generic
  // `as-needed` middleware can emit a self-redirect in dev here, so keep the
  // public URL locale-free and rewrite directly to the internal [locale] tree.
  const internalUrl = request.nextUrl.clone()
  internalUrl.pathname =
    pathname === '/'
      ? `/${routing.defaultLocale}`
      : `/${routing.defaultLocale}${pathname}`
  return NextResponse.rewrite(internalUrl)
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
