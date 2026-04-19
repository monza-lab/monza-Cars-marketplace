import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

vi.mock("@/lib/viewPreference", () => ({
  setPreferredView: vi.fn(),
}));

import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  it("renders a visible control for all viewport sizes", () => {
    const markup = renderToStaticMarkup(createElement(ViewToggle));

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("inline-flex");
    expect(markup).not.toContain("md:hidden");
  });
});
