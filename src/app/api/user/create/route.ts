import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser } from '@/lib/reports/queries'
import { isDbConnectivityError } from '@/lib/db/isDbConnectivityError'

const CREATE_USER_DB_TIMEOUT_MS = 15_000

function withDbTimeout<T>(operation: Promise<T>, label: string): Promise<T> {
  let timeoutHandle: ReturnType<typeof setTimeout> | undefined

  const timeoutPromise = new Promise<T>((_, reject) => {
    timeoutHandle = setTimeout(() => {
      reject(new Error(`ETIMEDOUT ${label} after ${CREATE_USER_DB_TIMEOUT_MS}ms`))
    }, CREATE_USER_DB_TIMEOUT_MS)
  })

  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle)
    }
  })
}

export async function POST(request: NextRequest) {
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

    const body = await request.json().catch(() => ({}))
    const { name } = body

    try {
      const profile = await withDbTimeout(
        getOrCreateUser(
          user.id,
          user.email!,
          name || user.user_metadata?.full_name
        ),
        '/api/user/create getOrCreateUser'
      )

      return NextResponse.json({
        success: true,
        profile: {
          id: profile.id,
          supabaseId: profile.supabase_user_id,
          email: profile.email,
          name: profile.display_name,
          creditsBalance: profile.credits_balance,
          packCreditsBalance: profile.pack_credits_balance ?? 0,
          freeCreditsUsed: profile.free_credits_used ?? 0,
          tier: profile.tier,
          creditResetDate: profile.credit_reset_date,
          subscriptionPeriodEnd: profile.subscription_period_end ?? null,
        },
      })
    } catch (dbError) {
      if (isDbConnectivityError(dbError)) {
        console.error('DB connectivity issue in /api/user/create, returning fallback profile:', dbError)
        return NextResponse.json({
          success: true,
          degraded: true,
          profile: {
            id: user.id,
            supabaseId: user.id,
            email: user.email,
            name: user.user_metadata?.full_name ?? null,
            creditsBalance: 3,
            packCreditsBalance: 0,
            tier: 'FREE',
            freeCreditsUsed: 0,
            creditResetDate: new Date().toISOString(),
            subscriptionPeriodEnd: null,
          },
        })
      }
      throw dbError
    }
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
