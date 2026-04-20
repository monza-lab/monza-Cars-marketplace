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

import proxy from "./proxy";

describe("proxy locale normalization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects duplicate locale segments to the canonical locale path", async () => {
    const request = new NextRequest("http://localhost:3000/de/de/browse?series=991");

    const response = await proxy(request);

    expect(response.status).toBe(308);
    expect(response.headers.get("location")).toBe("http://localhost:3000/de/browse?series=991");
    expect(handleI18nRouting).not.toHaveBeenCalled();
    expect(updateSession).not.toHaveBeenCalled();
  });
});
