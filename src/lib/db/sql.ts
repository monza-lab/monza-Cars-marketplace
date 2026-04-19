import { Pool } from 'pg'

type GlobalPool = {
  dbPool?: InstanceType<typeof Pool>
}

const globalForDb = globalThis as unknown as GlobalPool

function createPool() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required')
  }

  const sslDisabled = /sslmode=disable/i.test(connectionString)

  // NOTE: Do NOT pin `family: 4`. Supabase direct connections now only publish
  // an AAAA (IPv6) record for `db.<ref>.supabase.co`, so forcing IPv4 causes
  // every connection to time out. Use whatever address family DNS returns.
  // For environments without IPv6 egress (e.g. Vercel), set DATABASE_URL to
  // the Transaction Pooler URL (`aws-0-<region>.pooler.supabase.com:6543`).
  return new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
  })
}

export function getPool() {
  if (!globalForDb.dbPool) {
    globalForDb.dbPool = createPool()
  }
  return globalForDb.dbPool
}

export async function dbQuery<T>(text: string, values: unknown[] = []) {
  const result = await getPool().query(text, values)
  return result as { rows: T[]; rowCount: number | null }
}

export async function withTransaction<T>(runner: (client: { query: (text: string, values?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }> }) => Promise<T>) {
  const client = await getPool().connect()
  try {
    await client.query('BEGIN')
    const result = await runner(client)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
