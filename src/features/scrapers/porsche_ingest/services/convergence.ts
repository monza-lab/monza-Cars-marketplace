export type ConvergenceState = {
  consecutiveZeroNew: number;
  totalNew: number;
};

export function nextConvergence(state: ConvergenceState, newIds: number): ConvergenceState {
  return {
    consecutiveZeroNew: newIds === 0 ? state.consecutiveZeroNew + 1 : 0,
    totalNew: state.totalNew + newIds,
  };
}

export function shouldStop(state: ConvergenceState, stopAfterZeroNew: number): boolean {
  return state.consecutiveZeroNew >= stopAfterZeroNew;
}
