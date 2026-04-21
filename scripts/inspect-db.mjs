import { readFileSync } from "node:fs"
import pg from "pg"

// Load DATABASE_URL from .env.local without printing it.
const env = readFileSync(".env.local", "utf8")
for (const line of env.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "")
}
if (!process.env.DATABASE_URL) { console.error("DATABASE_URL missing"); process.exit(1) }

const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()

async function q(sql, params = []) {
  const r = await client.query(sql, params)
  return r.rows
}

console.log("── Advisor-relevant tables ──")
const advisorLikeTables = await q(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public'
    AND (table_name ILIKE '%credit%' OR table_name ILIKE '%advisor%' OR table_name ILIKE '%conversation%' OR table_name ILIKE 'user_%')
  ORDER BY table_name;
`)
for (const r of advisorLikeTables) console.log(" ", r.table_name)

async function cols(table) {
  const rows = await q(`
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns WHERE table_schema='public' AND table_name=$1
    ORDER BY ordinal_position;
  `, [table])
  return rows
}

console.log("\n── user_credits columns ──")
for (const c of await cols("user_credits")) console.log(" ", c.column_name, "·", c.data_type, c.is_nullable === "NO" ? "NOT NULL" : "")

console.log("\n── credit_transactions columns ──")
for (const c of await cols("credit_transactions")) console.log(" ", c.column_name, "·", c.data_type, c.is_nullable === "NO" ? "NOT NULL" : "")

console.log("\n── credit_transactions.type CHECK constraint ──")
const ck = await q(`
  SELECT pg_get_constraintdef(c.oid) AS def
  FROM pg_constraint c JOIN pg_class t ON t.oid = c.conrelid
  WHERE t.relname='credit_transactions' AND c.conname LIKE '%type%';
`)
for (const r of ck) console.log(" ", r.def)

console.log("\n── Do advisor_* tables already exist? ──")
const existing = await q(`
  SELECT table_name FROM information_schema.tables
  WHERE table_schema='public' AND table_name ILIKE 'advisor_%' ORDER BY table_name;
`)
console.log("  count:", existing.length)
for (const r of existing) console.log(" ", r.table_name)

console.log("\n── RLS state on user_credits + credit_transactions ──")
const rls = await q(`
  SELECT c.relname AS table, c.relrowsecurity AS rls_enabled
  FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname='public' AND c.relname IN ('user_credits','credit_transactions','user_reports');
`)
for (const r of rls) console.log(" ", r.table, "· RLS", r.rls_enabled ? "ON" : "OFF")

console.log("\n── Row counts (sanity) ──")
for (const t of ["user_credits", "credit_transactions", "user_reports"]) {
  const [{ count }] = await q(`SELECT count(*)::int AS count FROM public.${t};`)
  console.log(` ${t} · ${count} rows`)
}

await client.end()
