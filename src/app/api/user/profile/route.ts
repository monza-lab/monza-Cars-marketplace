import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser, getUserCredits, getTransactionHistory } from '@/lib/reports/queries'
import { isDbConnectivityError } from '@/lib/db/isDbConnectivityError'
import { getTodayUsageByType, resolveUserCreditsId } from '@/lib/advisor/persistence/ledger'

const PROFILE_DB_TIMEOUT_MS = 15_000

function withDbTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`ETIMEDOUT ${label} after ${PROFILE_DB_TIMEOUT_MS}ms`))
    }, PROFILE_DB_TIMEOUT_MS)
  })

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  })
}

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const authHeader = request.headers.get('authorization')
    const bearerToken = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length).trim()
      : undefined

    const { data: { user }, error: authError } = bearerToken
      ? await supabase.auth.getUser(bearerToken)
      : await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let profile
    try {
      profile = await withDbTimeout(getUserCredits(user.id), '/api/user/profile getUserCredits')
      if (!profile) {
        profile = await withDbTimeout(
          getOrCreateUser(
            user.id,
            user.email!,
            user.user_metadata?.full_name
          ),
          '/api/user/profile getOrCreateUser'
        )
      }
    } catch (dbError) {
      if (isDbConnectivityError(dbError)) {
        console.error('DB connectivity issue in /api/user/profile, returning fallback profile:', dbError)
        return NextResponse.json({
          degraded: true,
          profile: {
            id: user.id,
            supabaseId: user.id,
            email: user.email,
            name: user.user_metadata?.full_name || null,
            avatarUrl: user.user_metadata?.avatar_url || null,
            creditsBalance: 3,
            packCreditsBalance: 0,
            freeCreditsUsed: 0,
            tier: 'FREE',
            creditResetDate: new Date().toISOString(),
            subscriptionPeriodEnd: null,
          },
        })
      }
      throw dbError
    }

    return NextResponse.json({
      wallet: await buildWalletSnapshot(profile.supabase_user_id),
      profile: {
        id: profile.id,
        supabaseId: profile.supabase_user_id,
        email: user.email,
        name: profile.display_name ?? user.user_metadata?.full_name ?? null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        creditsBalance: profile.credits_balance,
        packCreditsBalance: profile.pack_credits_balance ?? 0,
        pistonsBalance: profile.credits_balance + (profile.pack_credits_balance ?? 0),
        freeCreditsUsed: profile.free_credits_used ?? 0,
        tier: profile.tier,
        subscriptionPlanKey: profile.subscription_plan_key ?? null,
        monthlyAllowancePistons: profile.monthly_allowance_pistons ?? 300,
        unlimitedReports: profile.unlimited_reports ?? false,
        creditResetDate: profile.credit_reset_date,
        subscriptionPeriodEnd: profile.subscription_period_end ?? null,
      },
    })
  } catch (error) {
    console.error('Error fetching profile:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function buildWalletSnapshot(supabaseUserId: string) {
  const userCreditsId = await resolveUserCreditsId(supabaseUserId)
  if (!userCreditsId) {
    return { recentDebits: [], todayUsage: { chat: 0, oracle: 0, report: 0 } }
  }

  const [transactions, usage] = await Promise.all([
    getTransactionHistory(userCreditsId, 10),
    getTodayUsageByType(userCreditsId),
  ])

  const recentDebits = transactions
    .filter(row => row.amount < 0)
    .map(row => ({
      amount: Math.abs(row.amount),
      label: row.description ?? row.type,
      surface: mapSurface(row.type),
      timestamp: new Date(row.created_at),
    }))

  return {
    recentDebits,
    todayUsage: {
      chat: (usage.ADVISOR_INSTANT ?? 0) + (usage.ADVISOR_MARKETPLACE ?? 0) + (usage.ADVISOR_DEEP_RESEARCH ?? 0),
      oracle: 0,
      report: usage.REPORT_USED ?? 0,
    },
  }
}

function mapSurface(type: string): "chat" | "oracle" | "report" | "deep_research" {
  if (
    type === "REPORT_USED" ||
    type === "STRIPE_PACK_PURCHASE" ||
    type === "STRIPE_SUBSCRIPTION_ACTIVATION" ||
    type === "PURCHASE" ||
    type === "FREE_MONTHLY"
  ) {
    return "report"
  }
  if (type === "ADVISOR_DEEP_RESEARCH") return "deep_research"
  if (type === "ADVISOR_INSTANT" || type === "ADVISOR_MARKETPLACE") return "chat"
  return "oracle"
}
