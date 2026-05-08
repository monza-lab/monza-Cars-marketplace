import { dataOgImage, OG_SIZE, OG_CONTENT_TYPE } from "@/lib/og/ogFactory";
import { getPorscheModel } from "@/lib/models/registry";
import { getAirCooled911Index } from "@/lib/index/airCooled911";
import { getWaterCooled911Index } from "@/lib/index/waterCooled911";
import type { IndexSummary } from "@/lib/index/factory";

export const runtime = "nodejs";
export const alt = "Porsche 911 — Buyer's Guide & Market Values | MonzaHaus";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

const MODEL_ACCENT: Record<string, string> = {
  "964": "#c0392b",
  "993": "#d4a017",
  "996": "#3b82f6",
  "997": "#8b5cf6",
  "991": "#ec4899",
  "992": "#10b981",
};

interface Props {
  params: { locale: string; model: string };
}

export default async function OG({ params }: Props) {
  const model = getPorscheModel(params.model);
  if (!model) {
    return dataOgImage({
      kicker: "Porsche Buyer's Guide",
      title: "Porsche 911",
      tagline: "Buyer's guides, market values, and investment analysis for every 911 generation.",
    });
  }

  const indexPayload =
    model.indexSlug === "air-cooled-911"
      ? await getAirCooled911Index()
      : await getWaterCooled911Index();

  const summary =
    (indexPayload.summaries as IndexSummary<string>[]).find((s) => s.series === model.slug) ??
    null;

  return dataOgImage({
    kicker: `Porsche ${model.specs.yearRange}`,
    title: model.fullName,
    tagline: model.tagline,
    median: summary?.latestMedian ?? null,
    yoyPct: summary?.yoyChangePct ?? null,
    sampleSize: summary?.sampleSize ?? null,
    accent: MODEL_ACCENT[model.slug] ?? "#E1CCE5",
  });
}
