export const RARITY_SCORE_VERSION = "listing-rarity-v8";

export type ListingRaritySignal =
  | "paint_to_sample"
  | "pccb"
  | "bucket_seats"
  | "sunroof_delete"
  | "exclusive_manufaktur"
  | "sonderwunsch"
  | "wls"
  | "wtl"
  | "narrow_body_speedster"
  | "painted_wheels"
  | "club_sport"
  | "racing_history"
  | "accident_free"
  | "original_paint"
  | "low_owner_count"
  | "special_owner"
  | "low_mileage"
  | "matching_numbers"
  | "hypercar"
  | "historic_classic_icon"
  | "homologation_special"
  | "gt_model"
  | "turbo_heritage"
  | "limited_edition"
  | "weissach_package"
  | "classic_significance"
  | "manual_transmission";

export type ListingRarityTier =
  | "unique"
  | "very_rare"
  | "rare"
  | "uncommon"
  | "common";

export type ListingRarityInput = {
  year?: number | null;
  model?: string | null;
  trim?: string | null;
  title?: string | null;
  descriptionText?: string | null;
  sellerNotes?: string | null;
  mileage?: number | string | null;
  mileageUnit?: string | null;
};

type SignalRule = {
  signal: Exclude<ListingRaritySignal, "low_mileage">;
  patterns: RegExp[];
};

const TEXT_SIGNAL_RULES: SignalRule[] = [
  {
    signal: "paint_to_sample",
    patterns: [/\bpaint[\s-]?to[\s-]?sample\b/i, /\bpts\b/i],
  },
  {
    signal: "pccb",
    patterns: [
      /\bpccb\b/i,
      /\bcarbon[\s-]ceramic brakes?\b/i,
      /\bporsche ceramic composite brakes?\b/i,
      /\bcarbon brakes?\b/i,
    ],
  },
  {
    signal: "bucket_seats",
    patterns: [
      /\bbucket seats?\b/i,
      /\bfull bucket seats?\b/i,
      /\blwb seats?\b/i,
    ],
  },
  {
    signal: "sunroof_delete",
    patterns: [
      /\bsunroof[\s-]?delete\b/i,
      /\bno[\s-]?sunroof\b/i,
      /\bnon[\s-]?sunroof\b/i,
      /\bwithout (?:a )?sunroof\b/i,
      /\bslick[\s-]?top\b/i,
    ],
  },
  {
    signal: "exclusive_manufaktur",
    patterns: [
      /\bexclusive manufaktur\b/i,
      /\bporsche exclusive\b/i,
      /\bporsche manufaktur\b/i,
      /\bporsche manufactura\b/i,
    ],
  },
  {
    signal: "sonderwunsch",
    patterns: [/\bsonderwunsch\b/i, /\bspecial wishes?\b/i],
  },
  {
    signal: "wls",
    patterns: [/\bwls(?:\s*[12])?\b/i, /\bwerksleistungssteigerung\b/i],
  },
  {
    signal: "wtl",
    patterns: [
      /\bwtl\b/i,
      /\bwerks[\s-]?turbo[\s-]?(?:look|optik)\b/i,
      /\bfactory[\s-]?turbo[\s-]?look\b/i,
    ],
  },
  {
    signal: "painted_wheels",
    patterns: [/\bpainted wheels?\b/i],
  },
  {
    signal: "club_sport",
    patterns: [/\bclub[\s-]?sport\b/i, /\bclubsport\b/i],
  },
  {
    signal: "racing_history",
    patterns: [
      /\bracing history\b/i,
      /\brace history\b/i,
      /\brace car\b/i,
      /\bcompetition history\b/i,
      /\btrack[\s-]?only\b/i,
      /\btrack car\b/i,
      /\bhomologation\b/i,
    ],
  },
  {
    signal: "accident_free",
    patterns: [/\baccident[\s-]?free\b/i],
  },
  {
    signal: "original_paint",
    patterns: [/\boriginal paint\b/i, /\bfirst paint\b/i],
  },
  {
    signal: "low_owner_count",
    patterns: [
      /\boriginal[\s-]?owner\b/i,
      /\bone[\s-]?owner\b/i,
      /\bsingle owner\b/i,
      /\b1 owner\b/i,
      /\btwo owners\b/i,
      /\b2 owners\b/i,
    ],
  },
  {
    signal: "special_owner",
    patterns: [
      /\bcelebrity owned\b/i,
      /\bfamous owner\b/i,
      /\bfactory executive\b/i,
      /\bworks driver\b/i,
      /\bnotable owner\b/i,
      /\bspecial owner\b/i,
    ],
  },
  {
    signal: "matching_numbers",
    patterns: [/\bmatching numbers\b/i],
  },
];

const MODEL_SIGNAL_RULES: SignalRule[] = [
  {
    signal: "hypercar",
    patterns: [
      /\b959(?:sc)?\b/i,
      /\b918 spyder\b/i,
      /\bcarrera gt\b/i,
    ],
  },
  {
    signal: "homologation_special",
    patterns: [
      /\b911\s*s\/t\b/i,
      /\b911\s*st\b/i,
      /\b911\s*r\b/i,
      /\bspeedster\b/i,
      /\bspyder rs\b/i,
      /\bgt[234]\s*rs\b/i,
      /\bcayman r\b/i,
      /\b914-6\b/i,
      /\brsr\b(?![\s-]?style)/i,
      /\bcarrera rs\b/i,
      /\brs america\b/i,
      /\bturbo s leichtbau\b/i,
    ],
  },
  {
    signal: "gt_model",
    patterns: [
      /\bgt[234]\b/i,
      /\bgt3 touring\b/i,
      /\bcayman gt4\b/i,
    ],
  },
  {
    signal: "turbo_heritage",
    patterns: [
      /\b930\b/i,
      /\b911 turbo\b/i,
      /\bturbo s\b/i,
      /\b944 turbo\b/i,
    ],
  },
  {
    signal: "limited_edition",
    patterns: [
      /\bheritage design\b/i,
      /\banniversary edition\b/i,
      /\bcanepa\b/i,
      /\bcontinental\b/i,
      /\bsport classic\b/i,
      /\bslantnose\b/i,
      /\bflachbau\b/i,
      /\bruf\b/i,
      /\bturbo s leichtbau\b/i,
    ],
  },
  {
    signal: "weissach_package",
    patterns: [/\bweissach\b/i],
  },
  {
    signal: "classic_significance",
    patterns: [
      /\b356[a-z]*\b/i,
      /\bpre-a\b/i,
      /\b914-6\b/i,
      /\b930\b/i,
      /\b964\b/i,
      /\bcarrera rs\b/i,
      /\brs america\b/i,
      /\bslantnose\b/i,
      /\bflachbau\b/i,
      /\b911s\b/i,
      /\bnarrow-body speedster\b/i,
      /\broadster\b/i,
    ],
  },
  {
    signal: "manual_transmission",
    patterns: [/\b[4567][\s-]?speed\b/i, /\bmanual\b/i, /\bg50\b/i],
  },
  {
    signal: "narrow_body_speedster",
    patterns: [
      /\b(?:narrow|slim|lean)[\s-]?body speedster\b/i,
      /\bspeedster\b.*\b(?:narrow|slim|lean)[\s-]?body\b/i,
    ],
  },
];

const SIGNAL_SCORES: Record<ListingRaritySignal, number> = {
  paint_to_sample: 28,
  pccb: 12,
  bucket_seats: 10,
  sunroof_delete: 8,
  exclusive_manufaktur: 6,
  sonderwunsch: 14,
  wls: 16,
  wtl: 14,
  narrow_body_speedster: 10,
  painted_wheels: 5,
  club_sport: 14,
  racing_history: 14,
  accident_free: 8,
  original_paint: 8,
  low_owner_count: 7,
  special_owner: 9,
  low_mileage: 0,
  matching_numbers: 10,
  hypercar: 70,
  historic_classic_icon: 76,
  homologation_special: 36,
  gt_model: 18,
  turbo_heritage: 18,
  limited_edition: 14,
  weissach_package: 14,
  classic_significance: 32,
  manual_transmission: 5,
};

function normalizeText(value: string | number | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

function buildSearchText(input: ListingRarityInput): string {
  return [
    normalizeText(input.title),
    normalizeText(input.model),
    normalizeText(input.trim),
    normalizeText(input.descriptionText),
    normalizeText(input.sellerNotes),
  ]
    .filter(Boolean)
    .join(" ");
}

function buildHeadlineText(input: ListingRarityInput): string {
  return [
    normalizeText(input.title),
    normalizeText(input.model),
    normalizeText(input.trim),
  ]
    .filter(Boolean)
    .join(" ");
}

/**
 * Foundational Porsche archetypes whose historical and cultural importance is
 * stronger than halo status alone. The rule is intentionally narrow: age by
 * itself never qualifies a listing.
 */
export function isHistoricClassicIcon(
  input: Pick<ListingRarityInput, "year" | "title" | "model" | "trim">,
): boolean {
  if (typeof input.year !== "number" || input.year < 1948 || input.year > 1998) return false;

  const fields = [input.title, input.model, input.trim]
    .map((value) => normalizeText(value))
    .filter(Boolean);
  const disqualifier = /\b(replica|tribute|recreation|re-creation|evocation|conversion|backdate|inspiration|inspired|apal)\b|\b(?:rsr|gt2|speedster)[\s-]?look\b/i;
  if (fields.some((field) => disqualifier.test(field))) return false;

  const rules = [
    /\b356\b.*\bspeedster\b|\bspeedster\b.*\b356\b/i,
    /\b(?:911\s*)?carrera\s+rs\b/i,
    /\b(?:964|993)\b.*\b(?:carrera\s+rs|rs\s*3[.,]8|gt2|cup\s*3[.,]8\s*rsr)\b/i,
    /\b964\b.*\bturbo\s+s\s+leichtbau\b/i,
    /\b(?:930|911)\b.{0,30}\bturbo\b.{0,20}\b3[.,]0\b|\bturbo\s+3[.,]0\b/i,
    /\bnarrow[\s-]?body\s+speedster\b/i,
  ];

  if (fields.some((field) => rules.some((pattern) => pattern.test(field)))) return true;
  return input.year <= 1973 && fields.some((field) => /\b911\s*s\b/i.test(field));
}

function addSignalOnce(signals: ListingRaritySignal[], signal: ListingRaritySignal): void {
  if (!signals.includes(signal)) {
    signals.push(signal);
  }
}

function parseNumberText(value: string): number | null {
  const normalized = value.replace(/,/g, "");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function extractMileageMilesFromText(text: string): number | null {
  const kilounit = text.match(/\b(\d+(?:\.\d+)?)\s*k[\s-]?(mile|miles|mi|kilometer|kilometers|km)\b/i);
  if (kilounit) {
    const value = parseNumberText(kilounit[1]);
    if (value === null) return null;
    const raw = value * 1000;
    return /^k/i.test(kilounit[2]) ? raw * 0.621371 : raw;
  }

  const explicit = text.match(/\b(\d{1,3}(?:,\d{3})+|\d+(?:\.\d+)?)\s*[\s-]?(mile|miles|mi|kilometer|kilometers|km)\b/i);
  if (explicit) {
    const value = parseNumberText(explicit[1]);
    if (value === null) return null;
    return /^k/i.test(explicit[2]) ? value * 0.621371 : value;
  }

  return null;
}

function parseMileageMiles(input: ListingRarityInput): number | null {
  const textMileage = extractMileageMilesFromText(buildSearchText(input));
  if (textMileage !== null) {
    return textMileage;
  }

  const value = input.mileage;
  const parsed =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : typeof value === "string"
        ? parseNumberText(value.replace(/[^0-9.,]/g, ""))
        : null;

  if (parsed === null) {
    return null;
  }

  const unit = normalizeText(input.mileageUnit);
  return unit === "km" || unit === "kilometer" || unit === "kilometers"
    ? parsed * 0.621371
    : parsed;
}

function mileageScore(mileageMiles: number | null): number {
  if (mileageMiles === null) return 0;
  if (mileageMiles <= 2500) return 10;
  if (mileageMiles <= 5000) return 8;
  if (mileageMiles <= 10000) return 5;
  return 0;
}

function isAirCooledYear(year: number | null | undefined): boolean {
  return typeof year === "number" && year >= 1948 && year <= 1998;
}

function addAirCooledClassicSignals(
  signals: ListingRaritySignal[],
  input: ListingRarityInput,
  headline: string,
): void {
  if (!isAirCooledYear(input.year)) return;

  const airCooledClassic = /\b(930|964|911\s*turbo|turbo\s*3[.,][036]|turbo\s*3[.,]3|turbo\s*3[.,]6|carrera rs|rs america|rsr\b(?![\s-]?style)|speedster|slantnose|flachbau|turbo s leichtbau)\b/i;
  if (airCooledClassic.test(headline)) {
    addSignalOnce(signals, "classic_significance");
  }

  if (signals.includes("paint_to_sample")) {
    addSignalOnce(signals, "classic_significance");
  }

  const airCooledHomologation = /\b(carrera rs|rs america|rsr\b(?![\s-]?style)|speedster|turbo s leichtbau)\b/i;
  if (airCooledHomologation.test(headline)) {
    addSignalOnce(signals, "homologation_special");
  }
}

export function parseListingRaritySignals(input: ListingRarityInput): ListingRaritySignal[] {
  const haystack = buildSearchText(input);
  const headline = buildHeadlineText(input);
  const signals: ListingRaritySignal[] = [];

  for (const rule of TEXT_SIGNAL_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      addSignalOnce(signals, rule.signal);
    }
  }

  if (mileageScore(parseMileageMiles(input)) > 0) {
    const ownerSignalIndex = signals.indexOf("low_owner_count");
    if (ownerSignalIndex >= 0) {
      signals.splice(ownerSignalIndex + 1, 0, "low_mileage");
    } else {
      addSignalOnce(signals, "low_mileage");
    }
  }

  for (const rule of MODEL_SIGNAL_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(headline))) {
      addSignalOnce(signals, rule.signal);
    }
  }

  if (isHistoricClassicIcon(input)) {
    addSignalOnce(signals, "historic_classic_icon");
  }

  addAirCooledClassicSignals(signals, input, headline);

  return signals;
}

export function rarityTierFromScore(score: number): ListingRarityTier {
  if (score >= 80) return "unique";
  if (score >= 60) return "very_rare";
  if (score >= 40) return "rare";
  if (score >= 20) return "uncommon";
  return "common";
}

export function scoreListingRarity(input: ListingRarityInput): {
  score: number;
  tier: ListingRarityTier;
  signals: ListingRaritySignal[];
} {
  const signals = parseListingRaritySignals(input);
  const headline = buildHeadlineText(input);
  const mileageMiles = parseMileageMiles(input);
  let score = 0;

  for (const signal of signals) {
    score += signal === "low_mileage" ? mileageScore(mileageMiles) : SIGNAL_SCORES[signal];
  }

  const airCooledClassic = isAirCooledYear(input.year) && signals.includes("classic_significance");
  const isSpeedster = /\bspeedster\b/i.test(headline) && !signals.includes("hypercar");
  if (airCooledClassic) {
    score += 20;
    if (signals.includes("homologation_special") && !isSpeedster) score += 14;
    if (signals.includes("turbo_heritage")) score += 8;
    if (signals.includes("paint_to_sample")) score += 16;
  }

  const lateModern = typeof input.year === "number" && input.year >= 2013;
  if (lateModern && !signals.includes("hypercar") && !airCooledClassic) {
    if (signals.includes("gt_model")) {
      const modernGtCap = signals.includes("paint_to_sample")
        ? 96
        : signals.includes("weissach_package")
          ? 92
          : 88;
      score = Math.min(score, modernGtCap);
    } else if (signals.includes("homologation_special")) {
      const modernHomologationCap = signals.includes("paint_to_sample")
        ? 96
        : signals.includes("weissach_package")
          ? 92
          : 88;
      score = Math.min(score, modernHomologationCap);
    }
  }

  if (isSpeedster) {
    score = Math.max(score, 88);
  }

  const boundedScore = Math.max(0, Math.min(score, 100));
  return {
    score: boundedScore,
    tier: rarityTierFromScore(boundedScore),
    signals,
  };
}
