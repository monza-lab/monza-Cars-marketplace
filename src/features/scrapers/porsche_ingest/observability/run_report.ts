import { promises as fs } from "node:fs";
import path from "node:path";

import type { NormalizeReject } from "../contracts/listing";

export type RunReport = {
  run_id: string;
  started_at: string;
  finished_at: string;
  mode: string;
  source: string;
  dry_run: boolean;
  totals: {
    fetched: number;
    normalized: number;
    deduped: number;
    inserted: number;
    updated: number;
    rejected: number;
    errors: number;
  };
  rejection_reasons: Record<string, number>;
  errors: string[];
};

export async function writeRunArtifacts(input: {
  runId: string;
  report: RunReport;
  rejects: NormalizeReject[];
  rootDir?: string;
}): Promise<{ reportPath: string; rejectsPath: string }> {
  const rootDir = input.rootDir ?? "var/runs/porsche-ingest";
  await fs.mkdir(path.join(rootDir, "rejects"), { recursive: true });

  const reportPath = path.join(rootDir, `${input.runId}.json`);
  const rejectsPath = path.join(rootDir, "rejects", `${input.runId}.jsonl`);

  await fs.writeFile(reportPath, JSON.stringify(input.report, null, 2) + "\n", "utf8");
  const lines = input.rejects.map((r) => JSON.stringify(r)).join("\n");
  await fs.writeFile(rejectsPath, lines + (lines ? "\n" : ""), "utf8");

  return { reportPath, rejectsPath };
}
