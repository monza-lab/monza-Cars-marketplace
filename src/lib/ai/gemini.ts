// ---------------------------------------------------------------------------
// Gemini API Client — for investment report analysis
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI, type Schema } from "@google/generative-ai"

const DEFAULT_MODEL = "gemini-2.5-flash"

function getClient() {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY environment variable is not set")
  return new GoogleGenerativeAI(apiKey)
}

function getModelId(): string {
  return process.env.GEMINI_MODEL || DEFAULT_MODEL
}

/**
 * Send a prompt with system instruction to Gemini and return text response.
 * Retries once with exponential backoff on transient errors.
 */
export async function analyzeWithGemini(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const client = getClient()
  const model = client.getGenerativeModel({
    model: getModelId(),
    systemInstruction: systemPrompt,
  })

  let lastError: Error | null = null

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const result = await model.generateContent(userPrompt)
      return result.response.text()
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err))
      if (attempt === 0) {
        // Wait 2 seconds before retry
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
  }

  throw lastError ?? new Error("Gemini API call failed")
}

// ---------------------------------------------------------------------------
// JSON client — Haus Report Phase 4 (Task 25)
// Thin wrapper that enforces responseMimeType: application/json and returns
// a parsed, typed payload. Callers validate the returned T against a schema.
// ---------------------------------------------------------------------------

const JSON_API_KEY = process.env.GEMINI_API_KEY
const JSON_MODEL_ID = process.env.GEMINI_MODEL ?? "gemini-2.5-flash"

if (!JSON_API_KEY) {
  // Don't throw at module load — allow build-time/test-time imports without the key.
  console.warn("[gemini] GEMINI_API_KEY is not set; calls will fail at runtime.")
}

interface GenerateJsonOptions {
  systemPrompt?: string
  userPrompt: string
  model?: string
  temperature?: number      // default 0
  maxOutputTokens?: number  // default 2048
  responseSchema?: Schema   // NEW: enforce a JSON schema on Gemini's output
}

export interface GeminiJsonResponse<T> {
  ok: true
  data: T
  raw: string
}

export interface GeminiErrorResponse {
  ok: false
  error: string
  raw: string | null
}

/**
 * Generate a JSON response from Gemini. Enforces responseMimeType: application/json.
 * The caller is responsible for validating the returned T matches its schema.
 */
export async function generateJson<T>(
  opts: GenerateJsonOptions,
): Promise<GeminiJsonResponse<T> | GeminiErrorResponse> {
  if (!JSON_API_KEY) {
    return { ok: false, error: "GEMINI_API_KEY is not configured", raw: null }
  }

  const client = new GoogleGenerativeAI(JSON_API_KEY)
  const model = client.getGenerativeModel({
    model: opts.model ?? JSON_MODEL_ID,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0,
      maxOutputTokens: opts.maxOutputTokens ?? 2048,
      responseMimeType: "application/json",
      ...(opts.responseSchema ? { responseSchema: opts.responseSchema } : {}),
    },
  })

  // Gemini 2.5 Flash has been intermittently rate-limited / 503'd under load.
  // A single transient failure here would surface to users as the placeholder
  // fallback on first visit, and the client-side hook caches null for the
  // session — so one hiccup locks the user out of the AI content. Two retries
  // with backoff covers the vast majority of transient failures while keeping
  // the total latency ceiling reasonable (~1s + ~2s + final attempt).
  const MAX_ATTEMPTS = 3
  let lastError: unknown = null
  let raw = ""

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    try {
      const res = await model.generateContent(opts.userPrompt)
      raw = res.response.text()
      const parsed = parseJsonPayload<T>(raw)
      return { ok: true, data: parsed, raw }
    } catch (err) {
      lastError = err
      if (attempt < MAX_ATTEMPTS - 1) {
        const backoffMs = 1000 * Math.pow(2, attempt) // 1s, 2s
        await new Promise(resolve => setTimeout(resolve, backoffMs))
      }
    }
  }

  return {
    ok: false,
    error: lastError instanceof Error ? lastError.message : String(lastError),
    raw,
  }
}

function parseJsonPayload<T>(raw: string): T {
  const candidates = buildJsonCandidates(raw)

  for (const candidate of candidates) {
    try {
      return JSON.parse(candidate) as T
    } catch {
      // Try the next candidate.
    }
  }

  throw new Error("Gemini response was not valid JSON")
}

function buildJsonCandidates(raw: string): string[] {
  const trimmed = raw.trim()
  const candidates = new Set<string>([trimmed])

  const fenced = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()
  candidates.add(fenced)

  const objectStart = trimmed.indexOf("{")
  const objectEnd = trimmed.lastIndexOf("}")
  if (objectStart >= 0 && objectEnd > objectStart) {
    candidates.add(trimmed.slice(objectStart, objectEnd + 1).trim())
  }

  const arrayStart = trimmed.indexOf("[")
  const arrayEnd = trimmed.lastIndexOf("]")
  if (arrayStart >= 0 && arrayEnd > arrayStart) {
    candidates.add(trimmed.slice(arrayStart, arrayEnd + 1).trim())
  }

  return [...candidates]
}

// ---------------------------------------------------------------------------
// Streaming + function-calling client (advisor runtime)
// ---------------------------------------------------------------------------

export interface ToolDefinition {
  name: string
  description: string
  parameters: Schema
}

export interface StreamMessage {
  role: "user" | "assistant" | "tool"
  content: string
  toolName?: string // when role === "tool"
}

export interface StreamOptions {
  model: string
  systemPrompt: string
  messages: StreamMessage[]
  tools: ToolDefinition[]
  temperature?: number
  maxOutputTokens?: number
  signal?: AbortSignal
}

export type StreamEvent =
  | { type: "text"; delta: string }
  | { type: "tool_call"; name: string; args: Record<string, unknown> }
  | { type: "error"; message: string; code?: string; retryable?: boolean; cause?: unknown }

function classifyGeminiError(err: unknown): { message: string; code: string; retryable: boolean; cause: unknown } {
  const message = err instanceof Error ? err.message : String(err)
  const retryable = /(429|rate.?limit|quota|503|ETIMEDOUT|ENOTFOUND|ECONNRESET|network)/i.test(message)
  return { message, code: retryable ? "transient" : "llm_error", retryable, cause: err }
}

export async function* streamWithTools(opts: StreamOptions): AsyncGenerator<StreamEvent> {
  // Check if already aborted before doing any work.
  if (opts.signal?.aborted) {
    yield { type: "error", message: "request aborted before start", code: "aborted", retryable: false }
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    yield { type: "error", message: "GEMINI_API_KEY is not configured", code: "missing_api_key", retryable: false }
    return
  }

  const client = new GoogleGenerativeAI(apiKey)
  const model = client.getGenerativeModel({
    model: opts.model,
    systemInstruction: opts.systemPrompt,
    generationConfig: {
      temperature: opts.temperature ?? 0.3,
      maxOutputTokens: opts.maxOutputTokens ?? 4096,
    },
    tools: opts.tools.length
      ? [{ functionDeclarations: opts.tools.map(t => ({
          name: t.name,
          description: t.description,
          // FunctionDeclarationSchema uses SchemaType enum for `type`, which differs
          // from the Schema union type. Cast narrowly to satisfy the SDK type.
          parameters: t.parameters as unknown as import("@google/generative-ai").FunctionDeclarationSchema,
        })) }]
      : undefined,
  })

  const history = opts.messages.map(m => ({
    role: m.role === "assistant" ? "model" : m.role === "tool" ? "function" : "user",
    parts: m.role === "tool"
      ? [{ functionResponse: { name: m.toolName ?? "tool", response: { content: m.content } } }]
      : [{ text: m.content }],
  }))

  try {
    // Best-effort cancellation: SDK does not accept AbortSignal, so we poll between chunks.
    const result = await model.generateContentStream({ contents: history })
    for await (const chunk of result.stream) {
      if (opts.signal?.aborted) {
        yield { type: "error", message: "aborted mid-stream", code: "aborted", retryable: false }
        return
      }
      const t = chunk.text()
      if (t) yield { type: "text", delta: t }
    }
    const final = await result.response
    const calls = final.functionCalls?.() ?? []
    for (const call of calls) {
      yield { type: "tool_call", name: call.name, args: call.args as Record<string, unknown> }
    }
  } catch (err) {
    const classified = classifyGeminiError(err)
    yield { type: "error", ...classified }
  }
}
