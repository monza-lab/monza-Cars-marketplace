import { describe, it, expect, beforeEach, vi } from "vitest"
import * as fs from "node:fs"
import * as path from "node:path"
import * as os from "node:os"

import { loadSkill, __resetSkillCacheForTests } from "./loader"

function writeSkill(dir: string, files: Record<string, string>) {
  fs.mkdirSync(dir, { recursive: true })
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, rel)
    fs.mkdirSync(path.dirname(full), { recursive: true })
    fs.writeFileSync(full, content, "utf8")
  }
}

describe("loadSkill", () => {
  let tmp: string
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), "skill-"))
    __resetSkillCacheForTests()
  })

  it("parses frontmatter fields and splits body at user-prompt heading", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "description: demo skill",
        "version: 1.2.3",
        "model: gemini-2.5-flash",
        "temperature: 0.4",
        "references: []",
        "---",
        "",
        "# System Instruction",
        "",
        "SYSTEM BODY",
        "",
        "# User Prompt Template",
        "",
        "USER BODY",
      ].join("\n"),
    })

    const skill = loadSkill("demo", tmp)
    expect(skill.name).toBe("demo")
    expect(skill.version).toBe("1.2.3")
    expect(skill.model).toBe("gemini-2.5-flash")
    expect(skill.temperature).toBe(0.4)
    expect(skill.systemPrompt).toContain("SYSTEM BODY")
    expect(skill.systemPrompt).not.toContain("USER BODY")
    expect(skill.userPromptTemplate.trim()).toBe("USER BODY")
  })

  it("appends referenced files under '## Reference' headings", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "version: 1.0.0",
        "model: gemini-2.5-flash",
        "temperature: 0",
        "references:",
        "  - references/a.md",
        "  - references/b.md",
        "---",
        "",
        "# System Instruction",
        "SYSTEM",
        "# User Prompt Template",
        "USER",
      ].join("\n"),
      "references/a.md": "A CONTENT",
      "references/b.md": "B CONTENT",
    })

    const skill = loadSkill("demo", tmp)
    expect(skill.systemPrompt).toContain("## Reference: references/a.md")
    expect(skill.systemPrompt).toContain("A CONTENT")
    expect(skill.systemPrompt).toContain("## Reference: references/b.md")
    expect(skill.systemPrompt).toContain("B CONTENT")
  })

  it("caches after first load", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "version: 1.0.0",
        "model: gemini-2.5-flash",
        "temperature: 0",
        "references: []",
        "---",
        "# System Instruction",
        "x",
        "# User Prompt Template",
        "y",
      ].join("\n"),
    })
    const a = loadSkill("demo", tmp)
    const b = loadSkill("demo", tmp)
    expect(a).toBe(b)
  })

  it("throws when SKILL.md is missing", () => {
    expect(() => loadSkill("nope", tmp)).toThrow(/SKILL\.md/)
  })

  it("throws when User Prompt Template heading is missing", () => {
    writeSkill(path.join(tmp, "demo"), {
      "SKILL.md": [
        "---",
        "name: demo",
        "version: 1.0.0",
        "model: gemini-2.5-flash",
        "temperature: 0",
        "references: []",
        "---",
        "# System Instruction",
        "no template here",
      ].join("\n"),
    })
    expect(() => loadSkill("demo", tmp)).toThrow(/User Prompt Template/)
  })

  it("kind: chat skips the User Prompt Template requirement", () => {
    writeSkill(path.join(tmp, "advisor"), {
      "SKILL.md": [
        "---",
        "name: advisor",
        "kind: chat",
        "version: 0.1.0",
        "model: gemini-2.5-flash",
        "temperature: 0.3",
        "references: []",
        "---",
        "",
        "# System Instruction",
        "",
        "You are the MonzaHaus advisor.",
      ].join("\n"),
    })

    const skill = loadSkill("advisor", tmp)
    expect(skill.kind).toBe("chat")
    expect(skill.userPromptTemplate).toBe("")
    expect(skill.systemPrompt).toContain("You are the MonzaHaus advisor.")
  })
})
