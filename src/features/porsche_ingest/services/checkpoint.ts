import { promises as fs } from "node:fs";
import path from "node:path";

import type { SourceKey } from "../adapters/sources";

export type IngestCheckpoint = {
  version: 1;
  updated_at: string;
  sources: Partial<Record<SourceKey, { last_cursor: string | null; last_seen_at: string | null; run_id: string | null }>>;
};

const DEFAULT_CHECKPOINT: IngestCheckpoint = {
  version: 1,
  updated_at: new Date(0).toISOString(),
  sources: {},
};

export async function loadCheckpoint(filePath: string): Promise<IngestCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as IngestCheckpoint;
    if (parsed.version !== 1) return DEFAULT_CHECKPOINT;
    return { ...DEFAULT_CHECKPOINT, ...parsed, sources: { ...DEFAULT_CHECKPOINT.sources, ...parsed.sources } };
  } catch {
    return DEFAULT_CHECKPOINT;
  }
}

export async function updateCheckpoint(input: {
  filePath: string;
  source: SourceKey;
  runId: string;
  lastCursor: string | null;
  lastSeenAt: string | null;
}): Promise<IngestCheckpoint> {
  const current = await loadCheckpoint(input.filePath);
  const next: IngestCheckpoint = {
    ...current,
    updated_at: new Date().toISOString(),
    sources: {
      ...current.sources,
      [input.source]: {
        last_cursor: input.lastCursor,
        last_seen_at: input.lastSeenAt,
        run_id: input.runId,
      },
    },
  };
  await fs.mkdir(path.dirname(input.filePath), { recursive: true });
  await fs.writeFile(input.filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
  return next;
}
