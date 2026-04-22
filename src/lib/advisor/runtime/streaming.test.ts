import { describe, it, expect } from "vitest"
import { encodeSseEvent, parseSseLine } from "./streaming"

describe("advisor sse codec", () => {
  it("round-trips a content_delta event", () => {
    const encoded = encodeSseEvent({ type: "content_delta", delta: "hello" })
    const dataLine = encoded.split("\n").find(l => l.startsWith("data: "))!
    const parsed = parseSseLine(dataLine)
    expect(parsed).toEqual({ type: "content_delta", delta: "hello" })
  })
})
