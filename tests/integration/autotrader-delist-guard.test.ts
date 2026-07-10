import { describe, expect, it } from "vitest";

import {
  classifyAutoTraderListingResponse,
  shouldApplyDelistBatch,
} from "../../scripts/autotrader-delist-check";

describe("classifyAutoTraderListingResponse", () => {
  it("treats the real listing page as live and only the explicit expired redirect as delisted", () => {
    expect(classifyAutoTraderListingResponse(200, null)).toBe("live");
    expect(classifyAutoTraderListingResponse(301, "/search-form?expired-ad=true")).toBe("delisted");
    expect(classifyAutoTraderListingResponse(404, null)).toBe("error");
  });
});

describe("shouldApplyDelistBatch", () => {
  it("blocks a mass delist when every checked active listing appears dead", () => {
    expect(shouldApplyDelistBatch({
      checked: 213,
      live: 0,
      delisted: 213,
      errors: 0,
      sourceActiveBefore: 213,
    })).toEqual({
      apply: false,
      reason: "mass-delist-guard",
    });
  });

  it("allows normal small delist batches", () => {
    expect(shouldApplyDelistBatch({
      checked: 20,
      live: 17,
      delisted: 3,
      errors: 0,
      sourceActiveBefore: 213,
    })).toEqual({
      apply: true,
      reason: "normal",
    });
  });
});
