export type AnalyticsEvent =
  | { event: "pricing_page_viewed"; payload: { source: string } }
  | { event: "plan_clicked"; payload: { planId: string; billingCycle?: string } }
  | { event: "checkout_started"; payload: { planId: string; amount: number; sessionId: string } }
  | { event: "checkout_completed"; payload: { planId: string; amount: number; sessionId: string } }
  | { event: "checkout_cancelled"; payload: { planId: string; reason?: string } }
  | { event: "upsell_shown"; payload: { context: string; fromPlan: string; toPlan: string } }
  | { event: "upsell_converted"; payload: { context: string; fromPlan: string; toPlan: string } }
  | { event: "subscription_canceled"; payload: { tier: string } }

export async function track(event: AnalyticsEvent): Promise<void> {
  try {
    await fetch("/api/analytics", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(event),
    })
  } catch {
    // Swallow — analytics must never break the app
  }
}
