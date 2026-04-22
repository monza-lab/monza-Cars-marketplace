import { NextResponse, type NextRequest } from "next/server"
import { cookies } from "next/headers"
import { createClient } from "@/lib/supabase/server"
import { encodeSseEvent } from "@/lib/advisor/runtime/streaming"
import { runAdvisorTurn } from "@/lib/advisor/runtime/orchestrator"
import { createConversation, getConversation } from "@/lib/advisor/persistence/conversations"
import { AnonSessionCookie, mintAnonymousSession, verifyAnonymousSession } from "@/lib/advisor/persistence/anon-session"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

interface RequestBody {
  conversationId?: string
  content: string
  surface: "oracle" | "chat" | "page"
  initialContext?: { listingId?: string; seriesId?: string }
  locale?: "en" | "de" | "es" | "ja"
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as RequestBody
  if (!body.content || body.content.length > 4000) {
    return NextResponse.json({ error: "invalid_content" }, { status: 400 })
  }

  // Resolve identity
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  const cookieStore = await cookies()

  let anonymousSessionId: string | null = null
  if (!user) {
    const existing = cookieStore.get(AnonSessionCookie.name)?.value
    anonymousSessionId = verifyAnonymousSession(existing) ?? null
    if (!anonymousSessionId) {
      const minted = mintAnonymousSession()
      cookieStore.set(AnonSessionCookie.name, minted, { ...AnonSessionCookie.attributes, maxAge: AnonSessionCookie.maxAgeSeconds })
      anonymousSessionId = verifyAnonymousSession(minted)
    }
  }

  // Resolve tier + locale (tier lives on user_credits; no preferred_locale column)
  const profileRes = user
    ? await supabase.from("user_credits").select("tier").eq("supabase_user_id", user.id).single()
    : null
  const userTier: "FREE" | "PRO" = profileRes?.data?.tier === "PRO" ? "PRO" : "FREE"
  const locale: "en" | "de" | "es" | "ja" = (body.locale ?? "en") as "en" | "de" | "es" | "ja"

  // Resolve or create conversation
  let conversationId = body.conversationId ?? null
  if (!conversationId) {
    const conv = await createConversation({
      userId: user?.id ?? null,
      anonymousSessionId,
      surface: body.surface,
      locale,
      initialContextListingId: body.initialContext?.listingId ?? null,
      initialContextSeriesId: body.initialContext?.seriesId ?? null,
    })
    conversationId = conv.id
  } else {
    const conv = await getConversation(conversationId)
    if (!conv) return NextResponse.json({ error: "not_found" }, { status: 404 })
    if (conv.user_id && conv.user_id !== user?.id) return NextResponse.json({ error: "forbidden" }, { status: 403 })
    if (conv.anonymous_session_id && conv.anonymous_session_id !== anonymousSessionId) return NextResponse.json({ error: "forbidden" }, { status: 403 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const ev of runAdvisorTurn({
          userText: body.content,
          conversationId: conversationId!,
          surface: body.surface,
          userTier,
          userId: user?.id ?? null,
          anonymousSessionId,
          locale,
          initialContext: body.initialContext ?? null,
        })) {
          controller.enqueue(encoder.encode(encodeSseEvent(ev)))
        }
      } catch (err) {
        controller.enqueue(encoder.encode(encodeSseEvent({ type: "error", code: "unhandled", message: err instanceof Error ? err.message : String(err) })))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversationId!,
    },
  })
}
