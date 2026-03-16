import type { BatCompletedItem } from "./parse_embedded_data";

// Non-vehicle indicators that should be rejected even when year/Porsche are present.
// All patterns use token boundaries to avoid substring collisions.
const NON_VEHICLE_PATTERNS: ReadonlyArray<RegExp> = [
  /\bwheels?\b/i,
  /\bwheel\s*set\b/i,
  /\bfuchs\s*wheels?\b/i,
  /\btool\s*kit\b/i,
  /\btoolkit\b/i,
  /\bmanuals?\b/i,
  /\bparts?\s+manuals?\b/i,
  /\boperating(?:\s+\w+){0,5}\s+manuals?\b/i,
  /\bowner'?s\s+manual\b/i,
  /\bseat\s*set\b/i,
  /\bbrochure\b/i,
  /\bliterature\b/i,
  /\bsign\b/i,
  /\bposter\b/i,
  /\bbadge\b/i,
  /\bmagazines?\b/i,
  /\bpanorama\s+magazine\b/i,
  /\btravel\s+kit\b/i,
  /\bengine\s+only\b/i,
  /\bengine\s+(and|&)\b/i,
  /\btype\s+911\/\d+\s+engine\b/i,
  /\btransaxle\b/i,
  /\btransmission\s+only\b/i,
  /\bgo-?kart\b/i,
  /\bmemorabilia\b/i,
  /\breplica\b/i,
  /\btribute\b/i,
  /\bkit\s*car\b/i,
  /\b\d{2}\s*[xX×]\s*\d{1,2}\b.*\bwheels?\b/i,
];

export function vehicleFilter(item: BatCompletedItem): { keep: true } | { keep: false; reason: string } {
  const title = String(item.title ?? "").trim();
  const make = String(item.make ?? "").trim();
  const model = String(item.model ?? "").trim();
  const normalizedTitle = title.normalize("NFKC");

  const combined = `${title} ${make} ${model}`.toLowerCase();

  if (!combined.includes("porsche")) {
    return { keep: false, reason: "non_porsche" };
  }

  // Check patterns - reject if ANY match
  for (const pattern of NON_VEHICLE_PATTERNS) {
    if (pattern.test(normalizedTitle)) {
      return { keep: false, reason: "non_vehicle_accessory" };
    }
  }

  if (!title) return { keep: false, reason: "missing_title" };
  return { keep: true };
}
