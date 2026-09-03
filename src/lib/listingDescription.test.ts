import { describe, expect, it } from "vitest";

import {
  extractSellerDescription,
  hasScrapedChrome,
  sanitizeListingDescription,
} from "./listingDescription";

// Shape of what the Classic.com scraper stored as `description`: the whole page
// as innerText, competitor navigation and pricing table included.
const CLASSIC_PAGE_DUMP = `search person close
Find
Search Listings 1,081,830
Browse Auctions 1,399
Browse Dealers 2,115
2011 Porsche 911 GT3 RS 4.0
FOR SALE
by
Private Seller
$1,400,000
Contact Seller
Specs
Year
2011
Make
Porsche
Become a CLASSIC Insider
$99 / month $49 / month
Upgrade Now
AI-generated insights based on CLASSIC.COM market data. Note: AI can make mistakes.
All rights reserved, © 2026 CLASSIC.COM Inc`;

const LABELLED_PAGE_DUMP = `Browse Auctions 1,399
2011 Porsche 911 GT3 RS 4.0
Seller's Description
One of 600 built, finished in Paint to Sample Riviera Blue over black leather.
Two owners from new, 1,130 miles, complete service history and both tool kits.
Specs
Year
2011
Become a CLASSIC Insider
$99 / month
Upgrade Now`;

describe("scraped listing descriptions", () => {
  it("recognizes a source page dump from a single strong marker", () => {
    expect(hasScrapedChrome(CLASSIC_PAGE_DUMP)).toBe(true);
    expect(hasScrapedChrome("Become a CLASSIC Insider")).toBe(true);
    expect(hasScrapedChrome("Note: AI can make mistakes")).toBe(true);
    expect(hasScrapedChrome("$99 / month")).toBe(true);
  });

  it("leaves genuine seller copy alone, including a lone weak phrase", () => {
    const genuine =
      "Matching-numbers 993 Carrera, two owners from new, full service history. Contact seller for the complete file.";

    expect(hasScrapedChrome(genuine)).toBe(false);
    expect(sanitizeListingDescription(genuine)).toBe(genuine);
    expect(hasScrapedChrome(null)).toBe(false);
    expect(hasScrapedChrome("")).toBe(false);
  });

  it("salvages the seller's own block when the dump labels it", () => {
    const salvaged = extractSellerDescription(LABELLED_PAGE_DUMP);

    expect(salvaged).toContain("One of 600 built");
    expect(salvaged).toContain("both tool kits");
    expect(salvaged).not.toMatch(/CLASSIC Insider|Upgrade Now|Browse Auctions|Specs/i);
    expect(sanitizeListingDescription(LABELLED_PAGE_DUMP)).toBe(salvaged);
  });

  it("drops the field entirely when nothing of the seller survives", () => {
    expect(extractSellerDescription(CLASSIC_PAGE_DUMP)).toBeNull();
    expect(sanitizeListingDescription(CLASSIC_PAGE_DUMP)).toBeNull();
    expect(sanitizeListingDescription(null)).toBeNull();
    expect(sanitizeListingDescription("   ")).toBeNull();
  });

  it("never publishes the competitor's copy that the anti-AI guard cannot see", () => {
    const published = sanitizeListingDescription(CLASSIC_PAGE_DUMP) ?? "";

    expect(published).not.toMatch(/AI can make mistakes/i);
    expect(published).not.toMatch(/CLASSIC\.COM/i);
    expect(published).not.toMatch(/Upgrade Now/i);
  });
});
