import { readFileSync, readdirSync, statSync } from "node:fs"
import path from "node:path"
import ts from "typescript"
import { describe, expect, it } from "vitest"

const ROOT = process.cwd()
const PROHIBITED_AI_COPY = /artificial intelligence|inteligencia artificial|\bIA\b|künstliche Intelligenz|\bKI\b|人工知能|\bAI\b/iu

function filesUnder(relativeDir: string, extensions: readonly string[]): string[] {
  const absoluteDir = path.join(ROOT, relativeDir)
  return readdirSync(absoluteDir).flatMap((entry) => {
    const absolutePath = path.join(absoluteDir, entry)
    if (statSync(absolutePath).isDirectory()) {
      return filesUnder(path.relative(ROOT, absolutePath), extensions)
    }
    return extensions.some((extension) => absolutePath.endsWith(extension)) ? [absolutePath] : []
  })
}

function hasPathSegment(file: string, segment: string): boolean {
  return file.split(path.sep).includes(segment)
}

function publicContentFiles(): string[] {
  const appFiles = filesUnder("src/app", [".ts", ".tsx"])
    .filter((file) => !["api", "admin", "legal", "internal"].some((segment) => hasPathSegment(file, segment)))
    .filter((file) => path.basename(file) !== "robots.ts") // crawler identifiers, not human-facing content
  const componentFiles = filesUnder("src/components", [".ts", ".tsx"])
    .filter((file) => !hasPathSegment(file, "legal"))
  return [...appFiles, ...componentFiles, path.join(ROOT, "src/lib/payments/plans.ts")]
    .filter((file) => !/\.(?:test|spec)\.[^.]+$/.test(file))
}

function isNonContentString(node: ts.StringLiteralLike): boolean {
  const parent = node.parent
  if (ts.isImportDeclaration(parent) || ts.isExportDeclaration(parent)) return true
  if (ts.isExternalModuleReference(parent)) return true
  if (
    (ts.isPropertyAssignment(parent) || ts.isMethodDeclaration(parent) || ts.isPropertyDeclaration(parent)) &&
    parent.name === node
  ) return true
  return false
}

function extractContentStrings(source: string, fileName: string): string[] {
  const sourceFile = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX)
  const strings: string[] = []

  const visit = (node: ts.Node) => {
    if (ts.isJsxText(node)) {
      const text = node.getText(sourceFile).trim()
      if (text) strings.push(text)
    } else if ((ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) && !isNonContentString(node)) {
      strings.push(node.text)
    } else if (ts.isTemplateExpression(node)) {
      strings.push(node.head.text, ...node.templateSpans.map((span) => span.literal.text))
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return strings
}

function jsonStringValues(file: string): string[] {
  const values: string[] = []
  const visit = (value: unknown) => {
    if (typeof value === "string") values.push(value)
    else if (Array.isArray(value)) value.forEach(visit)
    else if (value && typeof value === "object") Object.values(value).forEach(visit)
  }
  visit(JSON.parse(readFileSync(file, "utf8")))
  return values
}

function findProhibitedPublicCopy(strings: readonly string[]): string[] {
  return strings.filter((value) => PROHIBITED_AI_COPY.test(value))
}

describe("public content string extraction", () => {
  it("detects localized marketing phrases in content literals", () => {
    const source = `
      const copy = [
        "artificial intelligence for collectors",
        "inteligencia artificial para coleccionistas",
        "Asesor IA",
        "künstliche Intelligenz für Sammler",
        "KI-Berater",
        "人工知能による分析",
        "AI advisor",
      ]
      export function Example() { return <p>AI-powered reports</p> }
    `

    expect(findProhibitedPublicCopy(extractContentStrings(source, "fixture.tsx"))).toHaveLength(8)
  })

  it("ignores comments, imports, identifiers, property keys, and non-content code", () => {
    const source = `
      import { AIClient } from "@/lib/ai/client"
      // AI advisor is an internal implementation note
      const AI_MODEL = { "AI": internalIdentifier }
      export function Example() { return <p>Market analysis</p> }
    `

    expect(findProhibitedPublicCopy(extractContentStrings(source, "fixture.tsx"))).toEqual([])
  })
})

describe("public funnel copy", () => {
  const messageFiles = filesUnder("messages", [".json"])

  it("uses Monthly instead of Genshpod in customer-visible messages and content literals", () => {
    const offenders = [
      ...messageFiles.filter((file) => jsonStringValues(file).some((value) => /genshpod/i.test(value))),
      ...publicContentFiles().filter((file) =>
        extractContentStrings(readFileSync(file, "utf8"), file).some((value) => /genshpod/i.test(value)),
      ),
    ]

    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([])
  })

  it("does not market the product with localized AI framing", () => {
    const offenders = [
      ...messageFiles.filter((file) => findProhibitedPublicCopy(jsonStringValues(file)).length > 0),
      ...publicContentFiles().filter((file) =>
        findProhibitedPublicCopy(extractContentStrings(readFileSync(file, "utf8"), file)).length > 0,
      ),
    ]

    expect(offenders.map((file) => path.relative(ROOT, file))).toEqual([])
  })
})
