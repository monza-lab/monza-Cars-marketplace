import { describe, expect, it } from "vitest";

import {
  ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES,
  isElferspotPriceStatusResolved,
} from "./coverage";

describe("Elferspot price coverage policy", () => {
  it.each([
    "numeric",
    "sold",
    "price_on_request",
    "hidden",
    "not_listed",
  ])("treats %s as source-resolved", (status) => {
    expect(isElferspotPriceStatusResolved(status)).toBe(true);
  });

  it.each([
    undefined,
    null,
    "",
    "unknown",
    "detail_unavailable",
    "blocked_unverified",
  ])("keeps %s retryable", (status) => {
    expect(isElferspotPriceStatusResolved(status)).toBe(false);
  });

  it("exports only legitimate nonnumeric terminal states for database filters", () => {
    expect(ELFERSPOT_RESOLVED_NON_NUMERIC_PRICE_STATUSES).toEqual([
      "sold",
      "price_on_request",
      "hidden",
      "not_listed",
    ]);
  });
});
