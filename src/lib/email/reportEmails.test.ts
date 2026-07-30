import { describe, expect, it } from "vitest"
import { buildReportReadyEmail, buildClaimReminderEmail } from "./reportEmails"

describe("report emails", () => {
  it("builds a durable report link", () => {
    const email = buildReportReadyEmail({ siteUrl: "https://monzahaus.com", listingId: "live-1", token: "raw token" })
    expect(email.subject).toBe("Your Haus Report is ready")
    expect(email.html).toContain("/cars/porsche/live-1/report?access=raw%20token")
    expect(email.html).not.toMatch(/\bAI\b/)
  })

  it("builds the D+1 claim reminder without promising watchlist sync", () => {
    const email = buildClaimReminderEmail({ siteUrl: "https://monzahaus.com", email: "buyer@example.com" })
    expect(email.subject).toContain("2 free Haus Reports")
    expect(email.html).toContain("/get-started?claim=buyer%40example.com")
    expect(email.html).not.toMatch(/watchlist/i)
  })
})
