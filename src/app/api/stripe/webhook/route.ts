import Stripe from "stripe"
import { NextResponse } from "next/server"
import {
  activateStripeSubscription,
  deactivateStripeSubscription,
  findUserByStripeCustomerId,
  findUserByStripeSubscriptionId,
  getUserCredits,
  grantStripePurchase,
  renewSubscriptionCredits,
  updateStripeSubscriptionStatus,
} from "@/lib/reports/queries"
import { getStripeClient } from "@/lib/payments/stripe"
import { getPricingPlan, resolvePlanKey } from "@/lib/payments/plans"
import { sendServerCapiEvent } from "@/lib/marketing/metaCapiServer"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function applyCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const planId = session.metadata?.planId
  const appUserId = session.metadata?.appUserId
  const resolvedPlanKey = planId ? resolvePlanKey(planId) : null
  const plan = planId ? getPricingPlan(planId) : null
  if (!resolvedPlanKey || !plan || !appUserId) {
    return
  }

  // Resolve supabase auth UUID → user_credits.id
  const userProfile = await getUserCredits(appUserId)
  if (!userProfile) {
    console.error(`[stripe-webhook] user_credits not found for supabase_user_id=${appUserId}`)
    return
  }
  const userCreditsId = userProfile.id

  if (plan.billingMode === "subscription") {
    const customerId = typeof session.customer === "string" ? session.customer : null
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null
    if (!customerId || !subscriptionId) return

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
    // Stripe API 2026-03-25: current_period_end moved from Subscription to SubscriptionItem
    const firstItem = subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
    const currentPeriodEnd = firstItem?.current_period_end
    await activateStripeSubscription(userCreditsId, {
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

    await sendServerCapiEvent({
      eventName: "Purchase",
      eventId: `purchase_${session.id}`,
      email: session.customer_details?.email ?? undefined,
      externalId: appUserId,
      customData: {
        value: plan.price,
        currency: "USD",
        content_ids: [resolvedPlanKey],
        content_type: "product",
        content_name: plan.name,
      },
    }).catch((err) => console.error("[meta-capi-purchase] failed", err))

    return
  }

  await grantStripePurchase(
    userCreditsId,
    plan.pistons,
    session.id,
    resolvedPlanKey,
    typeof session.customer === "string" ? session.customer : null,
  )

  await sendServerCapiEvent({
    eventName: "Purchase",
    eventId: `purchase_${session.id}`,
    email: session.customer_details?.email ?? undefined,
    externalId: appUserId,
    customData: {
      value: plan.price,
      currency: "USD",
      content_ids: [resolvedPlanKey],
      content_type: "product",
      content_name: plan.name,
    },
  }).catch((err) => console.error("[meta-capi-purchase] failed", err))
}

async function applyInvoicePaid(invoice: Stripe.Invoice) {
  // Only handle subscription renewal invoices (not the first invoice)
  const billingReason = (invoice as unknown as { billing_reason?: string }).billing_reason
  if (billingReason !== "subscription_cycle") return

  const customerId = typeof invoice.customer === "string" ? invoice.customer : null
  if (!customerId) return

  const user = await findUserByStripeCustomerId(customerId)
  if (!user) {
    console.error(`[stripe-webhook] invoice.paid: user not found for customer=${customerId}`)
    return
  }

  const subscriptionPeriodEnd = (invoice as unknown as { lines?: { data?: Array<{ period?: { end?: number } }> } })
    .lines?.data?.[0]?.period?.end
  if (typeof subscriptionPeriodEnd === "number") {
    await updateStripeSubscriptionStatus(user.id, {
      subscriptionStatus: "active",
      subscriptionPeriodEnd: new Date(subscriptionPeriodEnd * 1000).toISOString(),
      stripeSubscriptionId: user.stripe_subscription_id ?? null,
      stripeCustomerId: customerId,
    })
  }

  await renewSubscriptionCredits(user.id, invoice.id)
}

async function applySubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null
  // Stripe API 2026-03-25: current_period_end moved from Subscription to SubscriptionItem
  const firstItem = subscription.items?.data?.[0] as unknown as { current_period_end?: number } | undefined
  const currentPeriodEnd = firstItem?.current_period_end
  const user = customerId
    ? await findUserByStripeCustomerId(customerId)
    : subscription.id
      ? await findUserByStripeSubscriptionId(subscription.id)
      : null

  if (!user) return

  if (subscription.status === "canceled") {
    await deactivateStripeSubscription(user.id, subscription.id)
    return
  }

  await updateStripeSubscriptionStatus(user.id, {
    subscriptionStatus: subscription.status,
    subscriptionPeriodEnd:
      typeof currentPeriodEnd === "number"
        ? new Date(currentPeriodEnd * 1000).toISOString()
        : null,
    stripeSubscriptionId: subscription.id,
    stripeCustomerId: customerId ?? user.stripe_customer_id ?? null,
  })
}

export async function POST(request: Request) {
  const stripe = getStripeClient()
  const signature = request.headers.get("stripe-signature")
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET

  if (!webhookSecret) {
    return NextResponse.json(
      { error: "STRIPE_WEBHOOK_SECRET is required" },
      { status: 500 },
    )
  }

  if (!signature) {
    return NextResponse.json({ error: "Missing Stripe signature" }, { status: 400 })
  }

  let event: Stripe.Event
  const payload = await request.text()

  try {
    event = stripe.webhooks.constructEvent(payload, signature, webhookSecret)
  } catch (error) {
    console.error("Stripe webhook signature verification failed:", error)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
      case "checkout.session.completed":
        await applyCheckoutSessionCompleted(event.data.object as Stripe.Checkout.Session)
        break
      case "invoice.paid":
        await applyInvoicePaid(event.data.object as Stripe.Invoice)
        break
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error)
    const errStack = error instanceof Error ? error.stack : undefined
    console.error("Stripe webhook handler failed:", errMsg, errStack)
    return NextResponse.json(
      { error: "Webhook processing failed", detail: errMsg },
      { status: 500 },
    )
  }
}
