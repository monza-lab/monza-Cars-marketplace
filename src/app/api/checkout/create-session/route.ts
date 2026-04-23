import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getOrCreateUser, updateStripeCustomerId } from "@/lib/reports/queries"
import { getPricingPlan, isPlanId, resolvePlanKey } from "@/lib/payments/plans"
import {
  getAppBaseUrl,
  getLocalizedPath,
  getStripeClient,
} from "@/lib/payments/stripe"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type CheckoutRequest = {
  plan?: string
  locale?: string
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as CheckoutRequest
    if (!body.plan || !isPlanId(body.plan)) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }

    const plan = getPricingPlan(body.plan)
    const resolvedPlanKey = resolvePlanKey(body.plan)
    if (!plan || !resolvedPlanKey) {
      return NextResponse.json({ error: "Invalid plan" }, { status: 400 })
    }
    const locale = body.locale && body.locale.length > 0 ? body.locale : "en"
    const baseUrl = getAppBaseUrl(request)
    const successUrl = `${baseUrl}${getLocalizedPath(locale, "/checkout/success")}?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = `${baseUrl}${getLocalizedPath(locale, "/checkout/cancel")}`
    const stripe = getStripeClient()

    const profile = await getOrCreateUser(
      user.id,
      user.email ?? "",
      user.user_metadata?.full_name ?? undefined,
    )

    let stripeCustomerId = profile.stripe_customer_id ?? null
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: user.email ?? undefined,
        name: user.user_metadata?.full_name ?? undefined,
        metadata: {
          supabaseUserId: user.id,
        },
      })

      stripeCustomerId = customer.id
      await updateStripeCustomerId(profile.id, stripeCustomerId)
    }

    const session = await stripe.checkout.sessions.create({
      mode: plan.billingMode,
      customer: stripeCustomerId,
      client_reference_id: user.id,
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: false,
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: "usd",
            unit_amount: plan.priceCents,
            product_data: {
              name: `Monza Haus ${plan.name}`,
              description:
                plan.billingMode === "subscription"
                  ? (plan.unlimitedReports ? "Unlimited reports and Pistons allowance" : `${plan.pistons.toLocaleString()} Pistons every month`)
                  : `${plan.pistons.toLocaleString()} Pistons top-up`,
            },
            ...(plan.billingMode === "subscription"
              ? { recurring: { interval: "month" as const } }
              : {}),
          },
        },
      ],
      metadata: {
        appUserId: user.id,
        planId: resolvedPlanKey,
        locale,
      },
      subscription_data:
        plan.billingMode === "subscription"
          ? {
              metadata: {
                appUserId: user.id,
                planId: resolvedPlanKey,
                locale,
              },
            }
          : undefined,
      payment_intent_data:
        plan.billingMode === "payment"
          ? {
              metadata: {
                appUserId: user.id,
                planId: resolvedPlanKey,
                locale,
              },
            }
          : undefined,
    })

    return NextResponse.json({
      url: session.url,
      sessionId: session.id,
    })
  } catch (error) {
    console.error("Error creating Stripe checkout session:", error)
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 },
    )
  }
}
