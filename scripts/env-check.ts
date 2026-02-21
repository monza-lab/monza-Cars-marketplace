import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { EnvSchema } from "../src/features/porsche_ingest/contracts/config";

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    if (!key || process.env[key] !== undefined) continue;
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFromFile(path.resolve(process.cwd(), ".env"));

const artifactDir = path.resolve(process.cwd(), "agents/testscripts/artifacts");
mkdirSync(artifactDir, { recursive: true });

const lines = [
  `node: ${process.version}`,
  `platform: ${process.platform}`,
  `arch: ${process.arch}`,
  `cwd: ${process.cwd()}`,
  `time: ${new Date().toISOString()}`,
];

const envCheck = EnvSchema.safeParse(process.env);
if (!envCheck.success) {
  lines.push("env: FAIL");
  for (const issue of envCheck.error.issues) lines.push(`- ${issue.path.join(".")}: ${issue.message}`);
  writeFileSync(path.join(artifactDir, "env-matrix.md"), lines.join("\n") + "\n", "utf8");
  throw new Error("Environment validation failed");
}

lines.push("env: PASS");
writeFileSync(path.join(artifactDir, "env-matrix.md"), lines.join("\n") + "\n", "utf8");
console.log("agents/testscripts/artifacts/env-matrix.md");
