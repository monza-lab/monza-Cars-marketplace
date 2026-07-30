// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReportEmailSheet } from "./ReportEmailSheet"

describe("ReportEmailSheet", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it("asks only for email and completes generation in the current flow", async () => {
    const onGenerated = vi.fn()
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, token: "report-token", leadId: "lead-1" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(
        'event: progress\ndata: {"sectionKey":"listing_scrape","status":"completed"}\n\n'
        + 'event: complete\ndata: {"report":{"listingId":"live-1","reportVersion":3,"stepsCompleted":10,"stepsFailed":0}}\n\n',
        { status: 200, headers: { "content-type": "text/event-stream" } },
      ))
    vi.stubGlobal("fetch", fetchMock)
    render(<ReportEmailSheet open listingId="live-1" onOpenChange={() => {}} onGenerated={onGenerated} />)

    expect(screen.getByRole("textbox", { name: /email/i })).toBeVisible()
    expect(screen.queryByLabelText(/password/i)).toBeNull()
    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), { target: { value: "buyer@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /generate haus report/i }))

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith("report-token"))
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/analyze/v3", expect.objectContaining({
      headers: expect.objectContaining({ "x-report-access-token": "report-token" }),
    }))
    const accessPayload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(accessPayload).not.toHaveProperty("attribution")
  })
})
