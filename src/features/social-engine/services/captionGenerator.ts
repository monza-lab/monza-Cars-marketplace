import Anthropic from "@anthropic-ai/sdk";
import { BRAND_VOICE } from "../config";
import type { ListingRow, ComparablesSummary, CaptionOutput } from "../types";

const CLAUDE_MODEL = "claude-sonnet-4-6"; // latest Sonnet as of 2026-04. Update if Anthropic releases newer.

export function buildReportUrl(listing: ListingRow): string {
  const makeSlug = (listing.make ?? "unknown").toLowerCase().replace(/\s+/g, "-");
  return `monzahaus.com/cars/${makeSlug}/${listing.id}/report`;
}

export function buildCaptionPrompt(
  listing: ListingRow,
  comps: ComparablesSummary | null,
  thesis: string,
): string {
  const url = buildReportUrl(listing);
  const compsSection = comps
    ? `Recent comparables: ${comps.sampleSize} sold in last ${comps.windowMonths}mo. Avg $${comps.avg}. Range $${comps.low}-$${comps.high}. This listing at $${comps.thisPrice ?? "?"} is ${comps.deltaPct != null ? (comps.deltaPct > 0 ? "+" : "") + comps.deltaPct + "% vs avg" : "n/a"}.`
    : `No recent comparables available.`;

  return `You are writing an Instagram + Facebook caption for MonzaHaus, a collector-car salon.

BRAND VOICE:
${BRAND_VOICE}

LISTING:
- Title: ${listing.title ?? ""}
- Year / Make / Model / Trim: ${listing.year} ${listing.make} ${listing.model} ${listing.trim ?? ""}
- Engine: ${listing.engine ?? "n/a"}
- Gearbox: ${listing.transmission ?? "n/a"}
- Mileage: ${listing.mileage ?? "n/a"}
- Exterior: ${listing.color_exterior ?? "n/a"}
- Platform: ${listing.platform}
- Asking / current bid: $${listing.current_bid ?? listing.final_price ?? "n/a"}

MARKET CONTEXT:
${compsSection}

INVESTMENT THESIS FOR THIS SERIES:
${thesis}

WRITE A CAPTION:
- 3-4 short lines (max ~60 words total)
- One hook line, one market/thesis insight, one invitation
- MUST end with exactly: "Full report at ${url}"
- No emojis, no hashtags in the caption body, no "link in bio", no urgency words
- Tone: confident, investment-minded, warm, concise

Return ONLY a JSON object, no prose, no code fences:
{
  "caption": "<the caption as a single string with \\n between lines>",
  "hashtags": [<0 to 3 curated lowercase strings without '#'>]
}`;
}

export function parseCaptionResponse(raw: string): CaptionOutput {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("caption: no JSON object found in response");
  const parsed = JSON.parse(match[0]) as Partial<CaptionOutput>;
  if (typeof parsed.caption !== "string") throw new Error("caption: missing caption");
  return {
    caption: parsed.caption,
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags.map(String).slice(0, 3) : [],
  };
}

export async function generateCaption(
  listing: ListingRow,
  comps: ComparablesSummary | null,
  thesis: string,
): Promise<CaptionOutput> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY");

  const client = new Anthropic({ apiKey });
  const resp = await client.messages.create({
    model: CLAUDE_MODEL,
    max_tokens: 600,
    messages: [{ role: "user", content: buildCaptionPrompt(listing, comps, thesis) }],
  });

  const textBlock = resp.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") throw new Error("caption: no text in response");
  return parseCaptionResponse(textBlock.text);
}
