import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Client } from "pg";

(() => {
  try {
    const txt = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of txt.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/i);
      if (!m) continue;
      if (process.env[m[1]]) continue;
      process.env[m[1]] = m[2].replace(/^"|"$/g, "").replace(/^'|'$/g, "");
    }
  } catch {}
})();

(async () => {
  const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
  await c.connect();
  const t0 = Date.now();
  await c.query("REFRESH MATERIALIZED VIEW listings_active_counts");
  console.log(`refresh — ${Date.now() - t0}ms`);
  const { rows } = await c.query(
    "SELECT count(*) FILTER (WHERE series <> '__null') AS distinct_series, sum(live_count) AS total FROM listings_active_counts",
  );
  console.log(JSON.stringify(rows[0]));
  await c.end();
})();
