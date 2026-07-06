import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { DEFAULT_MONTHLY_PISTONS, getOrCreateUserWithStatus } from '@/lib/reports/queries'
import { isDbConnectivityError } from '@/lib/db/isDbConnectivityError'
import { AnonSessionCookie, verifyAnonymousSession } from '@/lib/advisor/persistence/anon-session'
import { mergeAnonymousToUser } from '@/lib/advisor/persistence/conversations'
import { sendServerCapiEvent } from '@/lib/marketing/metaCapiServer'
import type { AttributionSnapshot } from '@/lib/marketing/attribution'

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

function cleanString(value: unknown, maxLength = 500): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  return trimmed ? trimmed.slice(0, maxLength) : null
}

function parseAttribution(input: unknown): AttributionSnapshot | null {
  if (!input || typeof input !== 'object') return null
  const source = input as Record<string, unknown>
  const firstSeen = cleanString(source.first_seen_at)
  const landingPath = cleanString(source.landing_path)
  if (!firstSeen || !landingPath) return null

  return {
    utm_source: cleanString(source.utm_source),
    utm_medium: cleanString(source.utm_medium),
    utm_campaign: cleanString(source.utm_campaign),
    utm_term: cleanString(source.utm_term),
    utm_content: cleanString(source.utm_content),
    fbclid: cleanString(source.fbclid),
    landing_path: landingPath,
    referrer: cleanString(source.referrer),
    first_seen_at: firstSeen,
  }
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
    const attribution = parseAttribution(body.attribution)

    try {
      const { profile, created } = await withDbTimeout(
        getOrCreateUserWithStatus(
          user.id,
          user.email!,
          name || user.user_metadata?.full_name,
          attribution
        ),
        '/api/user/create getOrCreateUserWithStatus'
      )

      if (created) {
        await sendServerCapiEvent({
          eventName: 'CompleteRegistration',
          eventId: `complete_registration_${user.id}`,
          eventSourceUrl: request.url,
          email: user.email ?? undefined,
          externalId: user.id,
          customData: {
            content_name: 'free_signup',
            status: 'completed',
          },
        }).catch((err) => console.error('[meta-capi-registration] failed', err))
      }

      // Advisor: merge any anonymous conversations + grace + ledger rows into this new user.
      try {
        const cookieStore = await cookies()
        const anonCookie = cookieStore.get(AnonSessionCookie.name)?.value
        const anonId = verifyAnonymousSession(anonCookie)
        if (anonId && user.id) {
          // Conversations (matches on anonymous_session_id, sets user_id).
          await mergeAnonymousToUser(anonId, user.id)

          // Migrate audit rows in credit_transactions. Rows were inserted with user_id = NULL
          // and anonymous_session_id set; resolve the new user's user_credits.id first.
          const { createAdminClient } = await import('@/lib/supabase/server')
          const admin = createAdminClient()
          const { data: creditsRow } = await admin
            .from('user_credits')
            .select('id')
            .eq('supabase_user_id', user.id)
            .single()
          if (creditsRow?.id) {
            await admin
              .from('credit_transactions')
              .update({ user_id: creditsRow.id, anonymous_session_id: null })
              .eq('anonymous_session_id', anonId)
          }

          // Grace counters keyed on anonymous session are also moved over.
          await admin
            .from('advisor_grace_counters')
            .update({ supabase_user_id: user.id, anonymous_session_id: null })
            .eq('anonymous_session_id', anonId)
        }
      } catch (mergeErr) {
        // Merge is best-effort; never fail sign-up because of it.
        console.warn('[advisor] anon->user merge failed:', mergeErr)
      }

      return NextResponse.json({
        success: true,
        profile: {
          id: profile.id,
          supabaseId: profile.supabase_user_id,
          email: profile.email,
          name: profile.display_name,
          creditsBalance: profile.credits_balance,
          packCreditsBalance: profile.pack_credits_balance ?? 0,
          pistonsBalance: profile.credits_balance + (profile.pack_credits_balance ?? 0),
          freeCreditsUsed: profile.free_credits_used ?? 0,
          tier: profile.tier,
          creditResetDate: profile.credit_reset_date,
          subscriptionPeriodEnd: profile.subscription_period_end ?? null,
          subscriptionPlanKey: profile.subscription_plan_key ?? null,
          monthlyAllowancePistons: profile.monthly_allowance_pistons ?? DEFAULT_MONTHLY_PISTONS,
          unlimitedReports: profile.unlimited_reports ?? false,
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
            creditsBalance: DEFAULT_MONTHLY_PISTONS,
            packCreditsBalance: 0,
            pistonsBalance: DEFAULT_MONTHLY_PISTONS,
            tier: 'FREE',
            freeCreditsUsed: 0,
            creditResetDate: new Date().toISOString(),
            subscriptionPeriodEnd: null,
            subscriptionPlanKey: null,
            monthlyAllowancePistons: DEFAULT_MONTHLY_PISTONS,
            unlimitedReports: false,
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
