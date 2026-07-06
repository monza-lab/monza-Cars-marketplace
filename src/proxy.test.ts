import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";

const { handleI18nRouting, updateSession } = vi.hoisted(() => ({
  handleI18nRouting: vi.fn(() => NextResponse.next()),
  updateSession: vi.fn(),
}));

vi.mock("next-intl/middleware", () => ({
  default: () => handleI18nRouting,
}));

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession,
}));

import proxy from "./middleware";

describe("proxy locale normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects duplicate hidden locale segments to the canonical locale-free path", async () => {
    const request = new NextRequest("http://localhost:3000/de/de/browse?series=991");

    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost:3000/browse?series=991");
    expect(handleI18nRouting).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("allows the internal default locale route to pass through", async () => {
    const request = new NextRequest("http://localhost:3000/en/get-started?utm_campaign=audit");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBeNull();
    expect(handleI18nRouting).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });

  it("rewrites locale-free pages into the internal English route without redirecting", async () => {
    const request = new NextRequest("http://localhost:3000/get-started?utm_campaign=audit");

    const response = await proxy(request);

    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/en/get-started?utm_campaign=audit");
    expect(handleI18nRouting).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });
});
