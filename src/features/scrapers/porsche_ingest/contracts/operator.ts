export type OperatorContext = {
  actor: "system" | "operator";
  canWrite: boolean;
  canRunBackfill: boolean;
};

export type ErrorEnvelope = {
  status: number;
  code: string;
  message: string;
  details?: Record<string, unknown>;
  requestId?: string;
};

export function assertOperatorCanWrite(ctx: OperatorContext): ErrorEnvelope | null {
  if (!ctx.canWrite) {
    return { status: 403, code: "FORBIDDEN", message: "Write permission required" };
  }
  return null;
}

export function assertOperatorCanBackfill(ctx: OperatorContext): ErrorEnvelope | null {
  if (!ctx.canRunBackfill) {
    return { status: 403, code: "FORBIDDEN", message: "Backfill permission required" };
  }
  return null;
}
