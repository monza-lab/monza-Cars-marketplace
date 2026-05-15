/** Piston cost for one Haus Report. Must equal REPORT_PISTON_COST in queries.ts. */
export const REPORT_PISTON_COST = 100

export function canAffordReport(balance: number, cost: number): boolean {
  if (cost <= 0) return true
  if (balance < 0) return false
  return balance >= cost
}
