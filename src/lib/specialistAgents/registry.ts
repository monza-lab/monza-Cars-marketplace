import type { SpecialistAgent } from "./types"

// Empty at v2 launch. Populated variant-by-variant in follow-on work.
const AGENTS = new Map<string, SpecialistAgent>()

export function getAgentForVariant(variantKey: string): SpecialistAgent | null {
  return AGENTS.get(variantKey) ?? null
}

export function hasAgentForVariant(variantKey: string): boolean {
  return AGENTS.has(variantKey)
}

export function registerAgent(agent: SpecialistAgent): void {
  AGENTS.set(agent.variant_key, agent)
}
