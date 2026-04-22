// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { render, screen, act } from "@testing-library/react"
import { renderHook } from "@testing-library/react"
import { NextIntlClientProvider } from "next-intl"
import { AdvisorConversation } from "./AdvisorConversation"
import { useAdvisorStream } from "./useAdvisorStream"
import { encodeSseEvent, type AdvisorSseEvent } from "@/lib/advisor/runtime/streaming"
import enMessages from "../../../messages/en.json"

function renderWithIntl(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={enMessages as any}>
      {ui}
    </NextIntlClientProvider>
  )
}

function makeSseStream(events: AdvisorSseEvent[], conversationId = "conv-test-1") {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const ev of events) {
        controller.enqueue(encoder.encode(encodeSseEvent(ev)))
      }
      controller.close()
    },
  })
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/event-stream", "X-Conversation-Id": conversationId },
  })
}

describe("AdvisorConversation", () => {
  it("renders suggestion chips when no messages and no initialMessages", () => {
    renderWithIntl(
      <AdvisorConversation
        conversationId={null}
        surface="page"
        locale="en"
        userTier="FREE"
        suggestionChips={[{ label: "Compare GT3s", prompt: "Compare top 3 GT3s" }]}
      />
    )
    expect(screen.getByText("Compare GT3s")).toBeInTheDocument()
  })

  it("shows input placeholder from i18n", () => {
    renderWithIntl(
      <AdvisorConversation
        conversationId={null}
        surface="page"
        locale="en"
        userTier="FREE"
      />
    )
    // matches the "Ask anything…" placeholder we added
    expect(screen.getByPlaceholderText(/Ask anything/i)).toBeInTheDocument()
  })

  it("seeds initialMessages into the message list", () => {
    renderWithIntl(
      <AdvisorConversation
        conversationId="c1"
        surface="page"
        locale="en"
        userTier="FREE"
        initialMessages={[
          { id: "m1", role: "user", content: "Hello" },
          { id: "m2", role: "assistant", content: "Hi, how can I help?" },
        ]}
      />
    )
    expect(screen.getByText("Hello")).toBeInTheDocument()
    expect(screen.getByText(/how can I help/)).toBeInTheDocument()
  })

  it("hides the input footer when readOnly is true", () => {
    renderWithIntl(
      <AdvisorConversation
        conversationId="c1"
        surface="page"
        locale="en"
        userTier="FREE"
        readOnly
      />
    )
    expect(screen.queryByPlaceholderText(/Ask anything/i)).not.toBeInTheDocument()
  })
})

describe("useAdvisorStream SSE parsing", () => {
  const originalFetch = globalThis.fetch
  beforeEach(() => {
    vi.restoreAllMocks()
  })
  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it("applies classified / content_delta / done events to the assistant message", async () => {
    const events: AdvisorSseEvent[] = [
      { type: "classified", tier: "instant", estimatedPistons: 1, downgraded: false },
      { type: "content_delta", delta: "Hello" },
      { type: "content_delta", delta: " world" },
      { type: "done", pistonsDebited: 1, messageId: "msg-final-xyz" },
    ]
    const fetchMock = vi.fn().mockResolvedValue(makeSseStream(events))
    globalThis.fetch = fetchMock as any

    const onIdChanged = vi.fn()
    const { result } = renderHook(() =>
      useAdvisorStream({ conversationId: null, onConversationIdChanged: onIdChanged })
    )

    await act(async () => {
      await result.current.send("ping", { surface: "page", locale: "en" })
    })

    expect(fetchMock).toHaveBeenCalledOnce()
    expect(onIdChanged).toHaveBeenCalledWith("conv-test-1")

    const assistant = result.current.messages.find(m => m.role === "assistant")
    expect(assistant).toBeDefined()
    expect(assistant?.tier).toBe("instant")
    expect(assistant?.content).toBe("Hello world")
    expect(assistant?.pistonsDebited).toBe(1)
    expect(assistant?.id).toBe("msg-final-xyz")
    expect(assistant?.isStreaming).toBe(false)
    expect(result.current.isStreaming).toBe(false)
  })

  it("captures tool_call_start and tool_call_end into toolCalls array", async () => {
    const events: AdvisorSseEvent[] = [
      { type: "classified", tier: "marketplace", estimatedPistons: 5, downgraded: false },
      { type: "tool_call_start", name: "search_listings", args: { q: "997 GT3" } },
      { type: "tool_call_end", name: "search_listings", summary: "12 matches", ok: true },
      { type: "content_delta", delta: "Found them." },
      { type: "done", pistonsDebited: 5, messageId: "msg-2" },
    ]
    globalThis.fetch = vi.fn().mockResolvedValue(makeSseStream(events)) as any

    const { result } = renderHook(() =>
      useAdvisorStream({ conversationId: "c-existing" })
    )

    await act(async () => {
      await result.current.send("search 997 GT3", { surface: "chat", locale: "en" })
    })

    const assistant = result.current.messages.find(m => m.role === "assistant")
    expect(assistant?.toolCalls).toHaveLength(1)
    expect(assistant?.toolCalls?.[0].name).toBe("search_listings")
    expect(assistant?.toolCalls?.[0].summary).toBe("12 matches")
    expect(assistant?.toolCalls?.[0].ok).toBe(true)
    expect(assistant?.content).toBe("Found them.")
  })
})
