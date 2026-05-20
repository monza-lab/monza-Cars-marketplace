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
