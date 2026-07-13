import type { FieldEvidence } from "./completeness";
import type { AssuranceField } from "./manifest";

export const SAFE_LISTING_PATCH_FIELDS = new Set([
  "listing_price",
  "current_bid",
  "hammer_price",
  "final_price",
  "sold_price",
  "original_currency",
  "images",
  "photos_count",
  "location",
  "city",
  "region",
  "country",
  "vin",
  "trim",
  "engine",
  "transmission",
  "mileage",
  "mileage_unit",
  "color_exterior",
  "color_interior",
  "body_style",
  "description_text",
  "seller_notes",
  "enrichment_meta",
] as const);

type EvidenceState = Extract<
  FieldEvidence["state"],
  "unavailable_at_source" | "temporarily_blocked" | "invalid_source_value"
>;

export interface EvidencePatchInput {
  field: AssuranceField;
  state: EvidenceState;
  checkedAt: string;
  sourceUrl: string;
  method: string;
  evidenceHash: string;
  retryAfter?: string;
  existingMeta?: Record<string, unknown> | null;
}

export interface EvidencePatch {
  enrichment_meta: Record<string, unknown> & {
    assurance: Record<string, unknown> & {
      fields: Partial<Record<AssuranceField, FieldEvidence>>;
    };
  };
}

export function assertSafeListingPatch(patch: object): void {
  for (const field of Object.keys(patch)) {
    if (!SAFE_LISTING_PATCH_FIELDS.has(field as never)) {
      throw new Error(`Prohibited listing field: ${field}`);
    }
  }
}

function requireIsoDate(value: string, name: string): void {
  if (!value || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${name} must be an ISO-8601 timestamp`);
  }
}

export function buildEvidencePatch(input: EvidencePatchInput): EvidencePatch {
  requireIsoDate(input.checkedAt, "checkedAt");
  if (input.retryAfter) requireIsoDate(input.retryAfter, "retryAfter");
  let sourceUrl: URL;
  try {
    sourceUrl = new URL(input.sourceUrl);
  } catch {
    throw new Error("sourceUrl must be a valid HTTPS URL");
  }
  if (sourceUrl.protocol !== "https:") throw new Error("sourceUrl must be a valid HTTPS URL");
  if (!input.method.trim()) throw new Error("method must be non-empty");
  if (!/^sha256:[a-f0-9]+$/i.test(input.evidenceHash)) {
    throw new Error("evidenceHash must match sha256:<hex>");
  }

  const evidence: FieldEvidence = {
    state: input.state,
    checkedAt: new Date(input.checkedAt).toISOString(),
    sourceUrl: input.sourceUrl,
    method: input.method.trim(),
    evidenceHash: input.evidenceHash as `sha256:${string}`,
    ...(input.retryAfter ? { retryAfter: new Date(input.retryAfter).toISOString() } : {}),
  };
  const existingMeta = input.existingMeta ?? {};
  const existingAssurance = typeof existingMeta.assurance === "object" && existingMeta.assurance !== null
    ? existingMeta.assurance as Record<string, unknown>
    : {};
  const existingFields = typeof existingAssurance.fields === "object" && existingAssurance.fields !== null
    ? existingAssurance.fields as Partial<Record<AssuranceField, FieldEvidence>>
    : {};
  const patch: EvidencePatch = {
    enrichment_meta: {
      ...existingMeta,
      assurance: {
        ...existingAssurance,
        fields: {
          ...existingFields,
          [input.field]: evidence,
        },
      },
    },
  };
  assertSafeListingPatch(patch);
  return patch;
}
