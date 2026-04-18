import { describe, expect, it } from "vitest";

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children?: unknown }) => children,
}));

vi.mock("next-intl", () => ({
  useLocale: () => "en-US",
}));

vi.mock("next/image", () => ({
  default: () => null,
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children }: { children?: unknown }) => children,
  },
}));

vi.mock("@/lib/CurrencyContext", () => ({
  useCurrency: () => ({ formatPrice: (value: number) => `$${value}` }),
}));

vi.mock("@/lib/makePageHelpers", () => ({
  timeLeft: () => "",
}));

vi.mock("@/lib/brandConfig", () => ({
  extractSeries: () => "",
  getSeriesConfig: () => null,
  getFamilyGroupsWithSeries: () => [],
}));

import { parseEndTimeMs } from "./BrowseClient";
import { serializeEndTime } from "@/lib/dashboardCache";

describe("browse end-time helpers", () => {
  it("preserves missing end times as empty values", () => {
    expect(serializeEndTime(null)).toBe("");
    expect(serializeEndTime(undefined)).toBe("");
  });

  it("rejects missing or invalid end times in browse sorting", () => {
    expect(parseEndTimeMs("")).toBeNull();
    expect(parseEndTimeMs("not-a-date")).toBeNull();
    expect(parseEndTimeMs("2026-04-18T12:00:00.000Z")).toBe(
      new Date("2026-04-18T12:00:00.000Z").getTime()
    );
  });
});
