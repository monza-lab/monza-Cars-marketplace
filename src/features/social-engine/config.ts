import type { SeriesConfig } from "@/lib/brandConfig";

// Source allowlist (ordered by quality — Elferspot best, AS24 baseline)
export const ALLOWED_PLATFORMS = [
  "ELFERSPOT",
  "BRING_A_TRAILER",
  "AUTO_SCOUT_24",
] as const;
export type AllowedPlatform = (typeof ALLOWED_PLATFORMS)[number];

// Gate 1 thresholds
export const GATE_1 = {
  minPhotosCount: 10,
  minDataQualityScore: 70,
  lookbackDays: 7,
  minImageBytes: 40_000, // below this, image is too small/compressed
};

// Gate 2 threshold
export const GATE_2 = {
  visionThreshold: 75,
  gateModel: "gemini-2.0-flash", // stable; falls back with try/catch if not available
  photoSampleSize: 3,
  maxPhotosToRecommend: 4,
};

// Worker batch config
export const WORKER = {
  maxDraftsPerRun: 5,
  maxCandidatesFromGate1: 20,
};

// Collector-grade Porsche series allowlist (subset of brandConfig)
// Used as an explicit positive list beyond brandConfig to avoid Cayenne/Taycan/etc.
// Series IDs that extractSeries() can actually return (no trim variants — those are caught by COLLECTOR_TRIM_REGEX instead).
export const COLLECTOR_SERIES_IDS = [
  "964",
  "993",
  "997",
  "991",
  "992",
  "930",
  "718-cayman-gt4",
  "carrera-gt",
] as const;

// Trim regex for GT/RS/Turbo-S/Speedster — captures variants without needing exact series match
export const COLLECTOR_TRIM_REGEX = /gt3|gt2|\brs\b|turbo s|speedster|carrera gt|singer/i;

// Brand voice excerpt (kept compact; full voice lives in /branding/brand-voice.md)
export const BRAND_VOICE = `
MonzaHaus is an art-gallery salon for collector cars. Tone: authoritative, warm, concise.
Say "collector vehicle" not "old car". "Investment thesis" not "opinion". "Provenance" not
"history". Never use urgency pressure ("buy now!"), emojis, or guaranteed returns language.
Treat vehicles as investment assets with provenance and market position.
`.trim();

// Carousel dimensions
export const CAROUSEL = {
  width: 1080,
  height: 1350,
  slideCount: 5,
  deviceScaleFactor: 2,
};

export function isAllowedPlatform(p: string | null | undefined): p is AllowedPlatform {
  return p != null && (ALLOWED_PLATFORMS as readonly string[]).includes(p);
}
