// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { NoMarketplaceBanner } from "./NoMarketplaceBanner";

describe("NoMarketplaceBanner", () => {
  it("uses a single compact message on mobile and keeps the explanation on larger screens", () => {
    render(<NoMarketplaceBanner />);
    expect(screen.getByText("Independent intelligence. Listings stay on their original marketplace.")).toHaveClass("md:hidden");
    expect(screen.getByText(/Every car here is listed on Bring a Trailer/)).toHaveClass("hidden", "md:inline");
  });
});
