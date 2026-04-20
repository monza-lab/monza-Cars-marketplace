// @vitest-environment jsdom
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { push, setPreferredView } = vi.hoisted(() => ({
  push: vi.fn(),
  setPreferredView: vi.fn(),
}));

let pathname = "/";

vi.mock("next-intl", () => ({
  useLocale: () => "en",
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push }),
  usePathname: () => pathname,
}));

vi.mock("@/lib/viewPreference", () => ({
  setPreferredView,
}));

import { ViewToggle } from "./ViewToggle";

describe("ViewToggle", () => {
  beforeEach(() => {
    pathname = "/";
    push.mockReset();
    setPreferredView.mockReset();
  });

  it("renders a visible control for all viewport sizes", () => {
    const markup = renderToStaticMarkup(createElement(ViewToggle));

    expect(markup).toContain('role="tablist"');
    expect(markup).toContain("inline-flex");
    expect(markup).not.toContain("md:hidden");
  });

  it("returns to the dashboard home when Monza is clicked from the seo index route", () => {
    pathname = "/index";

    render(createElement(ViewToggle));

    fireEvent.click(screen.getByRole("tab", { name: "Monza" }));

    expect(setPreferredView).toHaveBeenCalledWith("monza");
    expect(push).toHaveBeenCalledWith("/");
  });

  it("does not navigate when Monza is clicked from the dashboard home", () => {
    render(createElement(ViewToggle));

    fireEvent.click(screen.getByRole("tab", { name: "Monza" }));

    expect(setPreferredView).not.toHaveBeenCalled();
    expect(push).not.toHaveBeenCalled();
  });
});
