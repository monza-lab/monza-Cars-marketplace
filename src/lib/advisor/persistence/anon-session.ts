import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const COOKIE_NAME = "monza_advisor_anon"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180 // 180 days

function getSecret(): string {
  const s = process.env.ADVISOR_ANON_SECRET
  if (!s || s.length < 32) throw new Error("ADVISOR_ANON_SECRET missing or too short (>= 32 chars required)")
  return s
}

function sign(payload: string): string {
  return createHmac("sha256", getSecret()).update(payload).digest("base64url")
}

export function mintAnonymousSession(): string {
  const id = randomBytes(16).toString("base64url")
  const sig = sign(id)
  return `${id}.${sig}`
}

export function verifyAnonymousSession(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null
  const [id, sig] = cookieValue.split(".")
  if (!id || !sig) return null
  const expected = sign(id)
  try {
    const a = Buffer.from(sig, "base64url")
    const b = Buffer.from(expected, "base64url")
    if (a.length !== b.length) return null
    if (!timingSafeEqual(a, b)) return null
    return id
  } catch {
    return null
  }
}

export const AnonSessionCookie = {
  name: COOKIE_NAME,
  maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
  attributes: {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: true,
    path: "/",
  },
}
