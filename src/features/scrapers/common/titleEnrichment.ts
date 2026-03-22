/**
 * Regex-based parsers for extracting structured data from listing titles/descriptions.
 * Best-effort: only fills null fields, never overwrites existing data.
 */

/** Returns true if the match is preceded by a negative-context word */
function hasNegativeContext(text: string, matchIndex: number, negWords: string[]): boolean {
  const before = text.slice(Math.max(0, matchIndex - 30), matchIndex).toLowerCase();
  return negWords.some((w) => before.includes(w));
}

export function parseEngineFromText(text: string): string | null {
  // Pattern: displacement + optional config + optional forced induction
  const displacementPattern =
    /\b(\d\.\d)\s*(?:-\s*)?(?:L(?:iter)?|litre)\s*((?:(?:Twin-?\s*)?Turbo(?:charged)?|Supercharged|(?:Flat|Boxer|Inline|Straight|V)-?\s*\d+|V\d+|I\d+)(?:\s+(?:(?:Twin-?\s*)?Turbo(?:charged)?|Supercharged))?)/i;

  const dispMatch = text.match(displacementPattern);
  if (dispMatch) {
    if (hasNegativeContext(text, dispMatch.index!, ["fuel", "capacity", "tank", "gallon"])) {
      return null;
    }
    const displacement = `${dispMatch[1]}L`;
    const config = dispMatch[2].trim();
    return `${displacement} ${config}`;
  }

  const dispOnly = text.match(/\b(\d\.\d)\s*(?:-\s*)?(?:L(?:iter)?|litre)\b/i);

  const configPattern =
    /\b((?:Flat|Boxer|Inline|Straight)-?\s*(?:Six|Four|Eight|6|4|8|12)|V\s*(?:6|8|10|12)|I\s*(?:4|6))\s*((?:Twin-?\s*)?Turbo(?:charged)?|Supercharged)?/i;

  const configMatch = text.match(configPattern);
  if (configMatch) {
    const configStart = text.indexOf(configMatch[0]);
    const before = text.slice(Math.max(0, configStart - 20), configStart);
    if (/\b\d[\d,]*\s*(?:miles?|km|kilometers?)\b/i.test(text) && !dispOnly && !configMatch[2]) {
      if (/\d/.test(before)) return null;
    }

    const parts: string[] = [];
    if (dispOnly) parts.push(`${dispOnly[1]}L`);
    parts.push(configMatch[1].trim());
    if (configMatch[2]) parts.push(configMatch[2].trim());
    return parts.join(" ");
  }

  if (dispOnly) {
    // Reject if preceded by fuel/capacity context
    if (hasNegativeContext(text, dispOnly.index!, ["fuel", "capacity", "tank", "gallon"])) {
      return null;
    }
    return `${dispOnly[1]}L`;
  }

  const turboOnly = text.match(/\b((?:Twin-?\s*)?Turbo(?:charged)?|Supercharged)\b/i);
  if (turboOnly) {
    const hasEngineContext = /\b(?:engine|motor|power|hp|bhp|displacement|cylinder)\b/i.test(text);
    if (hasEngineContext) return turboOnly[1];
  }

  return null;
}

export function parseTransmissionFromText(text: string): string | null {
  const speedPattern =
    /\b(\d)\s*-?\s*(?:speed|spd)\s+(manual|automatic|auto|PDK|DCT|DSG|SMG|F1|Tiptronic|sequential)\b/i;
  const speedMatch = text.match(speedPattern);
  if (speedMatch) {
    const speed = speedMatch[1];
    let type = speedMatch[2];
    type = type.charAt(0).toUpperCase() + type.slice(1);
    if (type.toLowerCase() === "auto") type = "Automatic";
    return `${speed}-Speed ${type}`;
  }

  const standalonePattern = /\b(PDK|DCT|DSG|SMG|Tiptronic|F1\s*gearbox|Sequential)\b/i;
  const standaloneMatch = text.match(standalonePattern);
  if (standaloneMatch) return standaloneMatch[1];

  const simplePattern = /\b(Manual|Automatic)\s*(?:Transmission|Gearbox|Trans\.?)?\b/i;
  const simpleMatch = text.match(simplePattern);
  if (simpleMatch) {
    const word = simpleMatch[1];
    const afterWord = text.slice(text.indexOf(simpleMatch[0]) + simpleMatch[0].length, text.indexOf(simpleMatch[0]) + simpleMatch[0].length + 20);
    if (/^\s*(steering|window|mirror|seat|lock|brake)/i.test(afterWord)) return null;
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  return null;
}

export function parseBodyStyleFromText(text: string): string | null {
  const pattern =
    /\b(Coup[eé]|Cabriolet|Targa|Spider|Spyder|Berlinetta|Roadster|Convertible|Sedan|Saloon|Wagon|Estate|Shooting\s*Brake|SUV|Hatchback|GTB|GTC)\b/i;
  const match = text.match(pattern);
  if (!match) return null;

  // Reject body style words in color/paint context (check both before and after the match)
  const matchEnd = match.index! + match[0].length;
  const after = text.slice(matchEnd, matchEnd + 30).toLowerCase();
  if (
    hasNegativeContext(text, match.index!, ["color", "paint", "finish", "colour"]) ||
    ["color", "paint", "finish", "colour"].some((w) => after.includes(w))
  ) {
    return null;
  }

  const raw = match[1];
  const lower = raw.toLowerCase();
  const MAP: Record<string, string> = {
    coupe: "Coupe", coupé: "Coupe", cabriolet: "Cabriolet", targa: "Targa",
    spider: "Spider", spyder: "Spyder", berlinetta: "Berlinetta", roadster: "Roadster",
    convertible: "Convertible", sedan: "Sedan", saloon: "Sedan", wagon: "Wagon",
    estate: "Wagon", suv: "SUV", hatchback: "Hatchback", gtb: "GTB", gtc: "GTC",
  };
  if (/shooting\s*brake/i.test(raw)) return "Shooting Brake";
  return MAP[lower] ?? raw;
}

export function parseTrimFromText(text: string): string | null {
  const TRIM_PATTERNS: Array<{ pattern: RegExp; label: string }> = [
    { pattern: /\bGT3\s*RS\b/i, label: "GT3 RS" },
    { pattern: /\bGT2\s*RS\b/i, label: "GT2 RS" },
    { pattern: /\bTurbo\s+S\b/i, label: "Turbo S" },
    { pattern: /\bCarrera\s+4\s*GTS\b/i, label: "Carrera 4 GTS" },
    { pattern: /\bCarrera\s+GTS\b/i, label: "Carrera GTS" },
    { pattern: /\bCarrera\s+4S\b/i, label: "Carrera 4S" },
    { pattern: /\bCarrera\s+4\b/i, label: "Carrera 4" },
    { pattern: /\bCarrera\s+S\b/i, label: "Carrera S" },
    { pattern: /\bTarga\s+4\s*GTS\b/i, label: "Targa 4 GTS" },
    { pattern: /\bTarga\s+4S\b/i, label: "Targa 4S" },
    { pattern: /\bTarga\s+4\b/i, label: "Targa 4" },
    { pattern: /\bGT3\b/i, label: "GT3" },
    { pattern: /\bGT2\b/i, label: "GT2" },
    { pattern: /\bGT4\s*RS\b/i, label: "GT4 RS" },
    { pattern: /\bGT4\b/i, label: "GT4" },
    { pattern: /\bGTS\b/i, label: "GTS" },
    { pattern: /\bTurbo\b/i, label: "Turbo" },
    { pattern: /\bCarrera\b/i, label: "Carrera" },
    { pattern: /\bSpeciale\s*A?\b/i, label: "Speciale" },
    { pattern: /\bScuderia\b/i, label: "Scuderia" },
    { pattern: /\bPista\s*Spider\b/i, label: "Pista Spider" },
    { pattern: /\bPista\b/i, label: "Pista" },
    { pattern: /\bCompetizione\b/i, label: "Competizione" },
    { pattern: /\bCompetition\b/i, label: "Competition" },
    { pattern: /\bCS\b/, label: "CS" },
  ];

  for (const { pattern, label } of TRIM_PATTERNS) {
    if (pattern.test(text)) return label;
  }

  return null;
}
