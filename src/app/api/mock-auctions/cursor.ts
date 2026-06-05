export type MockAuctionsCursor = {
  rarityScore: number | null;
  endTime: string | null;
  id: string;
};

function isMockAuctionsCursor(value: unknown): value is MockAuctionsCursor {
  if (!value || typeof value !== "object") return false;

  const cursor = value as Record<string, unknown>;
  const rarityScore = cursor.rarityScore;
  const endTime = cursor.endTime;
  const id = cursor.id;

  const hasValidRarityScore =
    rarityScore === null || (typeof rarityScore === "number" && Number.isFinite(rarityScore));
  const hasValidEndTime = endTime === null || typeof endTime === "string";

  return hasValidRarityScore && hasValidEndTime && typeof id === "string";
}

export function decodeMockAuctionsCursor(cursorParam: string | null): MockAuctionsCursor | null {
  if (!cursorParam) return null;

  try {
    const parsed = JSON.parse(Buffer.from(cursorParam, "base64").toString("utf8")) as unknown;
    return isMockAuctionsCursor(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function encodeMockAuctionsCursor(cursor: MockAuctionsCursor | null): string | null {
  return cursor ? Buffer.from(JSON.stringify(cursor), "utf8").toString("base64") : null;
}
