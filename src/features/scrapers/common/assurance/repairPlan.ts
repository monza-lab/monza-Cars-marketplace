import type { ScraperAssuranceReport } from "./database";
import { SCRAPER_JOBS } from "./manifest";

export interface RepairPlan {
  gaps: ScraperAssuranceReport["repairQueue"];
  jobIds: string[];
  bySource: Record<string, number>;
  byField: Record<string, number>;
  byReason: Record<string, number>;
}

function countBy(values: readonly string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return Object.fromEntries(Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)));
}

export function buildRepairPlan(report: ScraperAssuranceReport): RepairPlan {
  const jobsById = new Map(SCRAPER_JOBS.map((job) => [job.id, job]));
  const requestedJobIds = new Set<string>();

  for (const gap of report.repairQueue) {
    if (gap.repairJobIds.length === 0) {
      throw new Error(`No repair job mapped for ${gap.source}/${gap.listingId}/${gap.field}`);
    }
    for (const jobId of gap.repairJobIds) {
      const job = jobsById.get(jobId);
      if (!job) throw new Error(`unknown repair job ${jobId}`);
      if (job.destructive) throw new Error(`destructive repair job ${jobId} is prohibited`);
      if (!job.sourceIds.includes(gap.source)) {
        throw new Error(`Repair job ${jobId} does not cover source ${gap.source}`);
      }
      requestedJobIds.add(jobId);
    }
  }

  return {
    gaps: [...report.repairQueue],
    jobIds: Array.from(requestedJobIds).sort(),
    bySource: countBy(report.repairQueue.map((gap) => gap.source)),
    byField: countBy(report.repairQueue.map((gap) => gap.field)),
    byReason: countBy(report.repairQueue.map((gap) => gap.reason)),
  };
}
