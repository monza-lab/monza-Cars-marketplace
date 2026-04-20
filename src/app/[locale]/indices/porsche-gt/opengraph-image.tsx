import { dataOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/ogFactory";
import { getPorscheGtIndex } from "@/lib/index/porscheGt";

export const runtime = "nodejs";
export const alt = "MonzaHaus Porsche GT Index — GT3, GT3 RS, GT2 RS, GT4";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  const payload = await getPorscheGtIndex();
  const dominant = payload.summaries
    .filter((s) => s.latestMedian != null)
    .sort((a, b) => (b.sampleSize ?? 0) - (a.sampleSize ?? 0))[0];
  return dataOgImage({
    kicker: "Porsche GT Index",
    title: "Track-bred Porsche",
    tagline:
      "GT2, GT3, GT3 RS, GT4 and the air-cooled RS progenitors — the cars Porsche built to win races.",
    median: dominant?.latestMedian ?? null,
    yoyPct: dominant?.yoyChangePct ?? null,
    sampleSize: payload.sampleSize,
    accent: "#be185d",
  });
}
