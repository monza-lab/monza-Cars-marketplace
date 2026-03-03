import { setDefaultResultOrder } from 'node:dns'
import { Pool } from 'pg'

setDefaultResultOrder('ipv4first')

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

  return new Pool({
    connectionString,
    family: 4,
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
