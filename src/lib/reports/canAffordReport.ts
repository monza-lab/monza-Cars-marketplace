export const REPORT_PISTON_COST = 1000

export function canAffordReport(balance: number, cost: number): boolean {
  if (cost <= 0) return true
  if (balance < 0) return false
  return balance >= cost
}
