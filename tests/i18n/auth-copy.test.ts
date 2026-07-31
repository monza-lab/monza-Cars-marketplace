import { readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it } from "vitest"

const expectedCreateAccountDescriptions = {
  en: "Unlock 3 free reports — your first by email, two more with an account",
  es: "Desbloquea 3 informes gratis: el primero con tu correo y dos más con una cuenta",
  de: "Schalte 3 kostenlose Reports frei: den ersten per E-Mail, zwei weitere mit einem Konto",
  ja: "無料レポート3件を利用できます。1件目はメールで、残り2件はアカウント作成後に利用できます",
} as const

describe("Create Account report allowance copy", () => {
  it.each(Object.entries(expectedCreateAccountDescriptions))(
    "describes the one-time report allowance accurately in %s",
    (locale, expected) => {
      const messages = JSON.parse(
        readFileSync(join(process.cwd(), "messages", `${locale}.json`), "utf8"),
      ) as { auth: { createAccountDesc: string } }

      expect(messages.auth.createAccountDesc).toBe(expected)
    },
  )
})
