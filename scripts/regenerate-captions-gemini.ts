#!/usr/bin/env tsx
/**
 * Regenerate caption.txt for all posts in a monzahaus-posts batch using Gemini.
 * Rewrites in place — does not touch slides or listing-info.md.
 *
 * Usage:
 *   npx tsx scripts/regenerate-captions-gemini.ts [batch-dir]
 *
 * Defaults to ~/Downloads/monzahaus-posts/<today>/
 */

import { promises as fs, existsSync, readFileSync } from "fs";
import path from "path";

function loadEnvFromFile(filePath: string): void {
  if (!existsSync(filePath)) return;
  const raw = readFileSync(filePath, "utf8");
  for (const line of raw.split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const idx = t.indexOf("=");
    if (idx === -1) continue;
    const k = t.slice(0, idx).trim();
    if (!k || process.env[k] !== undefined) continue;
    let v = t.slice(idx + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnvFromFile(path.resolve(process.cwd(), ".env.local"));
loadEnvFromFile(path.resolve(process.cwd(), ".env"));

// generateJson loaded dynamically inside main() after env is populated.

const SYSTEM_PROMPT = `You write Instagram captions for MonzaHaus, an art-gallery salon for collector cars.

Tone: authoritative, warm, concise. Investment-minded.
Say "collector vehicle" not "old car". "Investment thesis" not "opinion". "Provenance" not "history". "Acquisition" not "purchase".
Never use emojis, urgency ("buy now"), guaranteed returns, or "link in bio".
Always write in English, never Spanish.

Output format: 4-6 short lines, around 70-110 words total:
- Line 1: Year Make Model · variant/spec (as title, no punctuation at end)
- Line 2-3: one-sentence hook about what makes this example notable
- Line 4-5: market/thesis insight with a specific data point
- Final block:
  → Acquisition: $<price>
  → Location: <location>
  → Platform: <platform>
  Full market report → <url>
  <3-5 hashtags starting with #MonzaHaus>`;

function parseListingInfo(md: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of md.split("\n")) {
    const m = line.match(/^- \*\*([^*]+)\*\*:\s*(.+)$/);
    if (m) out[m[1].trim()] = m[2].trim().replace(/^`|`$/g, "");
  }
  // First # line is the title
  const title = md.match(/^#\s+(.+)$/m);
  if (title) out["Title"] = title[1].trim();
  return out;
}

type AnalyzeWithGemini = typeof import("../src/lib/ai/gemini").analyzeWithGemini;

async function regenerateCaption(postDir: string, analyzeWithGemini: AnalyzeWithGemini): Promise<boolean> {
  const infoPath = path.join(postDir, "listing-info.md");
  if (!existsSync(infoPath)) {
    console.log(`  [skip] no listing-info.md in ${path.basename(postDir)}`);
    return false;
  }
  const info = parseListingInfo(await fs.readFile(infoPath, "utf-8"));

  const userPrompt = `Write a MonzaHaus carousel caption for this listing:

Title: ${info["Title"] ?? ""}
Year: ${info["Year"] ?? "?"}
Make / Model / Trim: ${info["Make / Model / Trim"] ?? ""}
Engine: ${info["Engine"] ?? "—"}
Transmission: ${info["Transmission"] ?? "—"}
Mileage: ${info["Mileage"] ?? "—"}
Exterior color: ${info["Exterior color"] ?? "—"}
Price: ${info["Price (asking/bid)"] ?? "—"}
Platform: ${info["Platform"] ?? "—"}
Location: ${info["Location"] ?? "—"}
Report URL: ${info["Listing URL on MonzaHaus"] ?? ""}

Output: the caption text only, as plain text. No JSON, no code fences, no commentary.`;

  let raw: string;
  try {
    raw = await analyzeWithGemini(SYSTEM_PROMPT, userPrompt);
  } catch (err) {
    console.log(`  [fail] ${path.basename(postDir)}: ${(err as Error).message}`);
    return false;
  }

  const cleaned = raw.replace(/^```[a-z]*\s*/i, "").replace(/```\s*$/i, "").trim();
  if (!cleaned) {
    console.log(`  [fail] ${path.basename(postDir)}: empty response`);
    return false;
  }

  const outPath = path.join(postDir, "caption.txt");
  await fs.writeFile(outPath, cleaned + "\n", "utf-8");
  console.log(`  ✓ ${path.basename(postDir)}`);
  return true;
}

async function main() {
  const { analyzeWithGemini } = await import("../src/lib/ai/gemini");

  const today = new Date().toISOString().slice(0, 10);
  const defaultDir = path.join(process.env.HOME ?? "", "Downloads", "monzahaus-posts", today);
  const batchDir = process.argv[2] ?? defaultDir;

  if (!existsSync(batchDir)) {
    console.error(`Batch dir not found: ${batchDir}`);
    process.exit(1);
  }

  console.log(`Regenerating captions in: ${batchDir}`);
  const entries = await fs.readdir(batchDir, { withFileTypes: true });
  const postDirs = entries
    .filter((e) => e.isDirectory() && /^\d{2}-/.test(e.name))
    .map((e) => path.join(batchDir, e.name))
    .sort();

  console.log(`Found ${postDirs.length} post folders\n`);

  let ok = 0;
  for (const d of postDirs) {
    const success = await regenerateCaption(d, analyzeWithGemini);
    // tiny delay to avoid 503 throttling
    await new Promise((r) => setTimeout(r, 800));
    if (success) ok += 1;
  }

  console.log(`\nDone. ${ok}/${postDirs.length} captions regenerated.`);
}

main().catch((err) => {
  console.error("Failed:", err);
  process.exit(1);
});
