import { describe, it, expect } from "vitest";
import { extractBaTImages } from "./bringATrailerImages";

describe("extractBaTImages", () => {
  it("extracts gallery images from BaT HTML", () => {
    const html = `
      <html><body>
        <div class="gallery">
          <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg" width="620" />
          <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo2.jpg" width="620" />
        </div>
        <div class="related-listings">
          <img src="https://bringatrailer.com/wp-content/uploads/2024/01/unrelated.jpg" width="620" />
        </div>
        <img src="/wp-includes/icon.png" width="16" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toEqual([
      "https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg",
      "https://bringatrailer.com/wp-content/uploads/2024/01/photo2.jpg",
    ]);
  });

  it("extracts content images with CDN URLs", () => {
    const html = `
      <html><body>
        <img src="https://cdn.bringatrailer.com/uploads/photo1.jpg" width="800" />
        <img src="https://cdn.bringatrailer.com/uploads/photo2.jpg" width="800" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toHaveLength(2);
  });

  it("filters out small thumbnails and icons", () => {
    const html = `
      <html><body>
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/big.jpg" width="620" />
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/thumb.jpg?resize=235" width="235" />
        <img src="https://bringatrailer.com/wp-content/uploads/icon.jpg" width="50" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toEqual([
      "https://bringatrailer.com/wp-content/uploads/2024/01/big.jpg",
    ]);
  });

  it("deduplicates URLs", () => {
    const html = `
      <html><body>
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg" width="620" />
        <img src="https://bringatrailer.com/wp-content/uploads/2024/01/photo1.jpg" width="620" />
      </body></html>
    `;
    const images = extractBaTImages(html);
    expect(images).toHaveLength(1);
  });

  it("returns empty array for pages with no gallery images", () => {
    const html = `<html><body><p>No images here</p></body></html>`;
    const images = extractBaTImages(html);
    expect(images).toEqual([]);
  });
});
