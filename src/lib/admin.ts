/**
 * Centralized admin check.
 * Admin users bypass pistons (credits) for report generation and advisor usage.
 */

const ADMIN_EMAILS: string[] = [
  "caposk8@hotmail.com",
  "caposk817@gmail.com",
]

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
