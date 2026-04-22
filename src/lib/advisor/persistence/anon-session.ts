import { createHmac, randomBytes, timingSafeEqual } from "node:crypto"

const COOKIE_NAME = "monza_advisor_anon"
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 180 // 180 days
const MIN_SECRET_LENGTH = 32

let warnedMissingSecret = false

function getSecret(): string | null {
  const s = process.env.ADVISOR_ANON_SECRET
  if (s && s.length >= MIN_SECRET_LENGTH) return s
  if (!warnedMissingSecret) {
    warnedMissingSecret = true
    console.warn("[advisor] ADVISOR_ANON_SECRET missing or too short; anonymous sessions will use unsigned fallback ids")
  }
  return null
}

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url")
}

export function mintAnonymousSession(): string {
  const id = randomBytes(16).toString("base64url")
  const secret = getSecret()
  if (!secret) return id
  const sig = sign(id, secret)
  return `${id}.${sig}`
}

export function verifyAnonymousSession(cookieValue: string | null | undefined): string | null {
  if (!cookieValue) return null
  const secret = getSecret()
  if (!secret) {
    const trimmed = cookieValue.trim()
    if (!trimmed) return null
    const [id] = trimmed.split(".")
    return id || null
  }
  const [id, sig] = cookieValue.split(".")
  if (!id || !sig) return null
  const expected = sign(id, secret)
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
