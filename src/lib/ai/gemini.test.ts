import { describe, it, expect, vi, beforeEach } from "vitest"

// Mock the SDK
const mockGenerateContent = vi.fn()

vi.mock("@google/generative-ai", () => {
  return {
    GoogleGenerativeAI: class {
      getGenerativeModel() {
        return { generateContent: mockGenerateContent }
      }
    },
  }
})

vi.stubEnv("GEMINI_API_KEY", "test-key")
vi.stubEnv("GEMINI_MODEL", "gemini-2.0-flash")

describe("gemini client", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("exports analyzeWithGemini function", async () => {
    const mod = await import("./gemini")
    expect(typeof mod.analyzeWithGemini).toBe("function")
  })

  it("returns text from Gemini response", async () => {
    mockGenerateContent.mockResolvedValueOnce({
      response: { text: () => '{"grade": "AA"}' },
    })

    const { analyzeWithGemini } = await import("./gemini")
    const result = await analyzeWithGemini("system prompt", "user prompt")
    expect(result).toBe('{"grade": "AA"}')
  })

  it("retries once on transient error", async () => {
    vi.useFakeTimers()
    mockGenerateContent
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce({
        response: { text: () => '{"grade": "A"}' },
      })

    const { analyzeWithGemini } = await import("./gemini")
    const promise = analyzeWithGemini("system", "user")
    await vi.advanceTimersByTimeAsync(2000)
    const result = await promise
    expect(result).toBe('{"grade": "A"}')
    expect(mockGenerateContent).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })
})
