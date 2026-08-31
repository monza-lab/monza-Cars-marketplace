import { readFileSync } from "node:fs"
import { resolve } from "node:path"
import { describe, expect, it } from "vitest"

describe("Vercel cron plan compatibility", () => {
  it("schedules report claim reminders no more than once per day", () => {
    const config = JSON.parse(readFileSync(resolve(process.cwd(), "vercel.json"), "utf8")) as {
      crons?: Array<{ path: string; schedule: string }>
    }
    const reminder = config.crons?.find((cron) => cron.path === "/api/cron/report-claim-reminders")

    expect(reminder?.schedule).toBe("0 11 * * *")
  })
})
