import { describe, expect, it } from "vitest";

import {
  buildSearchCountUrl,
  buildStockPageUrl,
  computeTotalPages,
  extractListingUrlsFromHtml,
} from "./discover";

describe("beforward_porsche_collector discover", () => {
  it("builds search_count url", () => {
    const url = buildSearchCountUrl(25, "porsche");
    expect(url).toContain("/ajax/search_count/");
    expect(url).toContain("view_cnt=25");
    expect(url).toContain("keyword=porsche");
  });

  it("builds stock page url", () => {
    expect(buildStockPageUrl("porsche", 1)).toContain("/stocklist/sortkey=n/keyword=porsche/kmode=and/");
    expect(buildStockPageUrl("porsche", 2)).toContain("/page=2/");
  });

  it("extracts only Porsche listing URLs", () => {
    const html = `
      <a href="/porsche/macan/cc222184/id/14238711/">one</a>
      <a href="/porsche/911/cc226560/id/14243099/#anchor-vehicle-detail-step2">two</a>
      <a href="/stocklist/sortkey=n/keyword=porsche/kmode=and/">not listing</a>
      <a href="/ferrari/488/xx/id/111/">wrong make</a>
    `;
    const urls = extractListingUrlsFromHtml(html);
    expect(urls).toHaveLength(2);
    expect(urls[0]).toContain("/porsche/");
    expect(urls[1]).not.toContain("#");
  });

  it("computes page count", () => {
    expect(computeTotalPages(3996, 25)).toBe(160);
    expect(computeTotalPages(0, 25)).toBe(0);
  });
});
