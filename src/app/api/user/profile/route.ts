import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser, getUserCredits } from '@/lib/credits'

function isDbConnectivityError(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null
  const message = (e?.message ?? '').toLowerCase()

  return (
    e?.code === 'P1001' ||
    e?.code === 'P1011' ||
    message.includes('connection terminated unexpectedly') ||
    message.includes('self-signed certificate') ||
    message.includes("can't reach database server") ||
    message.includes('tenant or user not found')
  )
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
      profile = await getUserCredits(user.id)
      if (!profile) {
        profile = await getOrCreateUser(
          user.id,
          user.email!,
          user.user_metadata?.full_name
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
            freeCreditsUsed: 0,
            tier: 'FREE',
            creditResetDate: new Date().toISOString(),
          },
        })
      }
      throw dbError
    }

    return NextResponse.json({
      profile: {
        id: profile.id,
        supabaseId: user.id,
        email: user.email,
        name: user.user_metadata?.full_name || null,
        avatarUrl: user.user_metadata?.avatar_url || null,
        creditsBalance: profile.creditsBalance,
        freeCreditsUsed: profile.freeCreditsUsed,
        tier: profile.tier,
        creditResetDate: profile.creditResetDate,
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
