import type Stripe from "stripe"
import {
  activateStripeSubscription,
  getUserCredits,
  grantStripePurchase,
} from "@/lib/reports/queries"
import { getPricingPlan, resolvePlanKey } from "@/lib/payments/plans"
import { getStripeClient } from "@/lib/payments/stripe"

export type CheckoutFulfillmentResult =
  | { status: "fulfilled"; planId: string; mode: Stripe.Checkout.Session["mode"] }
  | { status: "ignored"; reason: string }

export async function fulfillCheckoutSession(
  session: Stripe.Checkout.Session,
): Promise<CheckoutFulfillmentResult> {
  if (session.payment_status !== "paid") {
    return { status: "ignored", reason: "checkout_session_not_paid" }
  }

  const planId = session.metadata?.planId
  const appUserId = session.metadata?.appUserId
  const resolvedPlanKey = planId ? resolvePlanKey(planId) : null
  const plan = planId ? getPricingPlan(planId) : null
  if (!resolvedPlanKey || !plan || !appUserId) {
    return { status: "ignored", reason: "missing_or_invalid_metadata" }
  }

  const userProfile = await getUserCredits(appUserId)
  if (!userProfile) {
    console.error(`[stripe-fulfillment] user_credits not found for supabase_user_id=${appUserId}`)
    return { status: "ignored", reason: "user_credits_not_found" }
  }

  if (plan.billingMode === "subscription") {
    const customerId = typeof session.customer === "string" ? session.customer : null
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null
    if (!customerId || !subscriptionId) {
      return { status: "ignored", reason: "missing_subscription_identifiers" }
    }

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
    const firstItem = subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
    const currentPeriodEnd = firstItem?.current_period_end

    await activateStripeSubscription(userProfile.id, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd:
        typeof currentPeriodEnd === "number"
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
      stripePaymentId: session.id,
      subscriptionPlanKey: resolvedPlanKey,
      monthlyAllowancePistons: plan.pistons,
      unlimitedReports: plan.unlimitedReports,
    })

    return { status: "fulfilled", planId: resolvedPlanKey, mode: session.mode }
  }

  await grantStripePurchase(
    userProfile.id,
    plan.pistons,
    session.id,
    resolvedPlanKey,
    typeof session.customer === "string" ? session.customer : null,
  )

  return { status: "fulfilled", planId: resolvedPlanKey, mode: session.mode }
}
