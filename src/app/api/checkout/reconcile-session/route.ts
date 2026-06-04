import { NextResponse } from "next/server"
import { fulfillCheckoutSession } from "@/lib/payments/fulfillment"
import { getStripeClient } from "@/lib/payments/stripe"
import { createClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type ReconcileRequest = {
  sessionId?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as ReconcileRequest
    const sessionId = body.sessionId?.trim()
    if (!sessionId || !sessionId.startsWith("cs_")) {
      return NextResponse.json({ error: "Invalid session" }, { status: 400 })
    }

    const session = await getStripeClient().checkout.sessions.retrieve(sessionId)
    if (session.metadata?.appUserId !== user.id) {
      return NextResponse.json({ error: "Session does not belong to user" }, { status: 403 })
    }

    const result = await fulfillCheckoutSession(session)
    return NextResponse.json(result)
  } catch (error) {
    console.error("[checkout-reconcile] failed:", error)
    return NextResponse.json(
      { error: "Failed to reconcile checkout session" },
      { status: 500 },
    )
  }
}
