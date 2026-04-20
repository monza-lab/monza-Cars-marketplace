import { dataOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/ogFactory";
import { getAirCooled911Index } from "@/lib/index/airCooled911";

export const runtime = "nodejs";
export const alt = "MonzaHaus Air-Cooled 911 Index — Live Market Values";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  const payload = await getAirCooled911Index();
  const s964 = payload.summaries.find((s) => s.series === "964");
  return dataOgImage({
    kicker: "Air-Cooled 911 Index",
    title: "Air-Cooled Porsche 911",
    tagline:
      "993, 964, G-Body, 930, early 911. Quarterly median sale prices across five generations.",
    median: s964?.latestMedian ?? null,
    yoyPct: s964?.yoyChangePct ?? null,
    sampleSize: payload.sampleSize,
    accent: "#d4a017",
  });
}
