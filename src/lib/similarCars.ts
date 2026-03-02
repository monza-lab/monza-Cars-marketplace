import type { CollectorCar } from "./curatedCars"
import { extractSeries, getSeriesConfig } from "./brandConfig"

// ─── TYPES ───

export interface SimilarCarResult {
  car: CollectorCar
  score: number
  matchReasons: string[]
}

// ─── GRADE HIERARCHY ───

const GRADE_ORDER = ["AAA", "AA", "A", "B+", "B", "C"] as const

function gradeDistance(a: string, b: string): number {
  const idxA = GRADE_ORDER.indexOf(a as typeof GRADE_ORDER[number])
  const idxB = GRADE_ORDER.indexOf(b as typeof GRADE_ORDER[number])
  if (idxA === -1 || idxB === -1) return 99
  return Math.abs(idxA - idxB)
}

// ─── TRANSMISSION NORMALIZATION ───

function isManual(transmission: string): boolean {
  const t = transmission.toLowerCase()
  return t.includes("manual") || t.includes("stick") || t.includes("6-speed") || t.includes("5-speed") || t.includes("4-speed")
}

// ─── SCORING ENGINE ───

function scoreSimilarity(target: CollectorCar, candidate: CollectorCar): { score: number; reasons: string[] } {
  let score = 0
  const reasons: string[] = []

  // 1. Series match (strongest signal — same generation)
  const targetSeries = extractSeries(target.model, target.year, target.make)
  const candidateSeries = extractSeries(candidate.model, candidate.year, candidate.make)

  if (targetSeries && candidateSeries && targetSeries === candidateSeries) {
    score += 50
    const config = getSeriesConfig(targetSeries, target.make)
    reasons.push(`Same generation (${config?.label || targetSeries})`)
  } else {
    // 2. Family match (same lineage — e.g. 992 ↔ 991, both "911 Family")
    const targetConfig = targetSeries ? getSeriesConfig(targetSeries, target.make) : null
    const candidateConfig = candidateSeries ? getSeriesConfig(candidateSeries, candidate.make) : null

    if (targetConfig && candidateConfig && targetConfig.family === candidateConfig.family) {
      score += 25
      reasons.push(`Same lineage (${targetConfig.family})`)
    }
  }

  // 3. Same make
  if (candidate.make.toLowerCase() === target.make.toLowerCase()) {
    score += 10
  }

  // 4. Year proximity
  const yearDiff = Math.abs(target.year - candidate.year)
  if (yearDiff <= 3) {
    score += 15
    reasons.push("Similar era")
  } else if (yearDiff <= 7) {
    score += 8
  }

  // 5. Price similarity
  const targetPrice = target.currentBid || target.price
  const candidatePrice = candidate.currentBid || candidate.price
  if (targetPrice > 0 && candidatePrice > 0) {
    const ratio = candidatePrice / targetPrice
    if (ratio >= 0.7 && ratio <= 1.3) {
      score += 20
      reasons.push("Similar price range")
    } else if (ratio >= 0.5 && ratio <= 1.5) {
      score += 10
    }
  }

  // 6. Investment grade match
  const gDist = gradeDistance(target.investmentGrade, candidate.investmentGrade)
  if (gDist === 0) {
    score += 15
    reasons.push(`${candidate.investmentGrade} grade`)
  } else if (gDist === 1) {
    score += 8
  }

  // 7. Transmission match
  if (target.transmission && candidate.transmission) {
    const bothManual = isManual(target.transmission) && isManual(candidate.transmission)
    const bothAuto = !isManual(target.transmission) && !isManual(candidate.transmission)
    if (bothManual || bothAuto) {
      score += 5
      if (bothManual) reasons.push("Manual transmission")
    }
  }

  // 8. Mileage proximity
  if (target.mileage > 0 && candidate.mileage > 0) {
    const mileageRatio = candidate.mileage / target.mileage
    if (mileageRatio >= 0.7 && mileageRatio <= 1.3) {
      score += 5
      reasons.push("Similar mileage")
    }
  }

  return { score, reasons }
}

// ─── PUBLIC API ───

/**
 * Find similar cars using professional multi-criteria scoring.
 * Returns results sorted by relevance score (highest first).
 * Minimum score of 20 to exclude irrelevant matches.
 */
export function findSimilarCars(
  target: CollectorCar,
  candidates: CollectorCar[],
  limit = 6,
): SimilarCarResult[] {
  const MIN_SCORE = 20

  return candidates
    .map(car => {
      const { score, reasons } = scoreSimilarity(target, car)
      return { car, score, matchReasons: reasons }
    })
    .filter(r => r.score >= MIN_SCORE)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
}
