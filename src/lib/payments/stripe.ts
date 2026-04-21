import Stripe from "stripe"

export function getStripeClient() {
  const secretKey = process.env.STRIPE_SECRET_KEY
  if (!secretKey) {
    throw new Error("STRIPE_SECRET_KEY is required")
  }

  return new Stripe(secretKey)
}

export function getAppBaseUrl(request?: Request) {
  const configured =
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    ""

  if (configured) return configured.replace(/\/$/, "")

  if (request) return new URL(request.url).origin

  return "http://localhost:3000"
}

export function getLocalizedPath(locale: string, path: string) {
  const prefix = locale && locale !== "en" ? `/${locale}` : ""
  return `${prefix}${path}`
}
