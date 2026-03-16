import { promises as fs } from "node:fs";
import path from "node:path";

export interface ShardCheckpoint {
  lastProcessedPage: number;
  listingsFound: number;
  completedAt?: string;
}

export interface CollectorCheckpoint {
  version: 1;
  updatedAt: string;
  shards: Record<string, ShardCheckpoint>;
  totalWritten: number;
  totalErrors: number;
}

const DEFAULT_CHECKPOINT: CollectorCheckpoint = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  shards: {},
  totalWritten: 0,
  totalErrors: 0,
};

export async function loadCheckpoint(filePath: string): Promise<CollectorCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CollectorCheckpoint;
    if (parsed?.version !== 1 || typeof parsed !== "object") {
      return { ...DEFAULT_CHECKPOINT };
    }
    return { ...DEFAULT_CHECKPOINT, ...parsed, shards: { ...parsed.shards } };
  } catch {
    return { ...DEFAULT_CHECKPOINT };
  }
}

export async function saveCheckpoint(filePath: string, checkpoint: CollectorCheckpoint): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  const next: CollectorCheckpoint = {
    ...checkpoint,
    version: 1,
    updatedAt: new Date().toISOString(),
  };
  await fs.writeFile(filePath, JSON.stringify(next, null, 2) + "\n", "utf8");
}

export function updateShardCheckpoint(
  cp: CollectorCheckpoint,
  shardId: string,
  page: number,
  found: number,
): CollectorCheckpoint {
  const existing = cp.shards[shardId];
  return {
    ...cp,
    shards: {
      ...cp.shards,
      [shardId]: {
        lastProcessedPage: page,
        listingsFound: (existing?.listingsFound ?? 0) + found,
      },
    },
  };
}

export function markShardComplete(cp: CollectorCheckpoint, shardId: string): CollectorCheckpoint {
  const existing = cp.shards[shardId] ?? { lastProcessedPage: 0, listingsFound: 0 };
  return {
    ...cp,
    shards: {
      ...cp.shards,
      [shardId]: {
        ...existing,
        completedAt: new Date().toISOString(),
      },
    },
  };
}

/**
 * Return IDs of shards that have NOT been completed yet.
 */
export function getIncompleteShards(
  cp: CollectorCheckpoint,
  allShards: { id: string }[],
): string[] {
  return allShards
    .filter((s) => !cp.shards[s.id]?.completedAt)
    .map((s) => s.id);
}

/**
 * Get the resume page for a shard (0 if not started).
 */
export function getShardResumePage(cp: CollectorCheckpoint, shardId: string): number {
  return cp.shards[shardId]?.lastProcessedPage ?? 0;
}
