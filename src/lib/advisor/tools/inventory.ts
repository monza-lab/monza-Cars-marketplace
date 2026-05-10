import type { ToolDef } from "@/lib/advisor/tools/registry"
import { countAdvisorListings } from "@/lib/advisor/advisorListings"

export const countListings: ToolDef = {
  name: "count_listings",
  description:
    "Count how many listings match the given filters. Use this when the user asks 'how many', 'total', 'count', or 'do you have any' questions.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      make: { type: "string", description: "Make, defaults to 'Porsche'." },
      seriesId: { type: "string", description: "Series id like '997', '993', 'cayenne'." },
      variantId: { type: "string", description: "Variant (GT3, Turbo, Targa, etc.)." },
      query: { type: "string", description: "Free-text keyword." },
      status: {
        type: "string",
        enum: ["live", "ended"],
        description: "Filter by status: 'live' for active listings, 'ended' for sold.",
      },
    },
  },
  async handler(args) {
    const make = typeof args.make === "string" && args.make ? args.make : "Porsche"
    const seriesId = typeof args.seriesId === "string" ? args.seriesId : null
    const variantId = typeof args.variantId === "string" ? args.variantId.toLowerCase() : null
    const query = typeof args.query === "string" ? args.query.trim() : null
    const status = typeof args.status === "string" ? (args.status as "live" | "ended") : null

    const result = await countAdvisorListings({
      make,
      seriesId: seriesId || undefined,
      variantId: variantId || undefined,
      query: query || undefined,
      status,
    })

    if (!result.ok) {
      return { ok: false, error: "count_failed" }
    }

    const filters = [
      seriesId && `series=${seriesId}`,
      variantId && `variant=${variantId}`,
      query && `"${query}"`,
      status && `status=${status}`,
    ]
      .filter(Boolean)
      .join(", ")

    const summary = `${result.count.toLocaleString("en-US")} ${make} listings${filters ? ` matching ${filters}` : ""}`

    return {
      ok: true,
      data: { count: result.count, make, seriesId, variantId, query, status },
      summary,
    }
  },
}

export const inventoryTools: ToolDef[] = [countListings]
