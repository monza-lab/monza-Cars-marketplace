import { promises as fs } from "node:fs";
import path from "node:path";

export type HistoricalBatCheckpoint = {
  version: 1;
  updated_at: string;
  scope: "all" | "vehicle" | "sold_vehicle";
  time_frame: string;
  last_page: number;
  seen_ids_count: number;
  items_total: number;
  pages_total: number;
};

const DEFAULT_CHECKPOINT: HistoricalBatCheckpoint = {
  version: 1,
  updated_at: new Date(0).toISOString(),
  scope: "all",
  time_frame: "1Y",
  last_page: 0,
  seen_ids_count: 0,
  items_total: 0,
  pages_total: 0,
};

export async function loadHistoricalCheckpoint(filePath: string): Promise<HistoricalBatCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw) as HistoricalBatCheckpoint;
    if (parsed.version !== 1) return { ...DEFAULT_CHECKPOINT };
    return { ...DEFAULT_CHECKPOINT, ...parsed };
  } catch {
    return { ...DEFAULT_CHECKPOINT };
  }
}

export async function saveHistoricalCheckpoint(filePath: string, checkpoint: HistoricalBatCheckpoint): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify({ ...checkpoint, version: 1, updated_at: new Date().toISOString() }, null, 2) + "\n", "utf8");
}
