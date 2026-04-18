import { dataOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/ogFactory";
import { getPorscheTurboIndex } from "@/lib/index/porscheTurbo";

export const runtime = "nodejs";
export const alt = "MonzaHaus Porsche Turbo Index — 50 Years of 911 Turbo";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

export default async function OG() {
  const payload = await getPorscheTurboIndex();
  const latest = payload.summaries
    .filter((s) => s.latestMedian != null)
    .sort((a, b) => (b.sampleSize ?? 0) - (a.sampleSize ?? 0))[0];
  return dataOgImage({
    kicker: "Porsche Turbo Index",
    title: "50 Years of 911 Turbo",
    tagline:
      "930 through 992 Turbo S. Cross-generational market values for the longest-running Porsche model line.",
    median: latest?.latestMedian ?? null,
    yoyPct: latest?.yoyChangePct ?? null,
    sampleSize: payload.sampleSize,
    accent: "#b45309",
  });
}
