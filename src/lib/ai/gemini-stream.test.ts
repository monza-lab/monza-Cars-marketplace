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

describe("streamWithTools — error classification", () => {
  it("classifies a rate-limit error as retryable with code=transient", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("429 Too Many Requests"))
    const events: any[] = []
    for await (const ev of streamWithTools({
      model: "gemini-2.5-flash", systemPrompt: "sys",
      messages: [{ role: "user", content: "x" }], tools: [],
    })) events.push(ev)
    const err = events.find(e => e.type === "error")
    expect(err).toMatchObject({ type: "error", code: "transient", retryable: true })
    expect(err.cause).toBeInstanceOf(Error)
  })

  it("classifies an unknown error as non-retryable with code=llm_error", async () => {
    mockGenerateContentStream.mockRejectedValue(new Error("unexpected SDK failure"))
    const events: any[] = []
    for await (const ev of streamWithTools({
      model: "gemini-2.5-flash", systemPrompt: "sys",
      messages: [{ role: "user", content: "x" }], tools: [],
    })) events.push(ev)
    const err = events.find(e => e.type === "error")
    expect(err).toMatchObject({ type: "error", code: "llm_error", retryable: false })
  })

  it("yields missing_api_key error when GEMINI_API_KEY is unset", async () => {
    vi.stubEnv("GEMINI_API_KEY", "")
    const events: any[] = []
    for await (const ev of streamWithTools({
      model: "gemini-2.5-flash", systemPrompt: "sys",
      messages: [{ role: "user", content: "x" }], tools: [],
    })) events.push(ev)
    expect(events[0]).toMatchObject({ type: "error", code: "missing_api_key", retryable: false })
  })
})

describe("streamWithTools — abort signal", () => {
  it("aborts before start if signal already aborted", async () => {
    const ac = new AbortController()
    ac.abort()
    const events: any[] = []
    for await (const ev of streamWithTools({
      model: "gemini-2.5-flash", systemPrompt: "sys",
      messages: [{ role: "user", content: "x" }], tools: [],
      signal: ac.signal,
    })) events.push(ev)
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({ type: "error", code: "aborted", retryable: false })
  })

  it("aborts mid-stream after the next chunk check", async () => {
    const ac = new AbortController()
    mockGenerateContentStream.mockResolvedValue({
      stream: (async function* () {
        yield { text: () => "Hel" }
        ac.abort() // abort after first chunk
        yield { text: () => "should not appear" }
      })(),
      response: Promise.resolve({ functionCalls: () => [] }),
    })
    const events: any[] = []
    for await (const ev of streamWithTools({
      model: "gemini-2.5-flash", systemPrompt: "sys",
      messages: [{ role: "user", content: "x" }], tools: [],
      signal: ac.signal,
    })) events.push(ev)
    const texts = events.filter(e => e.type === "text").map(e => e.delta).join("")
    expect(texts).toBe("Hel")
    expect(events.some(e => e.type === "error" && e.code === "aborted")).toBe(true)
  })
})
