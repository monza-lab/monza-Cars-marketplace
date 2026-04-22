export interface VariantDetails {
  seriesId: string
  variantId: string
  fullName: string
  yearRange: [number, number]
  productionTotal?: number
  productionByYear?: Record<number, number>
  chassisCodes?: string[]
  engineCode?: string
  transmissions?: string[]
  notableOptionCodes?: Array<{ code: string; description: string }>
  knownIssues?: Array<{ issue: string; affectedYears?: number[]; severity: "low" | "medium" | "high" }>
  notes?: string
}
