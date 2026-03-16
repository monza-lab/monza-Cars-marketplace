import { describe, expect, it } from "vitest";

import { extractPhotoUrls } from "./collector";

describe("porsche_collector image extraction", () => {
  it("extracts images from images array", () => {
    const result = extractPhotoUrls({
      images: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.webp"],
    });
    expect(result).toEqual(["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.webp"]);
  });

  it("falls back to imageUrl and thumbnail when images array missing", () => {
    const result = extractPhotoUrls({
      imageUrl: "https://cdn.example.com/primary.jpg",
      thumbnail_url: "https://cdn.example.com/thumb.jpg",
    });
    expect(result).toEqual(["https://cdn.example.com/primary.jpg", "https://cdn.example.com/thumb.jpg"]);
  });

  it("deduplicates and ignores invalid urls", () => {
    const result = extractPhotoUrls({
      images: ["https://cdn.example.com/a.jpg", "https://cdn.example.com/a.jpg", "", null],
      imageUrl: "https://cdn.example.com/a.jpg",
      image: "not-a-url",
    });
    expect(result).toEqual(["https://cdn.example.com/a.jpg"]);
  });
});
