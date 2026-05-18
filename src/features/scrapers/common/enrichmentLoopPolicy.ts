export type MissingFieldType = "text" | "numeric";

export interface MissingFieldSpec {
  field: string;
  type: MissingFieldType;
}

export function buildMissingAnyFilter(fields: MissingFieldSpec[]): string {
  return fields
    .flatMap((spec) =>
      spec.type === "text"
        ? [`${spec.field}.is.null`, `${spec.field}.eq.`]
        : [`${spec.field}.is.null`],
    )
    .join(",");
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
  "cron-vin",
  "cron-titles",
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
