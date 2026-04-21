import { NextResponse } from "next/server"
import Stripe from "stripe"
import { createClient } from "@/lib/supabase/server"
import { getStripeClient } from "@/lib/payments/stripe"
import {
  getUserCredits,
  updateStripeSubscriptionStatus,
} from "@/lib/reports/queries"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const profile = await getUserCredits(user.id)
    if (!profile || !profile.stripe_subscription_id) {
      return NextResponse.json(
        { error: "No active subscription found" },
        { status: 404 },
      )
    }

    const stripe = getStripeClient()
    const updatedSubscription = (await stripe.subscriptions.update(
      profile.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      },
    )) as Stripe.Subscription

    await updateStripeSubscriptionStatus(profile.id, {
      subscriptionStatus: updatedSubscription.status,
      subscriptionPeriodEnd: profile.subscription_period_end,
      stripeSubscriptionId: updatedSubscription.id,
      stripeCustomerId: typeof updatedSubscription.customer === "string"
        ? updatedSubscription.customer
        : profile.stripe_customer_id ?? null,
    })

    return NextResponse.json({
      success: true,
      status: updatedSubscription.status,
    })
  } catch (error) {
    console.error("Failed to cancel subscription:", error)
    return NextResponse.json(
      { error: "Failed to cancel subscription" },
      { status: 500 },
    )
  }
}
