import { promises as fs } from "node:fs"
import path from "node:path"

export interface ElferspotCheckpoint {
  version: 1
  updatedAt: string
  lastCompletedPage: number
  processedIds: string[]
  written: number
  errors: number
}

const DEFAULT: ElferspotCheckpoint = {
  version: 1,
  updatedAt: new Date(0).toISOString(),
  lastCompletedPage: 0,
  processedIds: [],
  written: 0,
  errors: 0,
}

export async function loadCheckpoint(filePath: string): Promise<ElferspotCheckpoint> {
  try {
    const raw = await fs.readFile(filePath, "utf8")
    const parsed = JSON.parse(raw)
    if (parsed?.version !== 1) return { ...DEFAULT }
    return { ...DEFAULT, ...parsed }
  } catch {
    return { ...DEFAULT }
  }
}

export async function saveCheckpoint(filePath: string, cp: ElferspotCheckpoint): Promise<void> {
  const dir = path.dirname(filePath)
  await fs.mkdir(dir, { recursive: true })
  await fs.writeFile(filePath, JSON.stringify({ ...cp, version: 1, updatedAt: new Date().toISOString() }, null, 2) + "\n", "utf8")
}
