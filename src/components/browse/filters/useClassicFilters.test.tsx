// @vitest-environment jsdom
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useClassicFilters } from "./useClassicFilters";

const replace = vi.fn();

let pathname = "/browse";
let search = "";

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace }),
  usePathname: () => pathname,
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => ({
    toString: () => search,
  }),
  usePathname: () => "/de/browse",
}));

function Harness({
  onReady,
}: {
  onReady: (api: ReturnType<typeof useClassicFilters>) => void;
}) {
  const api = useClassicFilters();

  useEffect(() => {
    onReady(api);
  }, [api, onReady]);

  return null;
}

describe("useClassicFilters", () => {
  beforeEach(() => {
    pathname = "/browse";
    search = "";
    replace.mockReset();
  });

  it("keeps the canonical locale-free pathname when updating filters", () => {
    let api: ReturnType<typeof useClassicFilters> | null = null;

    render(<Harness onReady={(value) => (api = value)} />);

    act(() => {
      api?.setFilters({ q: "991" });
    });

    expect(replace).toHaveBeenCalledWith("/browse?q=991", { scroll: false });
  });
});
