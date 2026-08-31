// @vitest-environment jsdom
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { ReportEmailSheet } from "./ReportEmailSheet"

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a>,
}))

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
    fireEvent.click(screen.getByRole("button", { name: /get my report/i }))

    await waitFor(() => expect(onGenerated).toHaveBeenCalledWith("report-token"))
    expect(fetch).toHaveBeenNthCalledWith(2, "/api/analyze/v3", expect.objectContaining({
      headers: expect.objectContaining({ "x-report-access-token": "report-token" }),
    }))
    const accessPayload = JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)
    expect(accessPayload).not.toHaveProperty("attribution")
  })

  it("sells the report, explains privacy, and renders live generation progress", async () => {
    let finishStream!: () => void
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode(
          'event: progress\ndata: {"stepId":1,"sectionKey":"listing_scrape","label":"Listing verified","status":"completed","completionNote":"Source captured"}\n\n',
        ))
        finishStream = () => {
          controller.enqueue(new TextEncoder().encode(
            'event: complete\ndata: {"report":{"stepsCompleted":10,"stepsFailed":0}}\n\n',
          ))
          controller.close()
        }
      },
    })
    vi.stubGlobal("fetch", vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ ok: true, token: "report-token" }), { status: 200 }))
      .mockResolvedValueOnce(new Response(stream, { status: 200, headers: { "content-type": "text/event-stream" } })))

    render(<ReportEmailSheet
      open
      listingId="live-1"
      carTitle="1992 Porsche 964 Carrera RS"
      carImages={[]}
      series="964"
      listingType="classified"
      onOpenChange={() => {}}
      onGenerated={() => {}}
    />)

    expect(screen.getByRole("heading", { name: "Your first Haus Report is free." })).toBeVisible()
    expect(screen.getByText(/No password\. No card\. Two more reports free/i)).toBeVisible()
    expect(screen.getByRole("link", { name: /Privacy Policy/i })).toHaveAttribute("href", "/legal/privacy")

    fireEvent.change(screen.getByRole("textbox", { name: /email/i }), { target: { value: "buyer@example.com" } })
    fireEvent.click(screen.getByRole("button", { name: /get my report/i }))

    expect(await screen.findByText("Building your report — about 90 seconds")).toBeVisible()
    expect(await screen.findByText("Listing verified")).toBeVisible()
    expect(screen.getByText(/buyer@example\.com/)).toBeVisible()
    await act(async () => finishStream())
  })
})
