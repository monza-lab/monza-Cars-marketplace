import type { CollectorCar } from "@/lib/curatedCars"
import type { DbMarketDataRow, DbComparableRow, DbAnalysisRow, DbSoldRecord } from "@/lib/db/queries"

export interface AdvisorChatProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Optional seed conversation id — used by the Oracle → Chat handoff (Phase 6). */
  conversationId?: string | null
  initialContext?: {
    car?: CollectorCar
    make?: string
    dbMarketData?: DbMarketDataRow | null
    dbComparables?: DbComparableRow[]
    dbAnalysis?: DbAnalysisRow | null
    dbSoldHistory?: DbSoldRecord[]
  }
}
