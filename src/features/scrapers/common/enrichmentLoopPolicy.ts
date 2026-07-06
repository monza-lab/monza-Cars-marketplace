export type MissingFieldType = "text" | "numeric";

export interface MissingFieldSpec {
  field: string;
  type: MissingFieldType;
}

const CRITICAL_SPEC_FIELDS = ["engine", "transmission"] as const;
export const AS24_TARGET_FIELDS = ["color_exterior", "engine", "transmission"] as const;
const PLACEHOLDER_TARGET_VALUE_LIST = ["Not specified", "Unknown", "N/A", "-"] as const;
const PLACEHOLDER_TARGET_VALUES = new Set(PLACEHOLDER_TARGET_VALUE_LIST.map((value) => value.toLowerCase()));
const PLACEHOLDER_TARGET_FILTER = `("${PLACEHOLDER_TARGET_VALUE_LIST.join('","')}")`;

export function buildMissingAnyFilter(fields: MissingFieldSpec[]): string {
  return fields
    .flatMap((spec) =>
      spec.type === "text"
        ? [`${spec.field}.is.null`, `${spec.field}.eq.`]
        : [`${spec.field}.is.null`],
    )
    .join(",");
}

export function buildMissingCriticalSpecFilter(): string {
  return buildMissingAnyFilter(
    CRITICAL_SPEC_FIELDS.map((field) => ({ field, type: "text" as const })),
  );
}

export function buildMissingDetailOrCriticalSpecFilter(markerFields: string[]): string {
  return buildMissingAnyFilter([
    ...markerFields.map((field) => ({ field, type: "text" as const })),
    ...CRITICAL_SPEC_FIELDS.map((field) => ({ field, type: "text" as const })),
  ]);
}

export function buildMissingAs24TargetFieldFilter(): string {
  return buildMissingAnyFilter(
    AS24_TARGET_FIELDS.map((field) => ({ field, type: "text" as const })),
  );
}

export function buildUnusableAs24TargetFieldFilter(): string {
  return AS24_TARGET_FIELDS.flatMap((field) => [
    `${field}.is.null`,
    `${field}.eq.`,
    `${field}.in.${PLACEHOLDER_TARGET_FILTER}`,
  ]).join(",");
}

export function buildMissingAs24TargetOrDetailFilter(detailFields: string[]): string {
  return buildMissingAnyFilter([
    ...AS24_TARGET_FIELDS.map((field) => ({ field, type: "text" as const })),
    ...detailFields.map((field) => ({ field, type: "text" as const })),
  ]);
}

export function isUsableTargetFieldValue(value: unknown): boolean {
  if (typeof value !== "string") return false;
  const normalized = value.trim().toLowerCase();
  return normalized.length > 0 && !PLACEHOLDER_TARGET_VALUES.has(normalized);
}

export function classifyScraplingBody(args: {
  mode: "http" | "dynamic";
  htmlLength: number;
  minLength?: number;
}): { kind: "ok" | "blocked" | "error"; message?: string } {
  const minLength = args.minLength ?? 5000;
  if (args.htmlLength >= minLength) return { kind: "ok" };

  const message = `Short scrapling body (${args.htmlLength})`;
  return args.mode === "http"
    ? { kind: "blocked", message }
    : { kind: "error", message };
}

const CRITICAL_NO_OUTPUT_IDS = new Set([
  "bf-images",
  "cron-beforward-enrich",
  "cron-elferspot-enrich",
  "cron-enrich-details",
  "cron-images",
]);

export function isCriticalNoOutput(args: {
  id: string;
  status: "ok" | "failed" | "timeout";
  discovered: number;
  written: number;
}): boolean {
  return (
    args.status === "ok" &&
    CRITICAL_NO_OUTPUT_IDS.has(args.id) &&
    args.discovered > 0 &&
    args.written === 0
  );
}

export function shouldFailEnrichmentLoopRun(args: {
  qualityGapsRemaining: boolean;
  failOnQualityGaps: boolean;
}): boolean {
  return args.failOnQualityGaps && args.qualityGapsRemaining;
}
