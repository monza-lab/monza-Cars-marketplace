import { describe, expect, it } from "vitest";

import {
  buildSearchCountUrl,
  buildStockPageUrl,
  computeTotalPages,
  extractListingUrlsFromHtml,
  parseListingRowsFromHtml,
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

  it("keeps the BeForward CDN thumbnail from a stock-list row", () => {
    const html = `
      <table>
        <tr class="stocklist-row">
          <td>
            <a class="vehicle-url-link" href="/porsche/911/cd448678/id/15404228/">
              <img
                src="data:image/svg+xml;base64,placeholder"
                data-src="//image-cdn.beforward.jp/medium/202606/15404228/CD448678_1f276203.jpg?w=200"
                alt="2017 PORSCHE 911"
              >
            </a>
            <p class="veh-stock-no">Ref No. CD448678</p>
            <p class="make-model">2017 PORSCHE 911</p>
            <p class="vehicle-price">$48,000</p>
          </td>
          <td class="mileage"><p class="val">44,000 km</p></td>
          <td class="year"><p class="val">2017</p></td>
          <td class="location"><p class="val">Yokohama</p></td>
        </tr>
      </table>
    `;

    expect(parseListingRowsFromHtml(html, 1)).toEqual([
      expect.objectContaining({
        sourceUrl: "https://www.beforward.jp/porsche/911/cd448678/id/15404228/",
        thumbnailUrl: "https://image-cdn.beforward.jp/medium/202606/15404228/CD448678_1f276203.jpg?w=200",
      }),
    ]);
  });
});
