import { GoogleGenerativeAI } from "@google/generative-ai";
import { GATE_2 } from "../config";
import type { VisionScore } from "../types";

export function buildVisionPrompt(photoCount: number): string {
  return `You are evaluating ${photoCount} photos of a collector vehicle for editorial social-media use on a premium brand (think salon/art gallery, not marketplace).

Score the set as a whole on a 0-100 scale considering:
- framing and composition (centered, rule of thirds, varied angles)
- lighting quality (professional lighting vs. harsh/flash/dim)
- setting/background (studio, premium location, driveway vs. cluttered parking lot, people in shot)
- vehicle completeness (full body shots + detail shots; not only interior)
- absence of watermarks, text overlays, dealership banners, visual clutter

Return ONLY a JSON object, no prose, no code fences:
{
  "score": <int 0-100>,
  "reasons": [<2-4 short strings explaining the score>],
  "best_photo_index": <int index 0..${photoCount - 1}>,
  "recommended_indices": [<array of up to 4 indices in order of preference, each 0..${photoCount - 1}>]
}`;
}

export function parseVisionResponse(raw: string, photoCount: number): VisionScore {
  const cleaned = raw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("vision: no JSON object found in response");
  const parsed = JSON.parse(match[0]) as Partial<VisionScore>;

  if (typeof parsed.score !== "number") throw new Error("vision: missing score");
  const clamp = (i: number) => Math.max(0, Math.min(photoCount - 1, Math.floor(i)));
  return {
    score: Math.max(0, Math.min(100, parsed.score)),
    reasons: Array.isArray(parsed.reasons) ? parsed.reasons.map(String) : [],
    best_photo_index: clamp(parsed.best_photo_index ?? 0),
    recommended_indices: Array.isArray(parsed.recommended_indices)
      ? Array.from(new Set(parsed.recommended_indices.map(Number).map(clamp)))
      : [0],
  };
}

async function fetchImageAsBase64(url: string): Promise<{ data: string; mimeType: string }> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Failed to fetch image: ${url}`);
  const buf = Buffer.from(await r.arrayBuffer());
  const mimeType = r.headers.get("content-type") ?? "image/jpeg";
  return { data: buf.toString("base64"), mimeType };
}

export async function scorePhotos(photoUrls: string[]): Promise<VisionScore> {
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY ?? process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GOOGLE_GENERATIVE_AI_API_KEY (or GEMINI_API_KEY)");

  const sample = photoUrls.slice(0, GATE_2.photoSampleSize);
  const images = await Promise.all(sample.map(fetchImageAsBase64));

  const ai = new GoogleGenerativeAI(apiKey);
  const model = ai.getGenerativeModel({ model: GATE_2.gateModel });
  const prompt = buildVisionPrompt(sample.length);

  const result = await model.generateContent([
    prompt,
    ...images.map((img) => ({
      inlineData: { data: img.data, mimeType: img.mimeType },
    })),
  ]);
  const text = result.response.text();
  return parseVisionResponse(text, photoUrls.length);
}
