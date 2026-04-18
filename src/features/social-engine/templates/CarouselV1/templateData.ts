import type { ListingRow, ComparablesSummary } from "../../types";

export interface SlideData {
  listing: ListingRow;
  comps: ComparablesSummary | null;
  thesis: string;
  photoUrls: string[]; // already filtered to real URLs
  selectedIndices: number[];
}

export function pickPhoto(data: SlideData, slotIdx: number): string {
  const idx = data.selectedIndices[slotIdx] ?? slotIdx;
  return data.photoUrls[idx] ?? data.photoUrls[0] ?? "";
}
