import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getOrCreateUser } from '@/lib/credits'

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

    const body = await request.json()
    const { name } = body

    try {
      const profile = await getOrCreateUser(
        user.id,
        user.email!,
        name || user.user_metadata?.full_name
      )

      return NextResponse.json({
        success: true,
        profile: {
          id: profile.id,
          supabaseId: profile.supabaseId,
          email: profile.email,
          name: profile.name,
          creditsBalance: profile.creditsBalance,
          tier: profile.tier,
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
            tier: 'FREE',
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
