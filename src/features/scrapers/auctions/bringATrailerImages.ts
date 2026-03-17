import * as cheerio from "cheerio";

const DEFAULT_HEADERS: Record<string, string> = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept:
    "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.5",
  Connection: "keep-alive",
};

const REQUEST_TIMEOUT_MS = 15_000;

/**
 * Extract gallery image URLs from BaT HTML.
 * Replicates the image logic from bringATrailer.ts:scrapeDetail (lines 730-770)
 * without all the other field extraction overhead.
 */
export function extractBaTImages(html: string): string[] {
  const $ = cheerio.load(html);
  const images: string[] = [];

  $("img").each((_i, el) => {
    const src = $(el).attr("src") || $(el).attr("data-src") || "";

    const isContentImage =
      src.includes("wp-content/uploads") ||
      src.includes("cdn.bringatrailer.com");
    const isGalleryImage =
      $(el).closest('.gallery, .carousel, [class*="gallery"]').length > 0;

    if (
      (!isContentImage && !isGalleryImage) ||
      !/\.(jpg|jpeg|png|webp)/i.test(src)
    ) {
      return;
    }

    // Skip tiny thumbnails and icons
    if (
      src.includes("resize=235") ||
      src.includes("resize=144") ||
      src.includes("icon")
    ) {
      return;
    }

    // Skip images in related sections
    const $parent = $(el).closest(
      '.related-listings, .recent-listings, .sidebar, .footer, [class*="related"]'
    );
    if ($parent.length > 0) return;

    // Skip small images
    const width = $(el).attr("width");
    if (width && parseInt(width) < 300) return;

    if (!images.includes(src)) {
      images.push(src);
    }
  });

  return images;
}

/**
 * Fetch a BaT listing URL and extract only image URLs.
 */
export async function fetchBaTImages(url: string): Promise<string[]> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: DEFAULT_HEADERS,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} for ${url}`);
    }

    const html = await response.text();
    return extractBaTImages(html);
  } finally {
    clearTimeout(timeoutId);
  }
}
