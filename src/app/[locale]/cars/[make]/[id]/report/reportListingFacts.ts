type PriceInput = {
  currentBid: number | null | undefined
  askingPriceUsd?: number | null
  price?: number | null
}

export function resolveCurrentPriceUsd(input: PriceInput): number {
  const candidates = [input.currentBid, input.askingPriceUsd, input.price]
  return candidates.find((value): value is number => typeof value === "number" && value > 0) ?? 0
}
