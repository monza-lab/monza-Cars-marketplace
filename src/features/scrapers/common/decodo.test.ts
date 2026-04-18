import { describe, it, expect } from "vitest";

import { buildDecodoBackconnectUsername } from "./decodo";

describe("buildDecodoBackconnectUsername", () => {
  it("formats a base username for the US backconnect endpoint", () => {
    expect(buildDecodoBackconnectUsername("sp5kh80a3w", "US")).toBe("user-sp5kh80a3w-country-us");
  });

  it("keeps an already formatted username stable", () => {
    expect(buildDecodoBackconnectUsername("user-sp5kh80a3w-country-us", "US")).toBe(
      "user-sp5kh80a3w-country-us"
    );
  });
});
