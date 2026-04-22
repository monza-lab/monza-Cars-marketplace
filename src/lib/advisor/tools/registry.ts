// The Gemini SDK's `Schema` union requires `type` to be the `SchemaType` enum,
// which forbids plain string literals like `"object"`. For the registry's
// purposes we only need a JSON-schema-shaped parameters slot; callers that
// hand a value to the Gemini SDK can cast to `Schema` at the boundary.
export type ToolParameterSchema = unknown

export type ToolMinTier = "FREE" | "PRO"

export interface ToolInvocationContext {
  userId: string | null
  anonymousSessionId: string | null
  userTier: "FREE" | "PRO"
  locale: "en" | "de" | "es" | "ja"
  conversationId: string
  region?: string
  currency?: string
}

export interface ToolSuccess { ok: true; summary: string; data: unknown }
export interface ToolFailure { ok: false; error: string }
export type ToolResult = ToolSuccess | ToolFailure

export type ToolHandler = (args: Record<string, unknown>, ctx: ToolInvocationContext) => Promise<ToolResult>

export interface ToolDef {
  name: string
  description: string
  parameters: ToolParameterSchema
  minTier: ToolMinTier
  handler: ToolHandler
}

export interface ToolRegistry {
  register(def: ToolDef): void
  listForTier(tier: "FREE" | "PRO"): ToolDef[]
  invoke(name: string, args: Record<string, unknown>, tier: "FREE" | "PRO", ctx: ToolInvocationContext): Promise<ToolResult>
}

export function createToolRegistry(): ToolRegistry {
  const tools = new Map<string, ToolDef>()
  return {
    register(def) { tools.set(def.name, def) },
    listForTier(tier) {
      return [...tools.values()].filter(t => t.minTier === "FREE" || tier === "PRO")
    },
    async invoke(name, args, tier, ctx) {
      const def = tools.get(name)
      if (!def) return { ok: false, error: `unknown_tool:${name}` }
      if (def.minTier === "PRO" && tier === "FREE") {
        return { ok: false, error: "upgrade_required: this capability is available on PRO" }
      }
      try {
        return await def.handler(args, ctx)
      } catch (err) {
        return { ok: false, error: err instanceof Error ? err.message : String(err) }
      }
    },
  }
}
