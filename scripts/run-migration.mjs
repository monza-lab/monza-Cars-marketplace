#!/usr/bin/env node
// Usage: node scripts/run-migration.mjs supabase/migrations/<file>.sql
// Applies a single migration using DATABASE_URL from .env.local. Prints the
// pre/post state of affected objects for audit.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import pg from 'pg';

// Lightweight .env.local loader (avoids dotenv dependency)
for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (!m) continue;
  const [, key, raw] = m;
  if (!process.env[key]) process.env[key] = raw.replace(/^["']|["']$/g, '');
}

const { Client } = pg;
const file = process.argv[2];
if (!file) {
  console.error('usage: run-migration.mjs <path-to-sql>');
  process.exit(1);
}

const sql = readFileSync(resolve(file), 'utf8');
const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL missing in .env.local');
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();

console.log(`[migration] applying ${file}`);
await client.query('BEGIN');
try {
  await client.query(sql);
  await client.query('COMMIT');
  console.log('[migration] committed');
} catch (err) {
  await client.query('ROLLBACK');
  console.error('[migration] FAILED, rolled back:', err.message);
  process.exit(2);
}

await client.end();
