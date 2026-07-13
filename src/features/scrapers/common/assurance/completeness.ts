import type {
  AssuranceField,
  AssuranceSource,
} from "./manifest";

export type ResolutionState =
  | "populated_from_source"
  | "populated_from_authoritative_enrichment"
  | "unavailable_at_source"
  | "temporarily_blocked"
  | "invalid_source_value";

export interface FieldEvidence {
  state: ResolutionState;
  checkedAt: string;
  sourceUrl: string;
  method: string;
  evidenceHash: `sha256:${string}`;
  retryAfter?: string;
}

interface AssuranceMetadata {
  assurance?: {
    fields?: Partial<Record<AssuranceField, FieldEvidence>>;
  };
  [key: string]: unknown;
}

export interface AssuranceListingRow {
  id: string;
  source: string | null;
  source_id: string | null;
  source_url: string | null;
  title: string | null;
  make: string | null;
  model: string | null;
  year: number | null;
  status: string | null;
  listing_price: number | string | null;
  current_bid: number | string | null;
  hammer_price: number | string | null;
  final_price: number | string | null;
  sold_price: number | string | null;
  original_currency: string | null;
  images: unknown;
  location: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  vin: string | null;
  trim: string | null;
  engine: string | null;
  transmission: string | null;
  mileage: number | string | null;
  mileage_unit: string | null;
  color_exterior: string | null;
  color_interior: string | null;
  body_style: string | null;
  description_text: string | null;
  enrichment_meta: AssuranceMetadata | null;
}

export type UnresolvedReason =
  | "missing"
  | "unavailable_not_allowed"
  | "evidence_expired"
  | "evidence_source_changed"
  | "evidence_invalid"
  | "temporarily_blocked"
  | "invalid_source_value"
  | "evidence_without_value";

export interface FieldEvaluation {
  field: AssuranceField;
  populated: boolean;
  resolved: boolean;
  state?: ResolutionState;
  reason?: UnresolvedReason;
}

export interface ListingEvaluation {
  listingId: string;
  source: string;
  fields: FieldEvaluation[];
  unresolved: Array<FieldEvaluation & { reason: UnresolvedReason }>;
  populatedFields: number;
  resolvedFields: number;
  requiredFields: number;
  rawCompletenessPct: number;
  contractResolutionPct: number;
}

const PLACEHOLDERS = new Set(["unknown", "n/a", "not specified", "-"]);
const EVIDENCE_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function usefulString(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !PLACEHOLDERS.has(normalized);
}

function positiveNumber(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return false;
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric > 0;
}

function validImage(value: unknown): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((candidate) => {
    if (typeof candidate !== "string") return false;
    try {
      const url = new URL(candidate);
      return url.protocol === "http:" || url.protocol === "https:";
    } catch {
      return false;
    }
  });
}

function fieldPopulated(row: AssuranceListingRow, field: AssuranceField): boolean {
  switch (field) {
    case "price":
      return [row.listing_price, row.current_bid, row.hammer_price, row.final_price, row.sold_price]
        .some(positiveNumber);
    case "images":
      return validImage(row.images);
    case "location":
      return [row.location, row.city, row.region, row.country].some(usefulString);
    case "year": {
      const value = Number(row.year);
      return Number.isInteger(value) && value >= 1886 && value <= new Date().getFullYear() + 2;
    }
    case "mileage": {
      if (row.mileage === null || row.mileage === undefined || row.mileage === "") return false;
      const value = Number(row.mileage);
      return Number.isFinite(value) && value >= 0;
    }
    default:
      return usefulString(row[field as keyof AssuranceListingRow]);
  }
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 100;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function evaluateMissingField(
  row: AssuranceListingRow,
  source: AssuranceSource,
  field: AssuranceField,
  now: Date,
): FieldEvaluation {
  const evidence = row.enrichment_meta?.assurance?.fields?.[field];
  if (!evidence) return { field, populated: false, resolved: false, reason: "missing" };

  if (evidence.state !== "unavailable_at_source") {
    const reason: UnresolvedReason = evidence.state === "temporarily_blocked"
      ? "temporarily_blocked"
      : evidence.state === "invalid_source_value"
        ? "invalid_source_value"
        : "evidence_without_value";
    return { field, populated: false, resolved: false, state: evidence.state, reason };
  }

  if (!source.unavailableFields.includes(field)) {
    return { field, populated: false, resolved: false, state: evidence.state, reason: "unavailable_not_allowed" };
  }
  if (evidence.sourceUrl !== row.source_url) {
    return { field, populated: false, resolved: false, state: evidence.state, reason: "evidence_source_changed" };
  }

  const checkedAt = Date.parse(evidence.checkedAt);
  if (!Number.isFinite(checkedAt) || now.getTime() - checkedAt > EVIDENCE_TTL_MS) {
    return { field, populated: false, resolved: false, state: evidence.state, reason: "evidence_expired" };
  }
  if (!evidence.method?.trim() || !/^sha256:[a-f0-9]+$/i.test(evidence.evidenceHash ?? "")) {
    return { field, populated: false, resolved: false, state: evidence.state, reason: "evidence_invalid" };
  }

  return { field, populated: false, resolved: true, state: evidence.state };
}

export function evaluateListing(
  row: AssuranceListingRow,
  source: AssuranceSource,
  now = new Date(),
): ListingEvaluation {
  const fields = source.requiredFields.map((field): FieldEvaluation => {
    if (fieldPopulated(row, field)) {
      const evidence = row.enrichment_meta?.assurance?.fields?.[field];
      return {
        field,
        populated: true,
        resolved: true,
        state: evidence?.state === "populated_from_authoritative_enrichment"
          ? evidence.state
          : "populated_from_source",
      };
    }
    return evaluateMissingField(row, source, field, now);
  });

  const populatedFields = fields.filter((field) => field.populated).length;
  const resolvedFields = fields.filter((field) => field.resolved).length;
  const requiredFields = fields.length;
  const unresolved = fields.filter(
    (field): field is FieldEvaluation & { reason: UnresolvedReason } => !field.resolved && Boolean(field.reason),
  );

  return {
    listingId: row.id,
    source: row.source ?? source.id,
    fields,
    unresolved,
    populatedFields,
    resolvedFields,
    requiredFields,
    rawCompletenessPct: percentage(populatedFields, requiredFields),
    contractResolutionPct: percentage(resolvedFields, requiredFields),
  };
}
