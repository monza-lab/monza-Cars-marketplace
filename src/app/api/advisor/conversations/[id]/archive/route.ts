import { NextResponse, type NextRequest } from "next/server"
import { createClient } from "@/lib/supabase/server"
import {
  archiveConversation,
  getConversation,
} from "@/lib/advisor/persistence/conversations"

export const dynamic = "force-dynamic"

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 })

  const conv = await getConversation(id)
  if (!conv || conv.user_id !== user.id) {
    return NextResponse.json({ error: "not_found" }, { status: 404 })
  }

  await archiveConversation(id)
  return NextResponse.json({ ok: true })
}
