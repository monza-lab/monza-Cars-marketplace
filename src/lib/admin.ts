/**
 * Centralized admin check.
 * Admin users can access internal admin tooling.
 * Report generation monetization is controlled by user_credits tier/unlimited flags.
 */

const ADMIN_EMAILS: string[] = [
  "caposk8@hotmail.com",
  "caposk817@gmail.com",
]

export function isAdmin(email: string | null | undefined): boolean {
  if (!email) return false
  return ADMIN_EMAILS.includes(email.toLowerCase())
}
