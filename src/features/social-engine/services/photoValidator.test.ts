import { describe, it, expect } from "vitest";
import { filterRealPhotoUrls } from "./photoValidator";

describe("filterRealPhotoUrls", () => {
  it("keeps absolute https URLs", () => {
    const input = [
      "https://prod.pictures.autoscout24.net/listing-images/abc.jpg",
      "https://bringatrailer.com/wp-content/uploads/x.jpeg?fit=940,627",
    ];
    expect(filterRealPhotoUrls(input)).toEqual(input);
  });

  it("drops AS24 placeholder assets", () => {
    const input = [
      "https://prod.pictures.autoscout24.net/real.jpg",
      "/assets/as24-search-funnel/images/360/placeholder360.jpg",
      "/assets/as24-search-funnel/icons/360/three_sixty_icon.svg",
    ];
    expect(filterRealPhotoUrls(input)).toEqual([
      "https://prod.pictures.autoscout24.net/real.jpg",
    ]);
  });

  it("drops SVGs, placeholders, and non-absolute URLs", () => {
    const input = [
      "https://cdn.x.com/icon.svg",
      "https://cdn.x.com/image-placeholder.jpg",
      "/relative/path.jpg",
      "",
      null as unknown as string,
    ];
    expect(filterRealPhotoUrls(input)).toEqual([]);
  });

  it("returns empty array for null input", () => {
    expect(filterRealPhotoUrls(null)).toEqual([]);
    expect(filterRealPhotoUrls(undefined)).toEqual([]);
  });
});
