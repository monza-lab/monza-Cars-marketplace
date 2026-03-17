import type { CollectorCar } from "@/lib/curatedCars"
import type { DbMarketDataRow, DbComparableRow, DbAnalysisRow, DbSoldRecord } from "@/lib/db/queries"

export type MessageRole = "user" | "assistant"

export interface QuickAction {
  id: string
  label: string
  prompt: string
}

export interface ReportCtaData {
  carId: string
  carTitle: string
  make: string
  alreadyAnalyzed: boolean
  hasTokens: boolean
  analysesRemaining: number
}

export interface AdvisorMessage {
  id: string
  role: MessageRole
  content: string
  timestamp: Date
  quickActions?: QuickAction[]
  reportCta?: ReportCtaData
}

export interface AdvisorContext {
  // Car data (from props)
  car?: CollectorCar
  make?: string
  dbMarketData?: DbMarketDataRow | null
  dbComparables?: DbComparableRow[]
  dbAnalysis?: DbAnalysisRow | null
  dbSoldHistory?: DbSoldRecord[]

  // User data (from hooks)
  userName?: string
  userTier?: "FREE" | "PRO"
  effectiveRegion?: string
  currency?: string
  formatPrice?: (usdAmount: number) => string

  // Token data
  tokens?: number
  analysesRemaining?: number
  hasAnalyzedCurrentCar?: boolean
}

export type Intent =
  | "greeting"
  | "valuation"
  | "investment"
  | "risks"
  | "strengths"
  | "specs"
  | "inspection"
  | "ownership-costs"
  | "shipping"
  | "regional-comparison"
  | "market-overview"
  | "report"
  | "comparables"
  | "thanks"
  | "help"
  | "unknown"

export type DetectedLanguage = "en" | "es" | "fr" | "pt" | "de" | "it" | "ja"

export interface AdvisorChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  initialContext?: {
    car?: CollectorCar
    make?: string
    dbMarketData?: DbMarketDataRow | null
    dbComparables?: DbComparableRow[]
    dbAnalysis?: DbAnalysisRow | null
    dbSoldHistory?: DbSoldRecord[]
  }
}
