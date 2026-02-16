export type OnboardingPreferences = {
  region: string | null       // Legacy single region (backwards compat)
  regions: string[]           // ["US", "EU", ...] — multi-select
  brands: string[]            // ["Ferrari", "Porsche", ...]
  intent: string | null       // "buy" | "track" | "learn" | null
  completedAt: number | null  // Date.now() when finished
}

const STORAGE_KEY = "monza_onboarding"

const DEFAULT: OnboardingPreferences = {
  region: null,
  regions: [],
  brands: [],
  intent: null,
  completedAt: null,
}

export function getOnboardingPreferences(): OnboardingPreferences {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT
    return { ...DEFAULT, ...JSON.parse(raw) }
  } catch {
    return DEFAULT
  }
}

export function saveOnboardingPreferences(prefs: OnboardingPreferences): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs))
  } catch {
    // ignore
  }
}

export function isOnboardingCompleted(): boolean {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const prefs = JSON.parse(raw) as OnboardingPreferences
    return !!prefs.completedAt
  } catch {
    return false
  }
}
