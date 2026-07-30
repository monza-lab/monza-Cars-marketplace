import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { requestLeadAccess } from "@/lib/reportAccess/repository"

export const runtime = "nodejs"

const schema = z.object({
  email: z.string().trim().email().max(320),
  listingId: z.string().trim().min(1).max(200),
  deviceId: z.string().trim().min(8).max(200),
  attribution: z.record(z.string(), z.unknown()).optional(),
})

const statusByCode: Record<string, number> = {
  AUTH_REQUIRED: 409,
  CLAIM_REQUIRED: 409,
  RATE_LIMITED: 429,
  DISPOSABLE_EMAIL: 422,
}

export async function POST(request: NextRequest) {
  const parsed = schema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ ok: false, code: "INVALID_REQUEST" }, { status: 400 })
  }

  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    || request.headers.get("x-real-ip")
    || "unknown"
  const result = await requestLeadAccess({ ...parsed.data, ip })
  if (!result.ok) {
    return NextResponse.json(result, { status: statusByCode[result.code] ?? 500 })
  }
  return NextResponse.json(result)
}
