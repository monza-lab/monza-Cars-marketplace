const DISPOSABLE_DOMAINS = new Set([
  "10minutemail.com",
  "guerrillamail.com",
  "maildrop.cc",
  "mailinator.com",
  "sharklasers.com",
  "tempmail.com",
  "yopmail.com",
])

export type LeadPolicyCode = "AUTH_REQUIRED" | "CLAIM_REQUIRED" | "RATE_LIMITED"

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase()
}

export function isDisposableEmail(email: string): boolean {
  const domain = normalizeEmail(email).split("@")[1]
  return Boolean(domain && DISPOSABLE_DOMAINS.has(domain))
}

export function evaluateLeadRequest({
  attemptsInLastHour,
}: {
  claimedUserExists: boolean
  completedReports: number
  attemptsInLastHour: number
}): { ok: true } | { ok: false; code: LeadPolicyCode } {
  if (attemptsInLastHour >= 3) return { ok: false, code: "RATE_LIMITED" }
  return { ok: true }
}

export function isReportFresh({
  updatedAt,
  storedFingerprint,
  currentFingerprint,
  now = new Date(),
}: {
  updatedAt: string | null | undefined
  storedFingerprint: string | null | undefined
  currentFingerprint: string
  now?: Date
}): boolean {
  if (!updatedAt || !storedFingerprint || storedFingerprint !== currentFingerprint) return false
  const updated = Date.parse(updatedAt)
  return Number.isFinite(updated) && now.getTime() - updated <= 7 * 24 * 60 * 60 * 1000
}
