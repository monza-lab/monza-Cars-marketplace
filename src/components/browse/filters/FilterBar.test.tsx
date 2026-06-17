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
});
