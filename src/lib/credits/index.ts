import { dbQuery, withTransaction } from '../db/sql'

const FREE_CREDITS_PER_MONTH = 3

type UserRow = {
  id: string
  supabaseId: string
  email: string
  name: string | null
  creditsBalance: number
  freeCreditsUsed: number
  creditResetDate: Date
  tier: 'FREE' | 'PRO'
}

async function getUserBySupabaseId(supabaseId: string) {
  const result = await dbQuery<UserRow>('SELECT * FROM "User" WHERE "supabaseId" = $1 LIMIT 1', [supabaseId])
  return result.rows[0] ?? null
}

async function getUserByEmail(email: string) {
  const result = await dbQuery<UserRow>('SELECT * FROM "User" WHERE email = $1 LIMIT 1', [email])
  return result.rows[0] ?? null
}

export async function getOrCreateUser(supabaseId: string, email: string, name?: string) {
  let user = await getUserBySupabaseId(supabaseId)
  if (user) return user

  user = await getUserByEmail(email)
  if (user) {
    if (user.supabaseId !== supabaseId) {
      const updated = await dbQuery<UserRow>(
        'UPDATE "User" SET "supabaseId" = $1, "updatedAt" = NOW() WHERE email = $2 RETURNING *',
        [supabaseId, email],
      )
      return updated.rows[0]
    }
    return user
  }

  try {
    const inserted = await dbQuery<UserRow>(
      `
        INSERT INTO "User" (
          id, "supabaseId", email, name,
          "creditsBalance", "freeCreditsUsed", "creditResetDate", tier,
          "createdAt", "updatedAt"
        )
        VALUES (gen_random_uuid()::text, $1, $2, $3, $4, 0, NOW(), 'FREE', NOW(), NOW())
        RETURNING *
      `,
      [supabaseId, email, name ?? null, FREE_CREDITS_PER_MONTH],
    )
    user = inserted.rows[0]

    await dbQuery(
      `
        INSERT INTO "CreditTransaction" ("userId", amount, type, description)
        VALUES ($1, $2, 'FREE_MONTHLY', 'Welcome credits')
      `,
      [user.id, FREE_CREDITS_PER_MONTH],
    )
  } catch (e) {
    const code = typeof e === 'object' && e && 'code' in e ? String((e as { code?: unknown }).code) : ''
    if (code === '23505') {
      user = (await getUserBySupabaseId(supabaseId)) ?? (await getUserByEmail(email))
    }
    if (!user) throw e
  }

  return user
}

export async function checkAndResetFreeCredits(userId: string) {
  const currentResult = await dbQuery<UserRow>('SELECT * FROM "User" WHERE id = $1 LIMIT 1', [userId])
  const user = currentResult.rows[0]
  if (!user) return null

  const now = new Date()
  const resetDate = new Date(user.creditResetDate)
  const monthsSinceReset =
    (now.getFullYear() - resetDate.getFullYear()) * 12 +
    (now.getMonth() - resetDate.getMonth())

  if (monthsSinceReset < 1) return user

  const updatedResult = await dbQuery<UserRow>(
    `
      UPDATE "User"
      SET "creditsBalance" = "creditsBalance" + $2,
          "freeCreditsUsed" = 0,
          "creditResetDate" = $3,
          "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, FREE_CREDITS_PER_MONTH, now],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description)
      VALUES ($1, $2, 'FREE_MONTHLY', $3)
    `,
    [
      userId,
      FREE_CREDITS_PER_MONTH,
      `Monthly free credits - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
    ],
  )

  return updatedResult.rows[0] ?? user
}

export async function getUserCredits(supabaseId: string) {
  const user = await getUserBySupabaseId(supabaseId)
  if (!user) return null
  return checkAndResetFreeCredits(user.id)
}

export async function hasAlreadyAnalyzed(userId: string, auctionId: string) {
  const existing = await dbQuery<{ id: string }>(
    'SELECT id FROM "UserAnalysis" WHERE "userId" = $1 AND "auctionId" = $2 LIMIT 1',
    [userId, auctionId],
  )
  return !!existing.rows[0]
}

type DeductCreditResult =
  | { success: false; error: string; creditUsed?: never; cached?: never }
  | { success: true; creditUsed: number; cached: boolean; error?: never }

export async function deductCredit(userId: string, auctionId: string): Promise<DeductCreditResult> {
  const userResult = await dbQuery<UserRow>('SELECT * FROM "User" WHERE id = $1 LIMIT 1', [userId])
  const user = userResult.rows[0]

  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND' }
  }

  const alreadyAnalyzed = await hasAlreadyAnalyzed(userId, auctionId)
  if (alreadyAnalyzed) {
    return { success: true, creditUsed: 0, cached: true }
  }

  if (user.creditsBalance < 1) {
    return { success: false, error: 'INSUFFICIENT_CREDITS' }
  }

  try {
    await withTransaction(async (client) => {
      await client.query(
        `
          UPDATE "User"
          SET "creditsBalance" = "creditsBalance" - 1,
              "freeCreditsUsed" = "freeCreditsUsed" + $2,
              "updatedAt" = NOW()
          WHERE id = $1
        `,
        [userId, user.tier === 'FREE' ? 1 : 0],
      )

      await client.query(
        `
          INSERT INTO "CreditTransaction" ("userId", amount, type, description)
          VALUES ($1, -1, 'ANALYSIS_USED', $2)
        `,
        [userId, `Analysis for auction ${auctionId}`],
      )

      await client.query(
        `
          INSERT INTO "UserAnalysis" ("userId", "auctionId", "creditCost")
          VALUES ($1, $2, 1)
        `,
        [userId, auctionId],
      )
    })
  } catch (error) {
    const code = typeof error === 'object' && error && 'code' in error ? String((error as { code?: unknown }).code) : ''
    if (code === '23505') {
      return { success: true, creditUsed: 0, cached: true }
    }
    throw error
  }

  return { success: true, creditUsed: 1, cached: false }
}

export async function addPurchasedCredits(
  userId: string,
  amount: number,
  stripePaymentId?: string,
) {
  const updated = await dbQuery<UserRow>(
    `
      UPDATE "User"
      SET "creditsBalance" = "creditsBalance" + $2,
          "updatedAt" = NOW()
      WHERE id = $1
      RETURNING *
    `,
    [userId, amount],
  )

  await dbQuery(
    `
      INSERT INTO "CreditTransaction" ("userId", amount, type, description, "stripePaymentId")
      VALUES ($1, $2, 'PURCHASE', $3, $4)
    `,
    [userId, amount, `Purchased ${amount} credits`, stripePaymentId ?? null],
  )

  return updated.rows[0] ?? null
}

export async function getTransactionHistory(userId: string, limit = 20) {
  const transactions = await dbQuery<Record<string, unknown>>(
    'SELECT * FROM "CreditTransaction" WHERE "userId" = $1 ORDER BY "createdAt" DESC LIMIT $2',
    [userId, limit],
  )

  return transactions.rows
}
