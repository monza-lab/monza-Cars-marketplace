export function resolveReportAccess({
  serverHasAccess,
  tokenHasAccess = false,
}: {
  serverHasAccess: boolean
  tokenHasAccess?: boolean
}): boolean {
  return serverHasAccess || tokenHasAccess
}

export function resolveVisibleV3Report<T>({
  serverReport,
  streamedReport,
}: {
  serverReport: T | null
  streamedReport: T | null
}): T | null {
  return serverReport ?? streamedReport
}

export type ReportSummaryVerdict = "buy" | "watch" | "walk" | "hold" | null

export function resolveReportSummaryVerdict({
  executiveVerdict,
  fallbackVerdict,
}: {
  executiveVerdict: unknown
  fallbackVerdict: ReportSummaryVerdict
}): ReportSummaryVerdict {
  if (typeof executiveVerdict !== "string") return fallbackVerdict

  const normalized = executiveVerdict.toLowerCase()
  return normalized === "buy"
    || normalized === "watch"
    || normalized === "walk"
    || normalized === "hold"
    ? normalized
    : fallbackVerdict
}

export function shouldRefreshProfileAfterGenerationAttempt({
  needsPaywall,
  userAborted,
}: {
  needsPaywall: boolean
  userAborted: boolean
}): boolean {
  return !needsPaywall && !userAborted
}

export function shouldRequestReportGenerationOnUnlock({
  hasAuthenticatedProfile,
  reportAlreadyGenerated,
}: {
  hasAuthenticatedProfile: boolean
  reportAlreadyGenerated: boolean
}): boolean {
  return hasAuthenticatedProfile || !reportAlreadyGenerated
}

export function shouldPromptAuthBeforeReportUnlock({
  hasAuthenticatedProfile,
}: {
  hasAuthenticatedProfile: boolean
}): boolean {
  return !hasAuthenticatedProfile
}

export type ReportPrimaryAction = "download" | "generate" | "unlock"

export function resolveReportPrimaryAction({
  hasAccess,
  reportAlreadyGenerated,
}: {
  hasAccess: boolean
  reportAlreadyGenerated: boolean
}): ReportPrimaryAction {
  if (hasAccess && reportAlreadyGenerated) return "download"
  if (hasAccess) return "generate"
  return "unlock"
}

export function shouldAllowReportUnlockAttempt({
  spendableBalance,
  cost,
  unlimitedReports,
}: {
  spendableBalance: number
  cost: number
  unlimitedReports: boolean
}): boolean {
  return unlimitedReports || spendableBalance >= cost
}
