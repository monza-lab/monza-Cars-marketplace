import { NextResponse } from "next/server"
import { getExchangeRates } from "@/lib/exchangeRates"

export async function GET() {
  const rates = await getExchangeRates()

  return NextResponse.json(
    { base: "USD", rates, updatedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "public, max-age=3600" } }
  )
}
