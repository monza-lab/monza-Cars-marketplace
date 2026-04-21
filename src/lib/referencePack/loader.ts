import type { ReferencePack } from "./types"

// In-memory registry. Production loader will fetch from Supabase table
// `variant_reference_pack` once BE migration lands. Tests inject via
// `registerPackForTesting`.
const REGISTRY = new Map<string, ReferencePack>()

export async function loadReferencePack(variantKey: string): Promise<ReferencePack | null> {
  const pack = REGISTRY.get(variantKey)
  return pack ?? null
}

export function registerPackForTesting(pack: ReferencePack): void {
  REGISTRY.set(pack.variant_key, pack)
}

export function clearPacksForTesting(): void {
  REGISTRY.clear()
}
