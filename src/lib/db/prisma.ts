import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

function createPgPool(connectionString: string, sslDisabled: boolean) {
  return new Pool({
    connectionString,
    max: 1,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
    // Supabase poolers on serverless environments may present a cert chain
    // that Node cannot validate with default trust settings.
    ssl: sslDisabled ? undefined : { rejectUnauthorized: false },
  })
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
  prismaPool: ReturnType<typeof createPgPool> | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for Prisma runtime')
  }

  const sslDisabled = /sslmode=disable/i.test(connectionString)

  // Keep pool small for serverless and reduce pgbouncer churn.
  const pool = globalForPrisma.prismaPool ?? createPgPool(connectionString, sslDisabled)
  globalForPrisma.prismaPool = pool

  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

function getPrismaClient() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createPrismaClient()
  }
  return globalForPrisma.prisma
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop, receiver) {
    const client = getPrismaClient() as unknown as Record<PropertyKey, unknown>
    const value = Reflect.get(client, prop, receiver)
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  },
})
