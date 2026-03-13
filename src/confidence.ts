/**
 * Confidence Score & Bayesian Blending
 *
 * The prediction engine combines two information sources:
 *   1. Mendelian theory  — pure math, works with zero data
 *   2. Observed ratios   — recorded by breeders over real clutches
 *
 * `confidence` controls how much weight observed data carries vs. theory.
 * It grows from 0 (no data → pure Mendelian) toward 1 (many samples → pure observed).
 *
 * Full article: https://dev.to/dusttoo/i-built-a-phenotype-generator-for-crested-gecko-genetics-heres-how-i-modeled-a-hobby-that-cant-34kl
 */

import type { InheritanceRates } from './phenotype-resolver'


// ---------------------------------------------------------------------------
// Confidence formula
//
// SQL equivalent (runs inside a PostgreSQL trigger on each recorded clutch):
//
//   confidence_score = 1.0 - (1.0 / (1.0 + total_offspring::DECIMAL / 10.0))
//
// This is a sigmoid that maps sample count → [0, 1):
//
//   n =  0  → confidence ≈ 0.00  (no data; use pure Mendelian)
//   n =  5  → confidence ≈ 0.33
//   n = 10  → confidence ≈ 0.50  (half-weight to observed data)
//   n = 20  → confidence ≈ 0.67
//   n = 30  → confidence ≈ 0.75  (three-quarters weight to observed data)
//   n → ∞   → confidence → 1.00  (asymptote; never fully abandons theory)
//
// The divisor (10) is tuned for crested gecko clutch realities: most breeders
// work with small sample sizes, so the curve is intentionally gentle —
// 10 samples is not enough to fully trust the data, but it's enough to
// start meaningfully displacing the theoretical prior.
// ---------------------------------------------------------------------------

export function calculateConfidence(totalOffspring: number): number {
  return 1.0 - (1.0 / (1.0 + totalOffspring / 10.0))
}


// ---------------------------------------------------------------------------
// Blending Mendelian theory with observed data
//
// confidence=0.0  → 100% Mendelian math (no recorded offspring yet)
// confidence=0.5  → 50/50 blend (~10 recorded offspring)
// confidence=1.0  → 100% observed data (theoretical limit; never fully reached)
//
// The blend is a simple weighted average of two probability distributions.
// Each distribution sums to 1.0 (hom + het + absent = 1.0).
// ---------------------------------------------------------------------------

export function blendPrediction(
  mendelian:  InheritanceRates,
  observed:   InheritanceRates | null,
  confidence: number
): InheritanceRates {
  // No observed data yet — return pure Mendelian math.
  if (!observed || confidence === 0) {
    return mendelian
  }

  return {
    hom:    mendelian.hom    * (1 - confidence) + observed.hom    * confidence,
    het:    mendelian.het    * (1 - confidence) + observed.het    * confidence,
    absent: mendelian.absent * (1 - confidence) + observed.absent * confidence,
  }
}


// ---------------------------------------------------------------------------
// Example: walkthrough of confidence blending at different sample sizes
// ---------------------------------------------------------------------------

export function exampleBlendWalkthrough(): void {
  // Pure Mendelian for a HET × HET recessive pairing: 25% HOM, 50% HET, 25% absent
  const mendelian: InheritanceRates = { hom: 0.25, het: 0.50, absent: 0.25 }

  // Hypothetical observed ratios from real recorded clutches
  // (e.g. this trait is expressing more strongly than theory predicts)
  const observed: InheritanceRates  = { hom: 0.35, het: 0.45, absent: 0.20 }

  const sampleSizes = [0, 5, 10, 20, 30, 100]

  console.log('Sample blending walkthrough — HET × HET recessive cross\n')
  console.log('n\tconfidence\thom\t\thet\t\tabsent')
  console.log('─'.repeat(72))

  for (const n of sampleSizes) {
    const confidence = calculateConfidence(n)
    const blended    = blendPrediction(mendelian, observed, confidence)

    console.log(
      `${n}\t` +
      `${confidence.toFixed(3)}\t\t` +
      `${(blended.hom    * 100).toFixed(1)}%\t\t` +
      `${(blended.het    * 100).toFixed(1)}%\t\t` +
      `${(blended.absent * 100).toFixed(1)}%`
    )
  }
}

// Run the walkthrough:  npx tsx src/confidence.ts
if (require.main === module) {
  exampleBlendWalkthrough()
}
