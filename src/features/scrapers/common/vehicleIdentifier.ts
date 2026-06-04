export type VehicleIdentifierKind = "vin_17" | "chassis_or_serial" | "invalid";

export type VehicleIdentifier = {
  raw: string;
  normalized: string;
  kind: VehicleIdentifierKind;
  sourceLabel: string | null;
};

const DEFAULT_LABELS = [
  "VIN",
  "Vehicle Identification Number",
  "Chassis No.",
  "Chassis Number",
  "Chassis",
  "Frame Number",
  "Frame",
  "Serial Number",
  "Serial",
];

const LABELED_SHORT_RE = /\b(chassis|frame|serial)\b/i;
const VIN_17_RE = /^[A-HJ-NPR-Z0-9]{17}$/;
const ALNUM_RE = /^[A-Z0-9]+$/;

export function classifyVehicleIdentifier(
  raw: string | null | undefined,
  sourceLabel?: string | null,
): VehicleIdentifier | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.replace(/\s+/g, " ").trim();
  if (!trimmed) return null;

  const normalized = trimmed.toUpperCase().replace(/[\s._-]+/g, "");
  if (!ALNUM_RE.test(normalized)) return null;

  const label = sourceLabel?.trim() || null;
  if (VIN_17_RE.test(normalized)) {
    return {
      raw: trimmed,
      normalized,
      kind: "vin_17",
      sourceLabel: label,
    };
  }

  if (normalized.length === 17) return null;

  if (label && LABELED_SHORT_RE.test(label) && normalized.length >= 5) {
    return {
      raw: trimmed,
      normalized,
      kind: "chassis_or_serial",
      sourceLabel: label,
    };
  }

  return null;
}

export function extractVehicleIdentifierFromText(
  text: string,
  options?: {
    labels?: string[];
    allowGenericVin?: boolean;
  },
): VehicleIdentifier | null {
  const labels = options?.labels ?? DEFAULT_LABELS;
  const normalizedText = text.replace(/\s+/g, " ");

  for (const label of labels) {
    const escapedLabel = escapeRegex(label).replace(/\\ /g, "\\s+");
    const endBoundary = /[A-Za-z0-9]$/.test(label) ? "\\b" : "";
    const pattern = new RegExp(
      `\\b(${escapedLabel})${endBoundary}\\s*(?:[:#-]|no\\.?|number)?\\s*([A-Za-z0-9][A-Za-z0-9\\s._-]{3,24}[A-Za-z0-9])`,
      "i",
    );
    const match = normalizedText.match(pattern);
    if (!match) continue;

    const classified = classifyVehicleIdentifier(match[2], match[1]);
    if (classified) return classified;
  }

  if (options?.allowGenericVin) {
    const genericVin = normalizedText.match(/\b[A-HJ-NPR-Z0-9][A-HJ-NPR-Z0-9\s._-]{15,23}[A-HJ-NPR-Z0-9]\b/i);
    if (genericVin) return classifyVehicleIdentifier(genericVin[0]);
  }

  return null;
}

function escapeRegex(input: string): string {
  return input.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
