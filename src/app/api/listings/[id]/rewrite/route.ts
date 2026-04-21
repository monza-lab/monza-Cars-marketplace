import { NextResponse } from "next/server"
import { rewriteListing, type RewriterLocale } from "@/lib/ai/listingRewriter"
import { loadListingSource } from "@/lib/ai/listingSource"
import { createRateLimiter } from "@/lib/rateLimit"

const LIVE_PREFIX = "live-"
const SUPPORTED_LOCALES: RewriterLocale[] = ["en", "es", "de", "ja"]

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 })

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  if (process.env.LISTING_REWRITER_ENABLED !== "true") {
    return new NextResponse(null, { status: 204 })
  }

  const { id } = await params
  const url = new URL(request.url)
  const localeParam = url.searchParams.get("locale") ?? ""

  if (!SUPPORTED_LOCALES.includes(localeParam as RewriterLocale)) {
    return NextResponse.json({ error: "Unsupported locale" }, { status: 400 })
  }
  const locale = localeParam as RewriterLocale

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown"
  const gate = limiter.check(ip)
  if (!gate.allowed) {
    return NextResponse.json({ error: "Rate limit exceeded" }, { status: 429 })
  }

  // Curated entries carry human-authored copy; skip AI rewriting.
  if (!id.startsWith(LIVE_PREFIX)) {
    return new NextResponse(null, { status: 204 })
  }
  const dbId = id.slice(LIVE_PREFIX.length)

  let source
  try {
    source = await loadListingSource(dbId)
  } catch {
    return new NextResponse(null, { status: 204 })
  }
  if (!source) {
    return NextResponse.json({ error: "Listing not found" }, { status: 404 })
  }

  const result = await rewriteListing({ listingId: id, locale, source })
  if (!result) {
    return new NextResponse(null, { status: 204 })
  }

  return NextResponse.json({
    headline: result.headline,
    highlights: result.highlights,
  })
}
