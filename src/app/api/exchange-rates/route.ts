import { NextResponse } from "next/server"

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY"
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
}

let cachedData: { rates: Record<string, number>; updatedAt: string } | null = null
let cachedAt = 0

export async function GET() {
  const now = Date.now()

  if (cachedData && now - cachedAt < CACHE_TTL) {
    return NextResponse.json(
      { base: "USD", rates: cachedData.rates, updatedAt: cachedData.updatedAt },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    )
  }

  try {
    const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`Frankfurter API returned ${res.status}`)
    const data = await res.json()

    cachedData = { rates: data.rates, updatedAt: new Date().toISOString() }
    cachedAt = now

    return NextResponse.json(
      { base: "USD", rates: cachedData.rates, updatedAt: cachedData.updatedAt },
      { headers: { "Cache-Control": "public, max-age=3600" } }
    )
  } catch {
    const rates = cachedData?.rates || FALLBACK_RATES
    const updatedAt = cachedData?.updatedAt || new Date().toISOString()

    return NextResponse.json(
      { base: "USD", rates, updatedAt, fallback: true },
      { headers: { "Cache-Control": "public, max-age=300" } }
    )
  }
}
