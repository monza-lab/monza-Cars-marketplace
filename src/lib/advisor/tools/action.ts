import type { ToolDef } from "@/lib/advisor/tools/registry"
import { fetchLiveListingById } from "@/lib/supabaseLiveListings"

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

// Returns a structured intent for the chat UI to render the Report CTA.

export const triggerReport: ToolDef = {
  name: "trigger_report",
  description:
    "Return an intent to show the 25-Piston investment report CTA for a listing. The frontend renders the button — this tool does not itself generate a report.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      listingId: { type: "string" },
    },
    required: ["listingId"],
  },
  async handler(args) {
    const listingId = typeof args.listingId === "string" ? args.listingId : ""
    if (!listingId) return { ok: false, error: "missing_arg:listingId" }

    const car = await fetchLiveListingById(listingId)
    if (!car) return { ok: false, error: "not_found" }

    const title = `${car.year} ${car.make} ${car.model}${car.trim ? ` ${car.trim}` : ""}`
    const payload = {
      kind: "report_cta" as const,
      carId: listingId,
      carTitle: title,
      cost: 25,
    }

    const summary = truncate(`Ready to generate 25-Piston investment report for ${title}`)
    return { ok: true, data: payload, summary }
  },
}

export const navigateTo: ToolDef = {
  name: "navigate_to",
  description:
    "Return a frontend-consumable navigation intent. The chat UI shows a suggested-link pill.",
  minTier: "FREE",
  parameters: {
    type: "object",
    properties: {
      route: { type: "string", description: "Target route, e.g. '/cars/porsche/997'." },
      params: {
        type: "object",
        additionalProperties: { type: "string" },
        description: "Optional query params to append.",
      },
      label: { type: "string", description: "Optional display label for the suggested link." },
    },
    required: ["route"],
  },
  async handler(args) {
    const route = typeof args.route === "string" ? args.route : ""
    if (!route) return { ok: false, error: "missing_arg:route" }
    const params =
      args.params && typeof args.params === "object" && !Array.isArray(args.params)
        ? (args.params as Record<string, unknown>)
        : {}
    const stringParams: Record<string, string> = {}
    for (const [k, v] of Object.entries(params)) {
      if (typeof v === "string") stringParams[k] = v
      else if (typeof v === "number" || typeof v === "boolean") stringParams[k] = String(v)
    }
    const label = typeof args.label === "string" ? args.label : null
    const payload = {
      kind: "navigate" as const,
      route,
      params: stringParams,
      label,
    }
    const summary = truncate(`Suggest navigating to ${route}`)
    return { ok: true, data: payload, summary }
  },
}

export const actionTools: ToolDef[] = [triggerReport, navigateTo]
