import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser, getUserCredits } from '@/lib/credits'

export async function GET() {
  try {
    const supabase = await createClient()
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    let profile = await getUserCredits(user.id)
    if (!profile) {
      profile = await getOrCreateUser(
        user.id,
        user.email!,
        user.user_metadata?.full_name
      )
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
