// ═══════════════════════════════════════════════════════════════════════════
// Shared exchange-rate helper — server-side (memory-cached) + pure toUsd()
// Frankfurter API returns USD→X rates (e.g. EUR: 0.92 means 1 USD = 0.92 EUR)
// To convert EUR→USD we compute: amount / rate
// ═══════════════════════════════════════════════════════════════════════════

const FRANKFURTER_URL = "https://api.frankfurter.app/latest?from=USD&to=EUR,GBP,JPY"
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

const FALLBACK_RATES: Record<string, number> = {
  EUR: 0.92,
  GBP: 0.79,
  JPY: 149.5,
}

let cached: { rates: Record<string, number>; at: number } | null = null

/**
 * Fetch live exchange rates (USD→X) from Frankfurter API.
 * Results are memory-cached for 1 hour with a 5s fetch timeout.
 * Falls back to hardcoded rates on error.
 */
export async function getExchangeRates(): Promise<Record<string, number>> {
  const now = Date.now()
  if (cached && now - cached.at < CACHE_TTL) return cached.rates

  try {
    const res = await fetch(FRANKFURTER_URL, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) throw new Error(`Frankfurter API returned ${res.status}`)
    const data = await res.json()
    cached = { rates: data.rates, at: now }
    return cached.rates
  } catch {
    // On error, keep serving stale cache if available, otherwise use fallback
    return cached?.rates ?? FALLBACK_RATES
  }
}

/**
 * Convert an amount in any supported currency to USD.
 * `rates` must be in USD→X format (as returned by getExchangeRates / CurrencyContext).
 *
 * EUR→USD: amount / rates.EUR  (e.g. 100 EUR / 0.92 ≈ 108.70 USD)
 */
export function toUsd(
  amount: number,
  currency: string | null | undefined,
  rates: Record<string, number>,
): number {
  if (amount <= 0) return 0
  const cur = currency?.toUpperCase()
  if (!cur || cur === "USD") return amount
  const rate = rates[cur]
  return rate ? amount / rate : amount
}

/**
 * Convert an amount in USD to the target currency.
 * Inverse of toUsd. `rates` must be in USD→X format.
 *
 * USD→EUR: amount * rates.EUR  (e.g. 1000 USD * 0.92 = 920 EUR)
 */
export function fromUsd(
  amountUsd: number,
  currency: string | null | undefined,
  rates: Record<string, number>,
): number {
  if (!currency) return amountUsd
  const cur = currency.toUpperCase()
  if (cur === "USD") return amountUsd
  const rate = rates[cur]
  if (!rate || !Number.isFinite(rate)) return amountUsd
  return amountUsd * rate
}
