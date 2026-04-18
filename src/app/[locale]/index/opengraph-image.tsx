import { dataOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/ogFactory";

export const runtime = "edge";
export const alt = "MonzaHaus Index — Market Data for Collector Car Investors";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default function OG() {
  return dataOgImage({
    kicker: "MonzaHaus Index",
    title: "Market data for collector car investors.",
    tagline:
      "Quarterly market indices aggregating Bring a Trailer, Cars & Bids, Classic.com, RM Sotheby's. Open data, CC BY 4.0.",
  });
}
