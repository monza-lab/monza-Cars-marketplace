export function resolveReportAccess({
  serverHasAccess,
  localHasAnalyzed,
}: {
  serverHasAccess: boolean
  localHasAnalyzed: boolean
}): boolean {
  return serverHasAccess || localHasAnalyzed
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
