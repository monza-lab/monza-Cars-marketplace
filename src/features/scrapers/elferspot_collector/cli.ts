import { existsSync, readFileSync } from "node:fs"
import { resolve as resolvePath } from "node:path"
import { runElferspotCollector } from "./collector"
import type { CollectorRunConfig } from "./types"

function loadEnvFromFile(relPath: string): void {
  const abs = resolvePath(process.cwd(), relPath)
  if (!existsSync(abs)) return
  const raw = readFileSync(abs, "utf8")
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const eq = trimmed.indexOf("=")
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    if (!key || process.env[key] !== undefined) continue
    let value = trimmed.slice(eq + 1).trim()
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'")))
      value = value.slice(1, -1)
    process.env[key] = value
  }
}

function parseArgv(argv: string[]): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {}
  for (const raw of argv) {
    if (!raw.startsWith("--")) continue
    const trimmed = raw.slice(2)
    const eq = trimmed.indexOf("=")
    if (eq === -1) { out[trimmed] = true; continue }
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1)
  }
  return out
}

async function main() {
  loadEnvFromFile(".env.local")
  loadEnvFromFile(".env")

  const args = parseArgv(process.argv.slice(2))

  if (args.help) {
    console.log([
      "Elferspot Collector CLI",
      "",
      "Usage:",
      "  npx tsx src/features/scrapers/elferspot_collector/cli.ts [flags]",
      "",
      "Flags:",
      "  --maxPages=25          Max search pages (default: 25)",
      "  --maxListings=3500     Max listings (default: 3500)",
      "  --scrapeDetails        Fetch detail pages (default: false)",
      "  --delayMs=10000        Delay between requests in ms (default: 10000)",
      "  --dryRun               Skip DB writes",
      "  --language=en          Site language: en, de, nl, fr (default: en)",
      "  --fresh                Reset page counter, start from page 1 (keeps dedup IDs)",
      "  --checkpointPath=...   Resume file",
      "  --outputPath=...       JSONL output file",
      "  --help                 Show this help",
    ].join("\n"))
    process.exit(0)
  }

  const config: CollectorRunConfig = {
    maxPages: Number(args.maxPages) || 25,
    maxListings: Number(args.maxListings) || 3500,
    scrapeDetails: args.scrapeDetails === true,
    delayMs: Number(args.delayMs) || 10_000,
    checkpointPath: String(args.checkpointPath || "var/elferspot_collector/checkpoint.json"),
    outputPath: String(args.outputPath || "var/elferspot_collector/listings.jsonl"),
    dryRun: args.dryRun === true,
    language: (String(args.language || "en")) as CollectorRunConfig["language"],
    fresh: args.fresh === true,
  }

  console.log("[elferspot] Config:", JSON.stringify(config, null, 2))
  const result = await runElferspotCollector(config)
  console.log("[elferspot] Result:", JSON.stringify(result, null, 2))

  process.exit(result.counts.errors > 0 ? 1 : 0)
}

main().catch(err => {
  console.error("[elferspot] Fatal:", err)
  process.exit(1)
})
