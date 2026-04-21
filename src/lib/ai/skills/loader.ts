import * as fs from "node:fs"
import * as path from "node:path"

export interface LoadedSkill {
  name: string
  description?: string
  version: string
  model: string
  temperature: number
  systemPrompt: string
  userPromptTemplate: string
}

interface Frontmatter {
  name: string
  description?: string
  version: string
  model: string
  temperature: number
  references: string[]
}

const cache = new Map<string, LoadedSkill>()

const DEFAULT_SKILLS_DIR = path.resolve(process.cwd(), "src/lib/ai/skills")

export function __resetSkillCacheForTests(): void {
  cache.clear()
}

export function loadSkill(name: string, baseDir: string = DEFAULT_SKILLS_DIR): LoadedSkill {
  const cacheKey = path.join(baseDir, name)
  const cached = cache.get(cacheKey)
  if (cached) return cached

  const skillDir = path.join(baseDir, name)
  const skillPath = path.join(skillDir, "SKILL.md")
  if (!fs.existsSync(skillPath)) {
    throw new Error(`SKILL.md not found at ${skillPath}`)
  }
  const raw = fs.readFileSync(skillPath, "utf8")
  const { frontmatter, body } = parseFrontmatter(raw)

  const userHeading = "# User Prompt Template"
  const idx = body.indexOf(userHeading)
  if (idx === -1) {
    throw new Error(`Skill ${name}: missing '${userHeading}' heading in SKILL.md`)
  }
  const systemBody = body.slice(0, idx).trim()
  const userPromptTemplate = body.slice(idx + userHeading.length).trim()

  const referenceBlocks: string[] = []
  for (const ref of frontmatter.references) {
    const refPath = path.join(skillDir, ref)
    if (!fs.existsSync(refPath)) {
      throw new Error(`Skill ${name}: reference file not found: ${ref}`)
    }
    const content = fs.readFileSync(refPath, "utf8").trim()
    referenceBlocks.push(`## Reference: ${ref}\n\n${content}`)
  }

  const systemPrompt = [systemBody, ...referenceBlocks].filter(Boolean).join("\n\n")

  const skill: LoadedSkill = {
    name: frontmatter.name,
    description: frontmatter.description,
    version: frontmatter.version,
    model: frontmatter.model,
    temperature: frontmatter.temperature,
    systemPrompt,
    userPromptTemplate,
  }
  cache.set(cacheKey, skill)
  return skill
}

function parseFrontmatter(raw: string): { frontmatter: Frontmatter; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) {
    throw new Error("SKILL.md missing YAML frontmatter delimited by '---'")
  }
  const head = match[1]
  const body = match[2]

  const data: Record<string, string | string[]> = {}
  const lines = head.split(/\r?\n/)
  let i = 0
  while (i < lines.length) {
    const line = lines[i]
    if (!line.trim()) { i++; continue }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_-]*):\s*(.*)$/)
    if (!kv) { i++; continue }
    const key = kv[1]
    const rest = kv[2]

    if (key === "references") {
      // Either "references: []" or a block list
      const inline = rest.trim()
      if (inline === "[]") {
        data.references = []
        i++
        continue
      }
      const arr: string[] = []
      i++
      while (i < lines.length && /^\s*-\s+/.test(lines[i])) {
        arr.push(lines[i].replace(/^\s*-\s+/, "").trim())
        i++
      }
      data.references = arr
      continue
    }

    data[key] = rest.trim().replace(/^["']|["']$/g, "")
    i++
  }

  const required = ["name", "version", "model", "temperature"] as const
  for (const k of required) {
    if (data[k] === undefined) {
      throw new Error(`SKILL.md frontmatter missing field: ${k}`)
    }
  }

  const fm: Frontmatter = {
    name: String(data.name),
    description: data.description ? String(data.description) : undefined,
    version: String(data.version),
    model: String(data.model),
    temperature: Number(data.temperature),
    references: Array.isArray(data.references) ? (data.references as string[]) : [],
  }
  if (Number.isNaN(fm.temperature)) {
    throw new Error("SKILL.md frontmatter 'temperature' must be a number")
  }
  return { frontmatter: fm, body }
}
