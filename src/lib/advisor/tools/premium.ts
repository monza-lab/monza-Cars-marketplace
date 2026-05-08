import type { ToolDef } from "@/lib/advisor/tools/registry"
import { GoogleGenerativeAI } from "@google/generative-ai"

function truncate(s: string, max = 500): string {
  if (s.length <= max) return s
  return s.slice(0, max - 1) + "…"
}

function extractUrls(text: string): string[] {
  const matches = Array.from(text.matchAll(/\((https?:\/\/[^\s)]+)\)/g)).map((m) => m[1])
  const bare = Array.from(text.matchAll(/https?:\/\/[^\s)\]]+/g)).map((m) => m[0])
  const combined = [...matches, ...bare]
  return [...new Set(combined)].slice(0, 10)
}

function firstSentences(text: string, max = 3): string {
  const stripped = text.replace(/\s+/g, " ").trim()
  const parts = stripped.split(/(?<=[.!?])\s+/).slice(0, max)
  return parts.join(" ")
}

// ─── web_search (Gemini + googleSearchRetrieval) ───

export const webSearch: ToolDef = {
  name: "web_search",
  description:
    "Grounded web research: returns a concise answer plus a list of cited source URLs. PRO tier only.",
  minTier: "PRO",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string" },
    },
    required: ["query"],
  },
  async handler(args, ctx) {
    const query = typeof args.query === "string" ? args.query.trim() : ""
    if (!query) return { ok: false, error: "missing_arg:query" }
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { ok: false, error: "gemini_api_key_missing" }

    try {
      const client = new GoogleGenerativeAI(apiKey)
      const model = client.getGenerativeModel({
        model: process.env.GEMINI_MODEL_PRO ?? "gemini-2.5-pro",
        systemInstruction: `You are the MonzaHaus advisor's web-research subagent. Answer the query concisely (≤200 words). Cite every factual claim with a source URL inline in the form [source](url). End your answer with a "## Sources" list of unique URLs used. Respond in locale ${ctx.locale}.`,
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        // Gemini 2.5 Pro supports Google Search grounding as a native tool.
        // The typed Schema on @google/generative-ai doesn't yet expose this as
        // a first-class field; cast at the boundary so the runtime payload is
        // still shaped correctly.
        tools: [{ googleSearchRetrieval: {} } as unknown as never],
      })
      let text: string
      try {
        const res = await model.generateContent(query)
        text = res.response.text()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // If the SDK or backend rejects googleSearchRetrieval, surface a
        // graceful failure rather than silently falling back to pretraining.
        if (/googleSearchRetrieval|tool|unsupported/i.test(msg)) {
          return { ok: false, error: "gemini_tool_unavailable" }
        }
        return { ok: false, error: `gemini_error:${msg}` }
      }
      const sources = extractUrls(text)
      const summary = truncate(`${firstSentences(text, 2)} [${sources.length} source${sources.length === 1 ? "" : "s"}]`)
      return { ok: true, data: { answer: text, sources }, summary }
    } catch (err) {
      return { ok: false, error: `gemini_init_failed:${err instanceof Error ? err.message : "unknown"}` }
    }
  },
}

// ─── fetch_url (Gemini + urlContext) ───

export const fetchUrl: ToolDef = {
  name: "fetch_url",
  description:
    "Summarize a URL the user pasted (e.g., a BaT listing). Uses Gemini's urlContext tool. PRO tier only.",
  minTier: "PRO",
  parameters: {
    type: "object",
    properties: {
      url: { type: "string" },
      question: {
        type: "string",
        description: "Optional question to answer about the URL's content.",
      },
    },
    required: ["url"],
  },
  async handler(args, ctx) {
    const url = typeof args.url === "string" ? args.url.trim() : ""
    if (!url) return { ok: false, error: "missing_arg:url" }
    if (!/^https?:\/\//.test(url)) return { ok: false, error: "invalid_url" }
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) return { ok: false, error: "gemini_api_key_missing" }

    const question =
      typeof args.question === "string" && args.question.trim()
        ? args.question.trim()
        : "Summarize the key facts of this listing and note anything that matters for a collector-car buyer."

    try {
      const client = new GoogleGenerativeAI(apiKey)
      const model = client.getGenerativeModel({
        model: process.env.GEMINI_MODEL_PRO ?? "gemini-2.5-pro",
        systemInstruction: `You are the MonzaHaus advisor's URL-reader subagent. Summarize the page concisely (≤200 words), focus on facts relevant to collector-car buyers (chassis/variant, mileage, price, provenance, condition). Cite specific facts back to the URL. Respond in locale ${ctx.locale}.`,
        generationConfig: { temperature: 0.2, maxOutputTokens: 4096 },
        tools: [{ urlContext: {} } as unknown as never],
      })
      let text: string
      try {
        const prompt = `${question}\n\nURL: ${url}`
        const res = await model.generateContent(prompt)
        text = res.response.text()
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (/urlContext|tool|unsupported/i.test(msg)) {
          return { ok: false, error: "gemini_tool_unavailable" }
        }
        return { ok: false, error: `gemini_error:${msg}` }
      }
      const sources = [url, ...extractUrls(text)].slice(0, 10)
      const summary = truncate(`${firstSentences(text, 3)} [source: ${url}]`)
      return { ok: true, data: { answer: text, url, sources }, summary }
    } catch (err) {
      return { ok: false, error: `gemini_init_failed:${err instanceof Error ? err.message : "unknown"}` }
    }
  },
}

export const premiumTools: ToolDef[] = [webSearch, fetchUrl]
