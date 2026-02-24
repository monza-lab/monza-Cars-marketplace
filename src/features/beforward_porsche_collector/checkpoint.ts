import { promises as fs } from "node:fs";
import path from "node:path";

export interface CollectorCheckpoint {
  version: 1;
  updatedAt: string;
  totalResults: number | null;
  pageCount: number;
  lastCompletedPage: number;
  written: number;
  errors: number;
}

const DEFAULT_CHECKPOINT: CollectorCheckpoint = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  totalResults: null,
  pageCount: 0,
  lastCompletedPage: 0,
  written: 0,
  errors: 0,
};

export async function loadCheckpoint(filePath: string): Promise<CollectorCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as CollectorCheckpoint;
    if (parsed?.version !== 1 || typeof parsed !== "object") {
      return { ...DEFAULT_CHECKPOINT };
    }
    return { ...DEFAULT_CHECKPOINT, ...parsed };
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
