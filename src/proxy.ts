import createMiddleware from 'next-intl/middleware'
import { NextRequest, NextResponse } from 'next/server'
import { routing } from './i18n/routing'

const handleI18nRouting = createMiddleware(routing)
const localeInternalPrefix = new RegExp(
  `^/(${routing.locales.join("|")})/(api|trpc|_next|_vercel)(?:/|$)`
)

export default function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl

  if (localeInternalPrefix.test(pathname)) {
    const strippedPath = pathname.replace(/^\/[^/]+/, '')
    return NextResponse.rewrite(new URL(`${strippedPath}${search}`, request.url))
  }

  return handleI18nRouting(request)
}

export const config = {
  matcher: [
    '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
    '/:locale(en|es|de|ja)/:path*'
  ]
}
