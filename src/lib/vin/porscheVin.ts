/**
 * Porsche VIN decoder — 17-character modern VINs (1981+).
 * Pre-1981 Porsches used shorter chassis numbers (e.g. "911 730 XXXX") and
 * are not covered by this decoder.
 */

const WMI_MAP: Record<string, string> = {
  WP0: "Porsche AG (Stuttgart) — 911, Boxster, Cayman, 928, 944, 968",
  WP1: "Porsche AG — Cayenne, Macan, Taycan, Panamera (SUV/sedan range)",
};

// Model year (position 10)
const MODEL_YEAR_MAP: Record<string, number> = {
  B: 1981, C: 1982, D: 1983, E: 1984, F: 1985, G: 1986, H: 1987, J: 1988,
  K: 1989, L: 1990, M: 1991, N: 1992, P: 1993, R: 1994, S: 1995, T: 1996,
  V: 1997, W: 1998, X: 1999, Y: 2000,
  "1": 2001, "2": 2002, "3": 2003, "4": 2004, "5": 2005,
  "6": 2006, "7": 2007, "8": 2008, "9": 2009,
  A: 2010, // Year codes repeat after 30-year cycle
};

// Note: A=1980 OR 2010 — context needed. After 2010 Porsche uses A/B/C again.
// We default to modern era (2010+) but flag ambiguity if decoded year < 1990.
const MODEL_YEAR_MAP_POST_2010: Record<string, number> = {
  A: 2010, B: 2011, C: 2012, D: 2013, E: 2014, F: 2015, G: 2016, H: 2017,
  J: 2018, K: 2019, L: 2020, M: 2021, N: 2022, P: 2023, R: 2024, S: 2025,
  T: 2026,
};

// Plant codes (position 11)
const PLANT_MAP: Record<string, string> = {
  S: "Stuttgart-Zuffenhausen (911, Boxster, Cayman)",
  L: "Leipzig (Cayenne, Panamera, Macan)",
  U: "Uusikaupunki, Finland (986 Boxster, 987 Cayman early — Valmet contract)",
  K: "Karmann, Osnabrück (944/968 limited production)",
  N: "Neckarsulm (Audi plant — select joint projects)",
};

// Pos 4-6 body/family hints (partial — covers the 911 lineage primarily)
const BODY_HINTS: { pattern: RegExp; hint: string }[] = [
  { pattern: /^WP0ZZZ99/, hint: "992-generation 911 (2019+)" },
  { pattern: /^WP0ZZZ99[1-9]/, hint: "991-generation 911 (2012–2019) — cross-check model year" },
  { pattern: /^WP0ZZZ99/, hint: "991 or 992 generation — cross-check model year" },
  { pattern: /^WP0ZZZ98/, hint: "997-generation 911 (2005–2012)" },
  { pattern: /^WP0ZZZ99/, hint: "991-generation 911 (2012–2019)" },
  { pattern: /^WP0ZA[A-Z]99/, hint: "991/992 US-market 911" },
  { pattern: /^WP0AA/, hint: "996/997 US-market 911 (cross-check year)" },
  { pattern: /^WP0ZZZ99ZZS/, hint: "993-generation 911 (1995–1998) — last air-cooled" },
  { pattern: /^WP0ZZZ96/, hint: "964-generation 911 (1989–1994)" },
  { pattern: /^WP0ZZZ93/, hint: "930 Turbo or late G-body 911" },
  { pattern: /^WP0ZZZ98/, hint: "986 Boxster (1997–2004) or 987 (2005–2012) — cross-check year" },
  { pattern: /^WP0CA/, hint: "Cayman 987/981/982 US-market" },
  { pattern: /^WP0CB/, hint: "Boxster 986/987/981/982 US-market" },
  { pattern: /^WP1AA/, hint: "Cayenne US-market (955/957/958/9YA)" },
];

export interface PorscheVinDecode {
  vin: string;
  valid: boolean;
  errors: string[];
  wmi?: string;
  wmiDescription?: string;
  modelYear?: number;
  modelYearAmbiguous?: boolean;
  modelYearAlternatives?: number[];
  plant?: string;
  plantDescription?: string;
  serial?: string;
  bodyHint?: string;
  checkDigit?: string;
  raw: {
    positions: Record<string, string>;
  };
}

const VALID_CHARS = /^[A-HJ-NPR-Z0-9]{17}$/i;

export function decodePorscheVin(rawVin: string): PorscheVinDecode {
  const vin = (rawVin ?? "").trim().toUpperCase();
  const errors: string[] = [];

  const result: PorscheVinDecode = {
    vin,
    valid: false,
    errors,
    raw: { positions: {} },
  };

  if (!vin) {
    errors.push("VIN is empty.");
    return result;
  }

  if (vin.length !== 17) {
    errors.push(`VIN must be 17 characters (received ${vin.length}). Pre-1981 Porsches use shorter chassis numbers and cannot be decoded here.`);
    return result;
  }

  if (!VALID_CHARS.test(vin)) {
    errors.push("VIN contains invalid characters. Allowed: A-Z (except I, O, Q) and 0-9.");
    return result;
  }

  // Break down position-by-position
  for (let i = 0; i < vin.length; i++) {
    result.raw.positions[`p${i + 1}`] = vin[i];
  }

  const wmi = vin.slice(0, 3);
  result.wmi = wmi;
  result.wmiDescription = WMI_MAP[wmi];

  if (!result.wmiDescription) {
    errors.push(`Unknown WMI ${wmi}. Porsche WMIs are WP0 and WP1. This VIN may not be a Porsche.`);
  }

  const yearChar = vin[9];
  const plantChar = vin[10];

  // Model year is ambiguous: letters A–Y map to both 1980s/90s AND 2010s/20s.
  // Plant code 'L' (Leipzig) only exists post-2002, so force-modern when present.
  // The WP0ZZZ96 / WP0ZZZ93 / WP0ZZZ98 air-cooled and early water-cooled patterns
  // only existed in the 1981–2005 window, so force-legacy for those.
  const isLegacyBody =
    /^WP0ZZZ9[346]/.test(vin) ||
    /^WP0AA29/.test(vin);
  const isModernByPlant = plantChar === "L";
  const isLikelyModern = !isLegacyBody && isModernByPlant;

  const legacyYear = MODEL_YEAR_MAP[yearChar];
  const modernYear = MODEL_YEAR_MAP_POST_2010[yearChar];
  const primaryYear = isLegacyBody
    ? legacyYear
    : isLikelyModern
      ? modernYear ?? legacyYear
      : legacyYear ?? modernYear;

  if (primaryYear) {
    result.modelYear = primaryYear;
    // Flag ambiguity if both legacy and modern cycle have a decoding
    const alt = primaryYear === legacyYear ? modernYear : legacyYear;
    if (alt && alt !== primaryYear && !isLegacyBody && !isModernByPlant) {
      result.modelYearAmbiguous = true;
      result.modelYearAlternatives = [alt];
    }
  } else {
    errors.push(`Position 10 '${yearChar}' does not map to a known model-year code.`);
  }

  result.plant = plantChar;
  result.plantDescription = PLANT_MAP[plantChar];

  result.checkDigit = vin[8];
  result.serial = vin.slice(11);

  // Body hint (first match wins)
  for (const { pattern, hint } of BODY_HINTS) {
    if (pattern.test(vin)) {
      result.bodyHint = hint;
      break;
    }
  }

  result.valid = errors.length === 0;
  return result;
}
