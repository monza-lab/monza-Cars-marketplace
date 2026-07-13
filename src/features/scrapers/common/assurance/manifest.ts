import { existsSync, readdirSync } from "node:fs";
import path from "node:path";

import type { ScraperJobSpec } from "../monitoring/audit";
import type { ScraperName } from "../monitoring/types";

export type AssuranceSourceId =
  | "AutoScout24"
  | "AutoTrader"
  | "BaT"
  | "BeForward"
  | "CarsAndBids"
  | "ClassicCom"
  | "CollectingCars"
  | "Elferspot";

export type AssurancePhase =
  | "discovery"
  | "enrichment"
  | "maintenance"
  | "post-run";

export const ASSURANCE_FIELDS = [
  "source",
  "source_id",
  "source_url",
  "title",
  "make",
  "model",
  "year",
  "status",
  "price",
  "original_currency",
  "images",
  "location",
  "vin",
  "trim",
  "engine",
  "transmission",
  "mileage",
  "mileage_unit",
  "color_exterior",
  "color_interior",
  "body_style",
  "description_text",
] as const;

export type AssuranceField = (typeof ASSURANCE_FIELDS)[number];

export interface AssuranceCommand {
  command: string;
  args: readonly string[];
  timeoutMs: number;
}

export interface AssuranceJob {
  id: string;
  scraperName: ScraperName | "health-audit";
  label: string;
  phase: AssurancePhase;
  cadence: ScraperJobSpec["cadence"];
  sourceIds: readonly AssuranceSourceId[];
  workflowFiles: readonly string[];
  codePaths: readonly string[];
  cronPath?: string;
  destructive: boolean;
}

export interface AssuranceSource {
  id: AssuranceSourceId;
  label: string;
  collectorJobIds: readonly string[];
  enrichmentJobIds: readonly string[];
  expectedCadenceHours: number;
  maxRunMinutes: number;
  requiredFields: readonly AssuranceField[];
  unavailableFields: readonly AssuranceField[];
  repairJobIds: readonly string[];
  canary: AssuranceCommand;
}

const AUCTION_SOURCE_IDS = ["BaT", "CarsAndBids", "CollectingCars"] as const;
const REQUIRED_FIELDS: readonly AssuranceField[] = ASSURANCE_FIELDS;
const UNAVAILABLE_FIELDS: readonly AssuranceField[] = [
  "price",
  "original_currency",
  "location",
  "vin",
  "trim",
  "engine",
  "transmission",
  "mileage",
  "mileage_unit",
  "color_exterior",
  "color_interior",
  "body_style",
  "description_text",
];

function command(args: readonly string[], timeoutMs = 120_000): AssuranceCommand {
  return { command: "npx", args, timeoutMs };
}

function auctionSource(
  id: (typeof AUCTION_SOURCE_IDS)[number],
  label: string,
  enrichmentJobIds: readonly string[] = [],
): AssuranceSource {
  return {
    id,
    label,
    collectorJobIds: ["porsche", "ferrari"],
    enrichmentJobIds,
    expectedCadenceHours: 24,
    maxRunMinutes: 45,
    requiredFields: REQUIRED_FIELDS,
    unavailableFields: UNAVAILABLE_FIELDS,
    repairJobIds: [...enrichmentJobIds, "enrich-vin", "enrich-titles"],
    canary: command([
      "tsx",
      "src/features/scrapers/porsche_collector/cli.ts",
      "--mode=daily",
      `--sources=${id}`,
      "--maxActivePages=1",
      "--maxEndedPages=0",
      "--noDetails",
      "--timeBudgetMs=120000",
      "--dryRun",
    ]),
  };
}

export const ASSURANCE_SOURCES: readonly AssuranceSource[] = [
  auctionSource("BaT", "Bring a Trailer", ["bat-detail"]),
  auctionSource("CarsAndBids", "Cars & Bids"),
  auctionSource("CollectingCars", "Collecting Cars"),
  {
    id: "AutoScout24",
    label: "AutoScout24",
    collectorJobIds: ["autoscout24"],
    enrichmentJobIds: ["as24-enrich", "enrich-details", "enrich-details-bulk"],
    expectedCadenceHours: 24,
    maxRunMinutes: 60,
    requiredFields: REQUIRED_FIELDS,
    unavailableFields: UNAVAILABLE_FIELDS,
    repairJobIds: ["as24-enrich", "enrich-details", "enrich-vin", "enrich-titles"],
    canary: command([
      "tsx",
      "src/features/scrapers/autoscout24_collector/cli.ts",
      "--maxPagesPerShard=1",
      "--maxListings=20",
      "--timeBudgetMs=120000",
      "--dryRun",
    ]),
  },
  {
    id: "AutoTrader",
    label: "AutoTrader UK",
    collectorJobIds: ["autotrader"],
    enrichmentJobIds: ["enrich-autotrader"],
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    requiredFields: REQUIRED_FIELDS,
    unavailableFields: UNAVAILABLE_FIELDS,
    repairJobIds: ["enrich-autotrader", "enrich-vin", "enrich-titles"],
    canary: command([
      "tsx",
      "src/features/scrapers/autotrader_collector/cli.ts",
      "--maxPages=1",
      "--noDetails",
      "--dryRun",
    ]),
  },
  {
    id: "BeForward",
    label: "BeForward",
    collectorJobIds: ["beforward"],
    enrichmentJobIds: ["enrich-beforward", "backfill-images"],
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    requiredFields: REQUIRED_FIELDS,
    unavailableFields: UNAVAILABLE_FIELDS,
    repairJobIds: ["enrich-beforward", "backfill-images", "enrich-vin", "enrich-titles"],
    canary: command([
      "tsx",
      "scripts/bf-collector-cli.ts",
      "--maxPages=1",
      "--summaryOnly",
      "--dryRun",
      "--rateLimitMs=3000",
    ]),
  },
  {
    id: "ClassicCom",
    label: "Classic.com",
    collectorJobIds: ["classic"],
    enrichmentJobIds: ["classic-enrich", "backfill-images"],
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    requiredFields: REQUIRED_FIELDS,
    unavailableFields: UNAVAILABLE_FIELDS,
    repairJobIds: ["classic-enrich", "backfill-images", "enrich-vin", "enrich-titles"],
    canary: command([
      "tsx",
      "src/features/scrapers/classic_collector/cli.ts",
      "--maxPages=1",
      "--maxListings=20",
      "--dryRun",
    ]),
  },
  {
    id: "Elferspot",
    label: "Elferspot",
    collectorJobIds: ["elferspot"],
    enrichmentJobIds: ["enrich-elferspot", "backfill-photos-elferspot"],
    expectedCadenceHours: 24,
    maxRunMinutes: 30,
    requiredFields: REQUIRED_FIELDS,
    unavailableFields: UNAVAILABLE_FIELDS,
    repairJobIds: ["enrich-elferspot", "backfill-photos-elferspot", "enrich-vin", "enrich-titles"],
    canary: command([
      "tsx",
      "src/features/scrapers/elferspot_collector/cli.ts",
      "--maxPages=1",
      "--maxListings=20",
      "--dryRun",
      "--fresh",
    ]),
  },
] as const;

function job(
  id: string,
  scraperName: AssuranceJob["scraperName"],
  label: string,
  phase: AssurancePhase,
  sourceIds: readonly AssuranceSourceId[],
  codePaths: readonly string[],
  options: {
    cadence?: ScraperJobSpec["cadence"];
    workflows?: readonly string[];
    cronPath?: string;
    destructive?: boolean;
  } = {},
): AssuranceJob {
  return {
    id,
    scraperName,
    label,
    phase,
    cadence: options.cadence ?? "daily",
    sourceIds,
    workflowFiles: options.workflows ?? [],
    codePaths,
    cronPath: options.cronPath,
    destructive: options.destructive ?? false,
  };
}

export const SCRAPER_JOBS: readonly AssuranceJob[] = [
  job("porsche", "porsche", "Porsche Collector", "discovery", AUCTION_SOURCE_IDS, ["src/features/scrapers/porsche_collector"], { workflows: ["bat-live-refresh.yml"] }),
  job("ferrari", "ferrari", "Ferrari Collector", "discovery", AUCTION_SOURCE_IDS, ["src/features/scrapers/ferrari_collector"]),
  job("autotrader", "autotrader", "AutoTrader Collector", "discovery", ["AutoTrader"], ["src/features/scrapers/autotrader_collector"], { workflows: ["autotrader-collector.yml"] }),
  job("beforward", "beforward", "BeForward Collector", "discovery", ["BeForward"], ["src/features/scrapers/beforward_porsche_collector"], { workflows: ["beforward-collector.yml"] }),
  job("classic", "classic", "Classic.com Collector", "discovery", ["ClassicCom"], ["src/features/scrapers/classic_collector"], { workflows: ["classic-collector.yml"] }),
  job("autoscout24", "autoscout24", "AutoScout24 Collector", "discovery", ["AutoScout24"], ["src/features/scrapers/autoscout24_collector"], { workflows: ["autoscout24-collector.yml"] }),
  job("elferspot", "elferspot", "Elferspot Collector", "discovery", ["Elferspot"], ["src/features/scrapers/elferspot_collector"]),
  job("bat-detail", "bat-detail", "BaT Detail Scraper", "enrichment", ["BaT"], ["scripts/bat-detail-scraper.ts"], { cadence: "external", workflows: ["bat-detail-scraper.yml"] }),
  job("as24-enrich", "as24-enrich", "AutoScout24 Enrichment", "enrichment", ["AutoScout24"], ["scripts/as24-enrich-scrapling.ts"], { cadence: "external", workflows: ["autoscout24-enrich.yml"] }),
  job("classic-enrich", "classic-enrich", "Classic.com Enrichment", "enrichment", ["ClassicCom"], ["scripts/classic-enrich-scrapling.ts"], { cadence: "external", workflows: ["classic-enrich.yml"] }),
  job("enrich-autotrader", "enrich-autotrader", "AutoTrader Enrichment", "enrichment", ["AutoTrader"], ["scripts/autotrader-enrich.ts"], { cadence: "external", workflows: ["autotrader-enrich.yml"] }),
  job("enrich-beforward", "enrich-beforward", "BeForward Enrichment", "enrichment", ["BeForward"], ["src/app/api/cron/enrich-beforward"], { workflows: ["beforward-enrich.yml"], cronPath: "/api/cron/enrich-beforward" }),
  job("enrich-elferspot", "enrich-elferspot", "Elferspot Enrichment", "enrichment", ["Elferspot"], ["src/app/api/cron/enrich-elferspot"], { cronPath: "/api/cron/enrich-elferspot" }),
  job("enrich-details", "enrich-details", "AS24 Detail Enrichment", "enrichment", ["AutoScout24"], ["src/app/api/cron/enrich-details"], { cronPath: "/api/cron/enrich-details" }),
  job("enrich-details-bulk", "enrich-details-bulk", "AS24 Bulk Detail Enrichment", "enrichment", ["AutoScout24"], ["scripts/as24-enrich-scrapling.ts"], { cadence: "external" }),
  job("backfill-images", "backfill-images", "Image Backfill", "enrichment", ["BeForward", "ClassicCom"], ["src/features/scrapers/common/backfillImages.ts"], { workflows: ["beforward-backfill-images.yml", "classic-backfill-images.yml"], cronPath: "/api/cron/backfill-images" }),
  job("backfill-photos-elferspot", "backfill-photos-elferspot", "Elferspot Photo Backfill", "enrichment", ["Elferspot"], ["src/app/api/cron/backfill-photos-elferspot"], { cronPath: "/api/cron/backfill-photos-elferspot" }),
  job("enrich-vin", "enrich-vin", "VIN Enrichment", "maintenance", ASSURANCE_SOURCES.map((source) => source.id), ["src/app/api/cron/enrich-vin"], { cronPath: "/api/cron/enrich-vin" }),
  job("enrich-titles", "enrich-titles", "Title Enrichment", "maintenance", ASSURANCE_SOURCES.map((source) => source.id), ["src/app/api/cron/enrich-titles"], { cronPath: "/api/cron/enrich-titles" }),
  job("validate", "validate", "Listing Validator", "maintenance", ASSURANCE_SOURCES.map((source) => source.id), ["src/app/api/cron/validate"], { cronPath: "/api/cron/validate" }),
  job("cleanup", "cleanup", "Cleanup", "maintenance", ASSURANCE_SOURCES.map((source) => source.id), ["src/app/api/cron/cleanup"], { cronPath: "/api/cron/cleanup", destructive: true }),
  job("liveness-check", "liveness-check", "Liveness Check", "post-run", ["AutoScout24", "AutoTrader", "BeForward", "ClassicCom", "Elferspot"], ["src/features/scrapers/liveness_checker"], { cadence: "external", workflows: ["liveness-checker.yml"], destructive: true }),
  job("autotrader-delist-check", "autotrader-delist-check", "AutoTrader Delist Check", "post-run", ["AutoTrader"], ["scripts/autotrader-delist-check.ts"], { cadence: "external", destructive: true }),
  job("health-audit", "health-audit", "Scraper Health Audit", "post-run", ASSURANCE_SOURCES.map((source) => source.id), ["scripts/scraper-health-audit.ts"], { cadence: "external" }),
  job("enrichment-loop", "enrich-details-bulk", "Enrichment Loop", "enrichment", ASSURANCE_SOURCES.map((source) => source.id), ["scripts/run-scrapers.ts"], { cadence: "external", workflows: ["enrichment-loop.yml"] }),
  job("refresh-valuation-factors", "refresh-valuation-factors", "Valuation Factor Refresh", "maintenance", ASSURANCE_SOURCES.map((source) => source.id), ["src/app/api/cron/refresh-valuation-factors"], { cronPath: "/api/cron/refresh-valuation-factors" }),
  job("social-engine", "social-engine", "Social Engine Worker", "post-run", ASSURANCE_SOURCES.map((source) => source.id), ["src/features/social-engine"], { cadence: "external" }),
] as const;

export const ASSURANCE_AUDIT_JOB_SPECS: ScraperJobSpec[] = SCRAPER_JOBS
  .filter((candidate) => !["enrichment-loop", "health-audit"].includes(candidate.id))
  .map((candidate) => ({
    scraperName: candidate.scraperName as ScraperName,
    label: candidate.label,
    cadence: candidate.cadence,
    cronPath: candidate.cronPath,
  }));

export const ASSURANCE_RUNNER_JOB_MAP: Readonly<Record<string, string>> = {
  porsche: "porsche",
  ferrari: "ferrari",
  beforward: "beforward",
  classic: "classic",
  as24: "autoscout24",
  elferspot: "elferspot",
  autotrader: "autotrader",
  "bat-detail": "bat-detail",
  "classic-enrich": "classic-enrich",
  "as24-enrich": "as24-enrich",
  "at-enrich": "enrich-autotrader",
  "classic-images": "backfill-images",
  "bf-images": "backfill-images",
  "cron-beforward-enrich": "enrich-beforward",
  "cron-elferspot-enrich": "enrich-elferspot",
  "cron-enrich-details": "enrich-details",
  "cron-backfill-photos-elferspot": "backfill-photos-elferspot",
  "cron-validate": "validate",
  "cron-cleanup": "cleanup",
  "cron-vin": "enrich-vin",
  "cron-titles": "enrich-titles",
  "cron-images": "backfill-images",
  "cron-refresh-valuation": "refresh-valuation-factors",
  "at-delist-check": "autotrader-delist-check",
  liveness: "liveness-check",
  "health-audit": "health-audit",
};

export function validateRunnerInventory(runnerIds: readonly string[]): string[] {
  const manifestJobIds = new Set(SCRAPER_JOBS.map((candidate) => candidate.id));
  const errors: string[] = [];
  for (const runnerId of runnerIds) {
    const jobId = ASSURANCE_RUNNER_JOB_MAP[runnerId];
    if (!jobId) errors.push(`Runner job is absent from assurance manifest: ${runnerId}`);
    else if (!manifestJobIds.has(jobId)) errors.push(`Runner job ${runnerId} maps to unknown assurance job: ${jobId}`);
  }
  for (const runnerId of Object.keys(ASSURANCE_RUNNER_JOB_MAP)) {
    if (!runnerIds.includes(runnerId)) errors.push(`Assurance runner mapping is stale: ${runnerId}`);
  }
  return errors.sort();
}

export function isDestructiveRunnerJob(runnerId: string): boolean {
  const jobId = ASSURANCE_RUNNER_JOB_MAP[runnerId];
  return SCRAPER_JOBS.find((candidate) => candidate.id === jobId)?.destructive ?? true;
}

const FEATURE_DIRECTORIES = [
  "auctions",
  "autoscout24_collector",
  "autotrader_collector",
  "beforward_porsche_collector",
  "classic_collector",
  "common",
  "elferspot_collector",
  "ferrari_collector",
  "ferrari_history",
  "liveness_checker",
  "porsche_collector",
  "porsche_ingest",
] as const;

export function getSourceIdsForScraper(scraperName: string): AssuranceSourceId[] {
  return Array.from(new Set(
    SCRAPER_JOBS
      .filter((candidate) => candidate.scraperName === scraperName)
      .flatMap((candidate) => candidate.sourceIds),
  ));
}

export function getAssuranceSource(sourceId: string): AssuranceSource | undefined {
  return ASSURANCE_SOURCES.find((source) => source.id === sourceId);
}

export function getScraperNamesForSource(sourceId: AssuranceSourceId): ScraperName[] {
  const source = getAssuranceSource(sourceId);
  if (!source) return [];
  const jobIds = new Set([...source.collectorJobIds, ...source.enrichmentJobIds]);
  return Array.from(new Set(
    SCRAPER_JOBS
      .filter((candidate) => jobIds.has(candidate.id))
      .map((candidate) => candidate.scraperName as ScraperName),
  ));
}

export function validateAssuranceManifest(rootDir: string): string[] {
  const errors: string[] = [];
  const jobIds = SCRAPER_JOBS.map((candidate) => candidate.id);
  if (new Set(jobIds).size !== jobIds.length) errors.push("Duplicate assurance job id");

  const knownJobIds = new Set(jobIds);
  for (const source of ASSURANCE_SOURCES) {
    for (const jobId of [...source.collectorJobIds, ...source.enrichmentJobIds]) {
      if (!knownJobIds.has(jobId)) errors.push(`${source.id} references unknown job ${jobId}`);
    }
  }

  for (const candidate of SCRAPER_JOBS) {
    for (const codePath of candidate.codePaths) {
      if (!existsSync(path.join(rootDir, codePath))) errors.push(`${candidate.id} path missing: ${codePath}`);
    }
  }

  const workflowDir = path.join(rootDir, ".github", "workflows");
  const actualWorkflows = readdirSync(workflowDir).filter((name) => /\.ya?ml$/i.test(name)).sort();
  const declaredWorkflows = Array.from(new Set(SCRAPER_JOBS.flatMap((candidate) => candidate.workflowFiles))).sort();
  for (const name of actualWorkflows) {
    if (!declaredWorkflows.includes(name)) errors.push(`Unregistered workflow: ${name}`);
  }
  for (const name of declaredWorkflows) {
    if (!actualWorkflows.includes(name)) errors.push(`Declared workflow missing: ${name}`);
  }

  const scraperDir = path.join(rootDir, "src", "features", "scrapers");
  const actualDirectories = readdirSync(scraperDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort();
  for (const name of actualDirectories) {
    if (!FEATURE_DIRECTORIES.includes(name as (typeof FEATURE_DIRECTORIES)[number])) {
      errors.push(`Unregistered scraper feature directory: ${name}`);
    }
  }
  for (const name of FEATURE_DIRECTORIES) {
    if (!actualDirectories.includes(name)) errors.push(`Declared scraper feature directory missing: ${name}`);
  }

  return errors.sort();
}
