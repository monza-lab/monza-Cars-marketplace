import { describe, expect, it } from "vitest";

import { decodeMockAuctionsCursor, encodeMockAuctionsCursor } from "./cursor";

describe("mock-auctions cursor encoding", () => {
  it("round-trips opaque cursors that include rarity score", () => {
    const cursor = {
      rarityScore: 88,
      endTime: "2026-04-18T00:00:00.000Z",
      id: "live-123",
    };

    expect(decodeMockAuctionsCursor(encodeMockAuctionsCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursor payloads that omit rarity score", () => {
    const malformed = Buffer.from(
      JSON.stringify({
        endTime: "2026-04-18T00:00:00.000Z",
        id: "live-123",
      }),
      "utf8",
    ).toString("base64");

    expect(decodeMockAuctionsCursor(malformed)).toBeNull();
  });
});
