import { describe, expect, it } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const headerSource = readFileSync(join(process.cwd(), "src/components/layout/Header.tsx"), "utf8")

describe("Header layout priority", () => {
  it("keeps desktop search ahead of secondary listing controls", () => {
    expect(headerSource).toContain('data-onboarding="search"')
    expect(headerSource).toMatch(/data-onboarding="search"[\s\S]*flex-\[1_1_18rem\]/)
    expect(headerSource).toMatch(/hidden xl:block[\s\S]*<ViewToggle \/>/)
    expect(headerSource).toMatch(/data-onboarding="regions"[\s\S]*hidden xl:flex/)
  })
})
