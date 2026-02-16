import { prisma } from '../db/prisma'

const FREE_CREDITS_PER_MONTH = 3

/**
 * Get or create user by Supabase ID
 */
export async function getOrCreateUser(supabaseId: string, email: string, name?: string) {
  // 1. Look up by supabaseId first
  let user = await prisma.user.findUnique({ where: { supabaseId } })
  if (user) return user

  // 2. Check by email (handles Supabase identity linking / provider changes)
  user = await prisma.user.findUnique({ where: { email } })
  if (user) {
    // Email exists but supabaseId differs — update to new Supabase identity
    if (user.supabaseId !== supabaseId) {
      user = await prisma.user.update({
        where: { email },
        data: { supabaseId },
      })
    }
    return user
  }

  // 3. Create new user
  try {
    user = await prisma.user.create({
      data: {
        supabaseId,
        email,
        name,
        creditsBalance: FREE_CREDITS_PER_MONTH,
        freeCreditsUsed: 0,
        creditResetDate: new Date(),
        transactions: {
          create: {
            amount: FREE_CREDITS_PER_MONTH,
            type: 'FREE_MONTHLY',
            description: 'Welcome credits',
          },
        },
      },
    })
  } catch (e: unknown) {
    // Race condition: another concurrent request created the user first
    if (e instanceof Error && 'code' in e && (e as { code: string }).code === 'P2002') {
      user = await prisma.user.findUnique({ where: { supabaseId } })
        ?? await prisma.user.findUnique({ where: { email } })
    }
    if (!user) throw e
  }

  return user!
}

/**
 * Check if monthly reset is needed and apply free credits
 */
export async function checkAndResetFreeCredits(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) return null

  const now = new Date()
  const resetDate = new Date(user.creditResetDate)
  const monthsSinceReset =
    (now.getFullYear() - resetDate.getFullYear()) * 12 +
    (now.getMonth() - resetDate.getMonth())

  if (monthsSinceReset >= 1) {
    // Reset free credits for new month
    const updatedUser = await prisma.user.update({
      where: { id: userId },
      data: {
        creditsBalance: {
          increment: FREE_CREDITS_PER_MONTH,
        },
        freeCreditsUsed: 0,
        creditResetDate: now,
        transactions: {
          create: {
            amount: FREE_CREDITS_PER_MONTH,
            type: 'FREE_MONTHLY',
            description: `Monthly free credits - ${now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`,
          },
        },
      },
    })

    return updatedUser
  }

  return user
}

/**
 * Get user credits info
 */
export async function getUserCredits(supabaseId: string) {
  const user = await prisma.user.findUnique({
    where: { supabaseId },
    select: {
      id: true,
      creditsBalance: true,
      freeCreditsUsed: true,
      tier: true,
      creditResetDate: true,
    },
  })

  if (!user) return null

  // Check for monthly reset
  const refreshedUser = await checkAndResetFreeCredits(user.id)

  return refreshedUser
}

/**
 * Check if user has already analyzed this auction (no credit needed)
 */
export async function hasAlreadyAnalyzed(userId: string, auctionId: string) {
  const existing = await prisma.userAnalysis.findUnique({
    where: {
      userId_auctionId: {
        userId,
        auctionId,
      },
    },
  })

  return !!existing
}

type DeductCreditResult =
  | { success: false; error: string; creditUsed?: never; cached?: never }
  | { success: true; creditUsed: number; cached: boolean; error?: never }

/**
 * Deduct credit for analysis
 */
export async function deductCredit(userId: string, auctionId: string): Promise<DeductCreditResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  })

  if (!user) {
    return { success: false, error: 'USER_NOT_FOUND' }
  }

  // Check if already analyzed (no credit needed)
  const alreadyAnalyzed = await hasAlreadyAnalyzed(userId, auctionId)
  if (alreadyAnalyzed) {
    return { success: true, creditUsed: 0, cached: true }
  }

  // Check credit balance
  if (user.creditsBalance < 1) {
    return { success: false, error: 'INSUFFICIENT_CREDITS' }
  }

  // Deduct credit and record analysis
  await prisma.$transaction([
    prisma.user.update({
      where: { id: userId },
      data: {
        creditsBalance: { decrement: 1 },
        freeCreditsUsed: { increment: user.tier === 'FREE' ? 1 : 0 },
      },
    }),
    prisma.creditTransaction.create({
      data: {
        userId,
        amount: -1,
        type: 'ANALYSIS_USED',
        description: `Analysis for auction ${auctionId}`,
      },
    }),
    prisma.userAnalysis.create({
      data: {
        userId,
        auctionId,
        creditCost: 1,
      },
    }),
  ])

  return { success: true, creditUsed: 1, cached: false }
}

/**
 * Add purchased credits
 */
export async function addPurchasedCredits(
  userId: string,
  amount: number,
  stripePaymentId?: string
) {
  const user = await prisma.user.update({
    where: { id: userId },
    data: {
      creditsBalance: { increment: amount },
      transactions: {
        create: {
          amount,
          type: 'PURCHASE',
          description: `Purchased ${amount} credits`,
          stripePaymentId,
        },
      },
    },
  })

  return user
}

/**
 * Get user transaction history
 */
export async function getTransactionHistory(userId: string, limit = 20) {
  const transactions = await prisma.creditTransaction.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
  })

  return transactions
}
