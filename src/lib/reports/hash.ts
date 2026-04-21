import { createHash } from "crypto"

export interface HashOptions {
  ignoreKeys?: string[]
}

/**
 * Deterministic SHA256 over an object. Keys are sorted recursively,
 * then JSON-serialized. Undefined values are stripped.
 * Use `ignoreKeys` to exclude volatile fields (e.g., `generated_at`)
 * from the hashed representation.
 */
export function computeReportHash(obj: unknown, options: HashOptions = {}): string {
  const normalized = normalize(obj, new Set(options.ignoreKeys ?? []))
  const json = JSON.stringify(normalized)
  return createHash("sha256").update(json).digest("hex")
}

function normalize(value: unknown, ignoreKeys: Set<string>): unknown {
  if (value === null || value === undefined) return null
  if (Array.isArray(value)) return value.map((v) => normalize(v, ignoreKeys))
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>
    const sorted: Record<string, unknown> = {}
    for (const key of Object.keys(obj).sort()) {
      if (ignoreKeys.has(key)) continue
      if (obj[key] === undefined) continue
      sorted[key] = normalize(obj[key], ignoreKeys)
    }
    return sorted
  }
  return value
}
