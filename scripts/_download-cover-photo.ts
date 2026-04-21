#!/usr/bin/env tsx
/** Download the highest-quality photo of a given listing to /tmp/reel-bg.jpg */
import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { filterRealPhotoUrls, resolveHighQualityUrl } from "../src/features/social-engine/services/photoValidator";

function loadEnv(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    if (!k || process.env[k] !== undefined) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[k] = v;
  }
}
loadEnv(path.resolve(process.cwd(), ".env.local"));

const LISTING_ID = process.argv[2] ?? "092bdc2c-2522-415c-b2f0-af83f756bc5b"; // 1986 Porsche 930
const OUT = process.argv[3] ?? "/tmp/reel-bg.jpg";
const PHOTO_INDEX = parseInt(process.argv[4] ?? "0", 10);

async function main() {
  const supa = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
  const { data, error } = await supa.from("listings").select("id, title, year, model, images").eq("id", LISTING_ID).single();
  if (error || !data) throw new Error(`listing not found: ${error?.message}`);

  console.log(`Listing: ${data.year} ${data.model} — ${data.title}`);
  const real = filterRealPhotoUrls(data.images ?? []);
  console.log(`  real photos: ${real.length}`);

  const targetIdx = Math.min(PHOTO_INDEX, real.length - 1);
  const base = real[targetIdx];
  const resolved = await resolveHighQualityUrl(base, 150_000);
  const finalUrl = resolved ?? base;
  console.log(`  downloading photo[${targetIdx}] → ${finalUrl.slice(0, 100)}...`);

  const r = await fetch(finalUrl);
  if (!r.ok) throw new Error(`fetch failed: ${r.status}`);
  const buf = Buffer.from(await r.arrayBuffer());
  writeFileSync(OUT, buf);
  console.log(`  saved to ${OUT} (${(buf.length / 1024).toFixed(0)} KB)`);
}

main().catch((e) => { console.error(e); process.exit(1); });
