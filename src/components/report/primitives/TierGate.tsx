import type { ReportTier } from "@/lib/fairValue/types"

const TIER_RANK: Record<ReportTier, number> = {
  tier_1: 1,
  tier_2: 2,
  tier_3: 3,
}

interface TierGateProps {
  userTier: ReportTier
  requiredTier: ReportTier
  fallback?: React.ReactNode
  children: React.ReactNode
}

export function TierGate({
  userTier,
  requiredTier,
  fallback = null,
  children,
}: TierGateProps) {
  if (TIER_RANK[userTier] >= TIER_RANK[requiredTier]) return <>{children}</>
  return <>{fallback}</>
}
