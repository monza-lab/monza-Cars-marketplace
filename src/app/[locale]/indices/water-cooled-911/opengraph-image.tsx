import { dataOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/ogFactory";
import { getWaterCooled911Index } from "@/lib/index/waterCooled911";

export const runtime = "nodejs";
export const alt = "MonzaHaus Water-Cooled 911 Index — Live Market Values";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  const payload = await getWaterCooled911Index();
  const s997 = payload.summaries.find((s) => s.series === "997");
  return dataOgImage({
    kicker: "Water-Cooled 911 Index",
    title: "Water-Cooled Porsche 911",
    tagline:
      "996, 997, 991, 992. Market data for the modern 911 — from IMS to 9,000rpm GT3.",
    median: s997?.latestMedian ?? null,
    yoyPct: s997?.yoyChangePct ?? null,
    sampleSize: payload.sampleSize,
    accent: "#8b5cf6",
  });
}
