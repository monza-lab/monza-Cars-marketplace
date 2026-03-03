type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
  level: LogLevel;
  event: string;
  runId: string;
  ts: string;
} & Record<string, unknown>;

function nowIso(): string {
  return new Date().toISOString();
}

export function logEvent(input: Omit<LogEvent, "ts">): void {
  const evt: LogEvent = {
    level: input.level as LogLevel,
    event: input.event as string,
    runId: input.runId as string,
    ts: nowIso(),
    ...input,
  };
  const line = JSON.stringify(evt);
  if (evt.level === "error") {
    console.error(line);
    return;
  }
  if (evt.level === "warn") {
    console.warn(line);
    return;
  }
  console.log(line);
}
