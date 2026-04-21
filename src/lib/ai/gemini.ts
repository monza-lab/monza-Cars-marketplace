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
