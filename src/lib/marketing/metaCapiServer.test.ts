import { afterEach, expect, it, vi } from "vitest"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  vi.resetModules()
})

it("requires an explicit production confirmation before sending Meta CAPI events", async () => {
  vi.stubEnv("NEXT_PUBLIC_META_PIXEL_ID", "pixel-1")
  vi.stubEnv("META_CAPI_ACCESS_TOKEN", "secret")
  vi.stubEnv("META_CAPI_ENABLED", "false")
  const fetchMock = vi.fn()
  vi.stubGlobal("fetch", fetchMock)

  const { sendServerCapiEvent } = await import("./metaCapiServer")
  await sendServerCapiEvent({ eventName: "Lead", eventId: "lead-1" })

  expect(fetchMock).not.toHaveBeenCalled()
})
