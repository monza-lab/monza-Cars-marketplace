export type AdvisorSseEvent =
  | { type: "classified"; tier: "instant" | "marketplace" | "deep_research"; estimatedPistons: number; downgraded: boolean }
  | { type: "tool_call_start"; name: string; args: Record<string, unknown> }
  | { type: "tool_call_end"; name: string; summary: string; ok: boolean }
  | { type: "content_delta"; delta: string }
  | { type: "deep_research_cost"; runningPistons: number; toolsUsed: string[] }
  | { type: "done"; pistonsDebited: number; messageId: string }
  | { type: "error"; code: string; message: string }

export function encodeSseEvent(ev: AdvisorSseEvent): string {
  return `event: advisor\ndata: ${JSON.stringify(ev)}\n\n`
}

export function parseSseLine(line: string): AdvisorSseEvent | null {
  if (!line.startsWith("data: ")) return null
  try {
    return JSON.parse(line.slice(6)) as AdvisorSseEvent
  } catch {
    return null
  }
}
