# MonzaHaus — Phase 0 Pauta · Backend Handoff

**Status:** Spec ready for implementation.
**Owner (marketing/strategy):** Edgar.
**Owner (backend):** TBD.
**Estimated effort:** 3-5 dev days.
**Blocks:** any Meta ad spend on MonzaHaus US account.

---

## 1 · Why this exists

We are launching paid acquisition on Meta (US ad account, USD billing) for MonzaHaus. **The goal of Phase 0 is to build the user database** — bring qualified Porsche enthusiasts to the platform, get them to sign up Free (100 pistons), and grow that base to 200+ signups so we can cohort, measure real retention, and compute LTV/CAC with actual data.

Phase 0 is **NOT** optimized for first transactions. With $300-500/month at US CPC ($0.50-1.50), we'd see only 3-7 purchases in 2 weeks — not enough volume for Meta's algorithm to optimize on Purchase signal (it needs ~50 events/week). Optimizing on signup volume gives Meta the data density it needs to drive CAC down week-over-week.

The Meta campaign optimization event is **`CompleteRegistration`**, not `Purchase`. Purchase events still fire (we measure them, they will matter in Phase 1), but they are not the optimization target until volume justifies it (50+ purchases/week — likely Phase 1 once advisor anon goes live).

The funnel we are instrumenting:

```
Meta Ad → /en/get-started (dedicated landing) → Signup Free (100 pistons)
       → User onboards in product → consumes pistons → OutOfReportsModal upgrade prompt
       → Stripe checkout → Purchase event fires (measured, not optimized)
```

**Out of scope for Phase 0 (deferred to Phase 0.5):** email service integration, transactional welcome emails, post-signup automation, lead magnet PDFs, lookalike audiences. The user database for Phase 0 is the existing Supabase `users` table. In-app onboarding (banners, modals) handles welcome — no email infra needed.

## 2 · Architecture overview

Three pieces, all on the existing Next.js 16 stack:

| Piece | Where | Why |
|---|---|---|
| **Meta Pixel (browser)** | `src/app/layout.tsx` head via `next/script` | Client-side event tracking, retargeting pool |
| **Conversions API (server)** | `src/app/api/meta/conversions/route.ts` (new) | iOS 14+ / Safari ITP recovery — without this we lose ~30% of US events |
| **Landing `/get-started`** | `src/app/[locale]/get-started/page.tsx` (new) | Dedicated single-CTA page, not the 6-SKU home |

Pixel and CAPI fire **the same events** with the same `event_id` so Meta dedupes them. This is the standard hybrid pattern.

## 3 · Environment variables

Add to Vercel (production + preview) and `.env.example`:

```
NEXT_PUBLIC_META_PIXEL_ID=1497731501724687
META_CAPI_ACCESS_TOKEN=                # Server-side only, never NEXT_PUBLIC_ — Edgar provides via secure channel
META_CAPI_TEST_EVENT_CODE=             # Optional — pull from Events Manager → Test Events tab
META_DOMAIN_VERIFICATION_TOKEN=6kn33pdk2lzvaj08jowe39llb1rzqx
```

**Values set by Edgar on 2026-04-26:**
- Pixel ID `1497731501724687` is public (ships in browser JS).
- Domain verification token `6kn33pdk2lzvaj08jowe39llb1rzqx` goes in the meta tag (HTML head) — also non-secret, just an identifier.
- **CAPI access token is the only true secret.** Edgar holds it in his local `.env`. Request it from him via 1Password / Bitwarden / encrypted DM — do not have him paste it in chat or any unencrypted channel.

## 4 · Component 1 — Meta Pixel (client-side)

**File:** `src/app/layout.tsx` (root) — add after the existing `<Analytics />` import.

```tsx
import Script from "next/script";

// inside <body>, after existing <Analytics /> and <SpeedInsights />:
{process.env.NEXT_PUBLIC_META_PIXEL_ID ? (
  <>
    <Script id="meta-pixel" strategy="afterInteractive">
      {`
        !function(f,b,e,v,n,t,s)
        {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
        n.callMethod.apply(n,arguments):n.queue.push(arguments)};
        if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
        n.queue=[];t=b.createElement(e);t.async=!0;
        t.src=v;s=b.getElementsByTagName(e)[0];
        s.parentNode.insertBefore(t,s)}(window, document,'script',
        'https://connect.facebook.net/en_US/fbevents.js');
        fbq('init', '${process.env.NEXT_PUBLIC_META_PIXEL_ID}');
        fbq('track', 'PageView');
      `}
    </Script>
    <noscript>
      <img height="1" width="1" style={{ display: "none" }}
        src={`https://www.facebook.com/tr?id=${process.env.NEXT_PUBLIC_META_PIXEL_ID}&ev=PageView&noscript=1`}
        alt="" />
    </noscript>
  </>
) : null}
```

**Helper file:** create `src/lib/marketing/metaPixel.ts`:

```ts
"use client";

declare global {
  interface Window {
    fbq?: (action: "track" | "trackCustom", eventName: string, params?: Record<string, unknown>, opts?: { eventID: string }) => void;
  }
}

export function trackPixelEvent(
  eventName: "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase",
  params: Record<string, unknown> = {},
  eventId: string,
) {
  if (typeof window === "undefined" || !window.fbq) return;
  window.fbq("track", eventName, params, { eventID: eventId });
}

export function generateEventId(): string {
  // crypto.randomUUID() available in modern browsers + Node 19+
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
```

## 5 · Component 2 — Conversions API (server-side)

**New API route:** `src/app/api/meta/conversions/route.ts`.

```ts
import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";

export const runtime = "nodejs";

const PIXEL_ID = process.env.NEXT_PUBLIC_META_PIXEL_ID;
const ACCESS_TOKEN = process.env.META_CAPI_ACCESS_TOKEN;
const TEST_CODE = process.env.META_CAPI_TEST_EVENT_CODE;

interface CapiEventInput {
  eventName: "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";
  eventId: string;          // MUST match the eventID sent by the Pixel for dedup
  eventTime?: number;       // unix seconds, defaults to now
  email?: string;           // raw, will be hashed
  phone?: string;           // raw, will be hashed
  externalId?: string;      // app user id (Supabase user id) — hashed
  clientUserAgent?: string;
  clientIpAddress?: string;
  fbp?: string;             // _fbp cookie value
  fbc?: string;             // _fbc cookie value
  eventSourceUrl?: string;
  customData?: Record<string, unknown>; // value, currency, content_ids, etc.
}

function sha256Lower(input?: string): string | undefined {
  if (!input) return undefined;
  return crypto.createHash("sha256").update(input.trim().toLowerCase()).digest("hex");
}

export async function POST(req: NextRequest) {
  if (!PIXEL_ID || !ACCESS_TOKEN) {
    return NextResponse.json({ ok: false, reason: "capi_not_configured" }, { status: 200 });
  }

  const body = (await req.json()) as CapiEventInput;
  const now = Math.floor(Date.now() / 1000);

  const event = {
    event_name: body.eventName,
    event_id: body.eventId,
    event_time: body.eventTime ?? now,
    action_source: "website",
    event_source_url: body.eventSourceUrl,
    user_data: {
      em: body.email ? [sha256Lower(body.email)] : undefined,
      ph: body.phone ? [sha256Lower(body.phone)] : undefined,
      external_id: body.externalId ? [sha256Lower(body.externalId)] : undefined,
      client_user_agent: body.clientUserAgent ?? req.headers.get("user-agent") ?? undefined,
      client_ip_address: body.clientIpAddress ?? req.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      fbp: body.fbp,
      fbc: body.fbc,
    },
    custom_data: body.customData,
  };

  const url = `https://graph.facebook.com/v19.0/${PIXEL_ID}/events?access_token=${ACCESS_TOKEN}`;
  const payload: Record<string, unknown> = { data: [event] };
  if (TEST_CODE) payload.test_event_code = TEST_CODE;

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("[meta-capi] error", res.status, text);
    return NextResponse.json({ ok: false, status: res.status }, { status: 200 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
```

**Helper:** add to `src/lib/marketing/metaPixel.ts`:

```ts
export async function sendCapiEvent(input: {
  eventName: "Lead" | "CompleteRegistration" | "InitiateCheckout" | "Purchase";
  eventId: string;
  email?: string;
  externalId?: string;
  customData?: Record<string, unknown>;
}) {
  if (typeof window === "undefined") return;
  await fetch("/api/meta/conversions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...input,
      clientUserAgent: navigator.userAgent,
      eventSourceUrl: window.location.href,
      fbp: document.cookie.match(/_fbp=([^;]+)/)?.[1],
      fbc: document.cookie.match(/_fbc=([^;]+)/)?.[1],
    }),
  }).catch((err) => console.error("[capi-client] failed", err));
}
```

## 6 · Component 3 — The 4 events (where to fire each)

Every event MUST fire **both** Pixel and CAPI with the same `event_id`. Use this pattern wherever an event needs to fire:

```ts
const eventId = generateEventId();
trackPixelEvent("CompleteRegistration", { content_name: "free_signup" }, eventId);
sendCapiEvent({ eventName: "CompleteRegistration", eventId, email, externalId: userId });
```

### 6.1 · `Lead`
**When:** user submits email opt-in form (lead magnet download, newsletter signup).
**Where:** **NOT IN PHASE 0** — defer until Phase 0.5 when email infra exists. Stub the helper, don't wire the trigger.

### 6.2 · `CompleteRegistration`
**When:** Free signup completes (any method: email/password, magic link, Google).
**Where:** `src/components/auth/AuthModal.tsx` — after successful `signUp` / `signInWithGoogle` / `signInWithMagicLink`. Specifically the success branch around lines 53-86 of the existing AuthModal.

```ts
// after success, before closing modal
const eventId = generateEventId();
trackPixelEvent("CompleteRegistration", {
  content_name: "free_signup",
  status: "completed",
}, eventId);
await sendCapiEvent({
  eventName: "CompleteRegistration",
  eventId,
  email,
  externalId: user.id, // Supabase user id
});
```

**Param notes:** no `value` on signup — signup itself is not revenue.

### 6.3 · `InitiateCheckout`
**When:** user clicks any pricing CTA (Zuffenhausen / Weissach / Rennsport / Jerrycan / Fuel Cell / Boxenstopp).
**Where:** `src/components/payments/PricingCards.tsx` (and `OutOfReportsModal.tsx` and `CheckoutModal.tsx`) — at the click handler that calls `/api/checkout/create-session`.

```ts
const eventId = generateEventId();
trackPixelEvent("InitiateCheckout", {
  value: plan.price,
  currency: "USD",
  content_ids: [plan.id],
  content_type: "product",
  content_name: plan.name,
}, eventId);
await sendCapiEvent({
  eventName: "InitiateCheckout",
  eventId,
  email: user?.email,
  externalId: user?.id,
  customData: {
    value: plan.price,
    currency: "USD",
    content_ids: [plan.id],
  },
});
```

**Param notes:** `value` is the plan price in USD (numeric, not string). `content_ids` is array of one plan key.

### 6.4 · `Purchase`
**Phase 0 role:** measured, NOT the optimization event. Meta campaigns optimize on `CompleteRegistration` (section 6.2) until volume reaches ~50 purchases/week. Purchase data still fires every checkout — it powers retargeting, ROAS reporting, and the eventual switch to Purchase optimization in Phase 1.

**When:** Stripe webhook confirms `checkout.session.completed`.
**Where:** `src/app/api/stripe/webhook/route.ts` inside `applyCheckoutSessionCompleted` — **after** `activateStripeSubscription` or `grantStripePurchase` succeeds.

This event fires SERVER-SIDE only via direct CAPI call (the user is on Stripe's hosted checkout when purchase completes — there is no client to fire Pixel from). The optional client-side Pixel `Purchase` can fire from the success redirect page if you have one.

```ts
// inside applyCheckoutSessionCompleted, after activate/grant:
const eventId = `purchase_${session.id}`; // deterministic, dedup-safe
const userEmail = session.customer_details?.email ?? undefined;

await fetch(`https://graph.facebook.com/v19.0/${process.env.NEXT_PUBLIC_META_PIXEL_ID}/events?access_token=${process.env.META_CAPI_ACCESS_TOKEN}`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    data: [{
      event_name: "Purchase",
      event_id: eventId,
      event_time: Math.floor(Date.now() / 1000),
      action_source: "website",
      user_data: {
        em: userEmail ? [crypto.createHash("sha256").update(userEmail.trim().toLowerCase()).digest("hex")] : undefined,
        external_id: appUserId ? [crypto.createHash("sha256").update(appUserId).digest("hex")] : undefined,
      },
      custom_data: {
        value: plan.price,
        currency: "USD",
        content_ids: [resolvedPlanKey],
        content_type: "product",
        content_name: plan.name,
      },
    }],
    ...(process.env.META_CAPI_TEST_EVENT_CODE ? { test_event_code: process.env.META_CAPI_TEST_EVENT_CODE } : {}),
  }),
}).catch((err) => console.error("[meta-capi-purchase] failed", err));
```

**Param notes:**
- `event_id` MUST be deterministic (use Stripe session id) so retries don't double-count.
- `value` MUST be the actual amount paid in USD. Meta uses this to optimize.
- `content_ids` should be the resolved plan key (`zuffenhausen` / `weissach` / etc), not legacy aliases.
- Send **always**, including for one-time top-ups (Jerrycan / Fuel Cell / Boxenstopp). All purchases count.

## 7 · Component 4 — Landing `/get-started`

**Path:** `src/app/[locale]/get-started/page.tsx` (new).

Single-purpose landing for paid traffic. NOT linked from main nav. NOT indexed (`robots: noindex`). Locale: English-first; the locale routing already exists, but Phase 0 only targets US so we will only link to `/en/get-started` from ads.

**Required structure (will be filled with final copy in a follow-up):**

1. **Hero**
   - One-line headline (15 words max)
   - One-line subhead (anchor: PPS $250 / PPI $400 / MonzaHaus free first report)
   - Primary CTA button: "Generate your first Porsche report — free"
   - Background: editorial Porsche imagery (asset TBD, Edgar will provide)

2. **Trust strip**
   - 3-4 logos or text: "Used by collectors at..." / data sources (BaT, Cars & Bids, AutoScout24)

3. **3-step "how it works"**
   - Pick a Porsche → AI report → Make a smarter offer

4. **Single secondary CTA**
   - Repeats primary CTA at bottom: same text, same destination

**No pricing section. No multi-SKU comparison. No footer.** This page exists to convert one specific intent: signup Free.

**Behavior:**
- CTA opens `<AuthModal>` in signup mode (existing component).
- On signup success: redirect to `/en/advisor` or `/en/cars` (whichever is the highest-engagement destination for new users — back/PM decision).
- AuthModal `CompleteRegistration` event fires automatically (per section 6.2).

**SEO:**
- `metadata: { robots: { index: false, follow: false } }` — paid-only, do not compete with organic SEO pages.

## 8 · Component 5 — Domain verification

Edgar adds the Meta-supplied `<meta name="facebook-domain-verification" content="..." />` tag.
**Where:** `src/app/layout.tsx` `metadata.other` field.

```ts
export const metadata: Metadata = {
  // ...existing fields
  other: {
    "facebook-domain-verification": process.env.META_DOMAIN_VERIFICATION_TOKEN ?? "",
  },
};
```

Edgar will provide the token from Business Manager → Brand Safety → Domains.

## 9 · Testing protocol

**Before deploying to production:**

1. Set `META_CAPI_TEST_EVENT_CODE` in Vercel preview env (pull test code from Events Manager → Test Events tab: https://business.facebook.com/events_manager2/list/dataset/1497731501724687/test_events).
2. Deploy to a Vercel preview branch.
3. Open `/en/get-started` in Chrome with [Meta Pixel Helper](https://chromewebstore.google.com/detail/meta-pixel-helper/fdgfkebogiimcoedlicjlajpkdmockpc) installed.
4. Verify:
   - PageView fires on landing
   - CompleteRegistration fires on signup
   - InitiateCheckout fires on pricing CTA click
   - Test purchase via Stripe test card → Purchase fires (check Events Manager → Test Events)
5. Confirm in Events Manager that Pixel and CAPI events are deduping (you should see "Browser + Server" not double-count).

**Definition of Done:**
- [ ] All 4 events visible in Events Manager → Test Events with `value` and `currency` correctly populated for monetary events
- [ ] Pixel + CAPI dedup confirmed (no double-counts)
- [ ] Domain verified (green check in BM → Brand Safety → Domains)
- [ ] `/en/get-started` deployed to production with `noindex`
- [ ] Aggregated Event Measurement (AEM) configured by Edgar in BM with priority order: Purchase > InitiateCheckout > CompleteRegistration > Lead

## 10 · Meta campaign configuration (reference for Edgar / media buyer)

Not a backend task, but documented here so the implementation aligns with the campaign side.

| Setting | Phase 0 value | Why |
|---|---|---|
| Objective | Sales | Meta routes traffic to high-intent users when paired with a website conversion event |
| Conversion event | **`CompleteRegistration`** | Signup volume gives Meta enough data density (~10-30 events/wk) to optimize. Purchase volume is too low until Phase 1. |
| Optimization | Maximize conversions | Standard for low-volume launch |
| Bid strategy | Highest volume (no cap) | Let Meta find the cheapest signups; we set CPL ceilings via budget pacing, not bid caps |
| Audience | Saved Audience: "MonzaHaus US — Porsche Buyers M35-65 v1" (already created in BM 2026-04-26) | Men, US, 35-65, Porsche-intent interests |
| Ad Account | `act_963490026422203` (Monza Haus, USD) | — |
| Placements | Advantage+ (automatic) | More signal for Meta in low-budget regime |
| Attribution | 7-day click, 1-day view | Default; revisit in Phase 1 |

**Switch to Purchase optimization** when both conditions hold: (a) Purchase event volume ≥ 50/week, (b) at least one full 14-day attribution window has closed. Until then, optimizing on `CompleteRegistration` produces lower CAC even though Purchase is the "true" goal.

## 11 · Out of scope (Phase 0.5+)

- **Email service integration** (Resend / Mailchimp / ConvertKit). User database for Phase 0 is the Supabase `users` table — no transactional or marketing email yet.
- **Welcome email** on signup — handled in-app via existing components (AuthModal post-signup state, onboarding banners). Adding email later is non-breaking.
- **Lead magnet PDFs** and `Lead` event wiring — `Lead` event helper exists in code but no UI fires it in Phase 0.
- **Lookalike audiences** — need ≥ 100 Purchase events or ≥ 1,000 signups before LAL is meaningful.
- **Spanish / German / Japanese landing variants** — Phase 0 is US-only; locales `/es`, `/de`, `/ja` exist but pauta only links to `/en/get-started`.
- **Offline events / Conversion API for offline conversions** — irrelevant until we have offline channels.

## 12 · Open questions for Edgar / PM

- **Post-signup redirect destination:** `/en/advisor` vs `/en/cars` vs `/en/account`? Defaults to `/en/advisor` if no preference.
- **Hero copy and imagery for `/en/get-started`:** pending Edgar.
- **CAPI access token handoff:** Edgar to share via 1Password / Bitwarden / encrypted DM — NOT in chat or plaintext.
- **Production domain confirmation:** doc assumes `monzahaus.com` (matches the verified domain in BM). Confirm before deploy.
