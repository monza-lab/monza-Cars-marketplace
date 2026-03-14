const CANONICAL_SOURCE_COUNT = 7;

export function derivePerSourceLimit(globalLimit: number, sourceCount = CANONICAL_SOURCE_COUNT): number {
  const safeGlobalLimit = Number.isFinite(globalLimit) ? Math.max(1, Math.floor(globalLimit)) : 24;
  const safeSourceCount = Number.isFinite(sourceCount) ? Math.max(1, Math.floor(sourceCount)) : CANONICAL_SOURCE_COUNT;
  return Math.max(1, Math.ceil(safeGlobalLimit / safeSourceCount));
}
