import { promises as fs } from "node:fs";
import path from "node:path";

import type { CollectorMode, SourceKey } from "./types";

export interface CollectorCheckpoint {
  version: 1;
  updatedAt: string; // ISO
  sources: Partial<Record<SourceKey, SourceCheckpoint>>;
}

export interface SourceCheckpoint {
  lastDailyRunAt?: string; // ISO
  backfill?: {
    dateFrom: string;
    dateTo: string;
    lastProcessedPage?: number;
  };
}

const DEFAULT_CHECKPOINT: CollectorCheckpoint = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  sources: {},
};

export async function loadCheckpoint(filePath: string): Promise<CollectorCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CollectorCheckpoint;
    if (parsed?.version !== 1 || typeof parsed !== "object") return { ...DEFAULT_CHECKPOINT };
    return {
      ...DEFAULT_CHECKPOINT,
      ...parsed,
      sources: {
        ...DEFAULT_CHECKPOINT.sources,
        ...(parsed.sources ?? {}),
      },
    };
  } catch {
    return { ...DEFAULT_CHECKPOINT };
  }
}

export async function saveCheckpoint(filePath: string, checkpoint: CollectorCheckpoint): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const updated: CollectorCheckpoint = {
    ...checkpoint,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(updated, null, 2) + "\n", "utf8");
}

export function updateSourceCheckpoint(
  checkpoint: CollectorCheckpoint,
  source: SourceKey,
  mode: CollectorMode,
  data: { nowIso: string; dateFrom?: string; dateTo?: string; lastProcessedPage?: number },
): CollectorCheckpoint {
  const existing = checkpoint.sources[source] ?? {};
  if (mode === "daily") {
    return {
      ...checkpoint,
      sources: {
        ...checkpoint.sources,
        [source]: {
          ...existing,
          lastDailyRunAt: data.nowIso,
        },
      },
    };
  }

  return {
    ...checkpoint,
    sources: {
      ...checkpoint.sources,
      [source]: {
        ...existing,
        backfill: {
          dateFrom: data.dateFrom ?? existing.backfill?.dateFrom ?? "",
          dateTo: data.dateTo ?? existing.backfill?.dateTo ?? "",
          lastProcessedPage: data.lastProcessedPage ?? existing.backfill?.lastProcessedPage ?? 0,
        },
      },
    },
  };
}
