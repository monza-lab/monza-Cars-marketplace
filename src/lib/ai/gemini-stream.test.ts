import { describe, it, expect, vi, beforeEach } from "vitest"
import { streamWithTools, type ToolDefinition } from "./gemini"

// Minimal mock of the Gemini SDK surface we use.
const mockGenerateContentStream = vi.fn()
vi.mock("@google/generative-ai", () => ({
  GoogleGenerativeAI: class {
    getGenerativeModel() {
      return { generateContentStream: mockGenerateContentStream }
    }
  },
}))

beforeEach(() => {
  mockGenerateContentStream.mockReset()
  vi.stubEnv("GEMINI_API_KEY", "test-key")
})

describe("streamWithTools", () => {
  it("yields text chunks from a plain streamed response", async () => {
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => "Hello" }
        yield { text: () => " world" }
      })(),
      response: Promise.resolve({ functionCalls: () => [] }),
    })

    const tools: ToolDefinition[] = []
    const events: string[] = []
    for await (const ev of streamWithTools({ model: "gemini-2.5-flash", systemPrompt: "sys", messages: [{ role: "user", content: "hi" }], tools })) {
      if (ev.type === "text") events.push(ev.delta)
    }
    expect(events.join("")).toBe("Hello world")
  })

  it("emits a tool_call event when the model invokes a function", async () => {
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => "" }
      })(),
      response: Promise.resolve({
        functionCalls: () => [{ name: "search_listings", args: { query: "gt3" } }],
      }),
    })

    const tools: ToolDefinition[] = [
      { name: "search_listings", description: "", parameters: { type: "object", properties: {} } },
    ]
    const events: Array<{ type: string; name?: string }> = []
    for await (const ev of streamWithTools({ model: "gemini-2.5-flash", systemPrompt: "sys", messages: [{ role: "user", content: "find gt3" }], tools })) {
      events.push({ type: ev.type, name: ev.type === "tool_call" ? ev.name : undefined })
    }
    expect(events.some(e => e.type === "tool_call" && e.name === "search_listings")).toBe(true)
  })
})
