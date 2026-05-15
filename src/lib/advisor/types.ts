import type { CollectorCar } from "@/lib/curatedCars"

export type AdvisorSurface =
  | "dashboard"
  | "marketplace-series"
  | "car-detail"
  | "report"
  | "other"

export interface ChatContext {
  surface: AdvisorSurface
  /** Locale prefix from the URL (e.g., "en"). Used to localize chip labels. */
  locale: string
  /** When the user is viewing a specific car (car-detail or report), this is populated. */
  car: CollectorCar | null
  /** When inside the report page, this is the section ID currently in viewport. */
  activeSection:
    | "summary"
    | "identity"
    | "valuation"
    | "performance"
    | "risk"
    | "dueDiligence"
    | "marketContext"
    | "similar"
    | "verdict"
    | null
  /** When on a series marketplace (e.g., /cars/porsche?family=992), this is populated. */
  seriesId: string | null
}

export interface Suggestion {
  /** Short label shown on the chip (≤ 6 words). */
  label: string
  /** The prompt sent to the advisor API when the user taps the chip. */
  prompt: string
}
