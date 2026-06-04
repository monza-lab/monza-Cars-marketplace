export interface ReportPeerIdentity {
  make: string
  modelIdentity: string
}

interface ReportPeerIdentityInput {
  make?: string | null
  model?: string | null
}

export function normalizeReportPeerText(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[.,;:()[\]{}'"`]/g, " ")
    .replace(/[-_/]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
}

export function buildReportPeerIdentity(input: ReportPeerIdentityInput): ReportPeerIdentity | null {
  const make = normalizeReportPeerText(input.make)
  const modelIdentity = normalizeReportPeerText(input.model)
  if (!make || !modelIdentity) return null
  return { make, modelIdentity }
}

export function matchesReportPeerIdentity(
  target: ReportPeerIdentity | null,
  candidate: ReportPeerIdentityInput,
): boolean {
  if (!target) return false
  const candidateIdentity = buildReportPeerIdentity(candidate)
  if (!candidateIdentity) return false
  return (
    candidateIdentity.make === target.make &&
    candidateIdentity.modelIdentity === target.modelIdentity
  )
}
