import Stripe from "stripe"
import { NextResponse } from "next/server"
import {
  activateStripeSubscription,
  deactivateStripeSubscription,
  findUserByStripeCustomerId,
  findUserByStripeSubscriptionId,
  grantStripePurchase,
  updateStripeSubscriptionStatus,
} from "@/lib/reports/queries"
import { getStripeClient } from "@/lib/payments/stripe"
import { isPlanId } from "@/lib/payments/plans"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function applyCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  const planId = session.metadata?.planId
  const appUserId = session.metadata?.appUserId
  if (!planId || !isPlanId(planId) || !appUserId) {
    return
  }

  if (planId === "monthly") {
    const customerId = typeof session.customer === "string" ? session.customer : null
    const subscriptionId = typeof session.subscription === "string" ? session.subscription : null
    if (!customerId || !subscriptionId) return

    const subscription = await getStripeClient().subscriptions.retrieve(subscriptionId)
    const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
    await activateStripeSubscription(appUserId, {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd:
        typeof currentPeriodEnd === "number"
          ? new Date(currentPeriodEnd * 1000).toISOString()
          : null,
      stripePaymentId: session.id,
    })
    return
  }

  const credits = planId === "pack" ? 5 : 1
  await grantStripePurchase(appUserId, credits, session.id, planId, typeof session.customer === "string" ? session.customer : null)
}

async function applySubscriptionUpdate(subscription: Stripe.Subscription) {
  const customerId = typeof subscription.customer === "string" ? subscription.customer : null
  const currentPeriodEnd = (subscription as unknown as { current_period_end?: number }).current_period_end
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
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await applySubscriptionUpdate(event.data.object as Stripe.Subscription)
        break
      default:
        break
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error("Stripe webhook handler failed:", error)
    return NextResponse.json(
      { error: "Webhook processing failed" },
      { status: 500 },
    )
  }
}
