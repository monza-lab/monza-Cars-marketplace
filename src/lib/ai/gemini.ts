// ---------------------------------------------------------------------------
// Gemini API Client — for investment report analysis
// ---------------------------------------------------------------------------

import { GoogleGenerativeAI } from "@google/generative-ai"

const DEFAULT_MODEL = "gemini-2.0-flash"

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
