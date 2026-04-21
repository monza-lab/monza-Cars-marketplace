import type { KBEntry } from "./types"

// In-memory test registry. Production will query Supabase `variant_knowledge`.
const REGISTRY: KBEntry[] = []

export async function getKBEntriesForVariant(variantKey: string): Promise<KBEntry[]> {
  const matching = REGISTRY.filter((e) => e.variant_key === variantKey)
  const supersededIds = new Set(
    matching.map((e) => e.supersedes).filter((id): id is string => id !== null)
  )
  return matching.filter((e) => !supersededIds.has(e.id))
}

export function registerKBEntryForTesting(entry: KBEntry): void {
  REGISTRY.push(entry)
}

export function clearKBForTesting(): void {
  REGISTRY.length = 0
}
