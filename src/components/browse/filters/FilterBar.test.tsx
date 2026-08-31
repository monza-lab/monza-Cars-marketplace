// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FilterBar } from "./FilterBar";
import { EMPTY_FILTERS, type ClassicFilters } from "./types";

vi.mock("@/lib/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value.toLocaleString()}` }),
}));

function renderFilterBar(filters: ClassicFilters = EMPTY_FILTERS) {
  const onChange = vi.fn();
  const onReset = vi.fn();

  render(
    <FilterBar
      filters={filters}
      matchCount={120}
      totalTracked={500}
      seriesCounts={{}}
      onChange={onChange}
      onReset={onReset}
    />,
  );

  return { onChange, onReset };
}

describe("FilterBar search input", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps typing local and commits the expensive search path after a debounce", async () => {
    const { onChange } = renderFilterBar();
    const input = screen.getByPlaceholderText(/Search/i) as HTMLInputElement;

    fireEvent.change(input, { target: { value: "9" } });
    fireEvent.change(input, { target: { value: "99" } });
    fireEvent.change(input, { target: { value: "997" } });

    expect(input.value).toBe("997");
    expect(onChange).not.toHaveBeenCalled();

    await vi.runOnlyPendingTimersAsync();

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ q: "997" });
  });

  it("retains the complete query and focus after URL-backed state commits", async () => {
    const onChange = vi.fn();
    const onReset = vi.fn();
    const props = {
      matchCount: 120,
      totalTracked: 500,
      seriesCounts: {},
      onChange,
      onReset,
    };
    const { rerender } = render(<FilterBar {...props} filters={EMPTY_FILTERS} />);
    const input = screen.getByPlaceholderText(/Search/i) as HTMLInputElement;
    input.focus();

    fireEvent.change(input, { target: { value: "GT2 RS" } });
    await vi.runOnlyPendingTimersAsync();
    rerender(<FilterBar {...props} filters={{ ...EMPTY_FILTERS, q: "GT2 RS" }} />);

    expect(screen.getByPlaceholderText(/Search/i)).toBe(input);
    expect(input.value).toBe("GT2 RS");
    expect(document.activeElement).toBe(input);
  });

  it("commits immediately on Enter without dropping focus", () => {
    const { onChange } = renderFilterBar();
    const input = screen.getByPlaceholderText(/Search/i) as HTMLInputElement;
    input.focus();

    fireEvent.change(input, { target: { value: "GT2 RS" } });
    fireEvent.keyDown(input, { key: "Enter" });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ q: "GT2 RS" });
    expect(document.activeElement).toBe(input);
  });

  it("labels the inventory count as cars tracked on desktop and mobile", () => {
    renderFilterBar();
    expect(screen.getAllByText(/cars tracked/)).toHaveLength(2);
    expect(screen.getAllByText("500")).toHaveLength(2);
    expect(screen.queryByText(/500 reports/i)).not.toBeInTheDocument();
  });
});
