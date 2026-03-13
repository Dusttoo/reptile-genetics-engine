/**
 * Phenotype Resolver — Standalone Reference Implementation
 *
 * Demonstrates the three interaction patterns that go beyond basic Mendelian
 * inheritance: LETHAL_HOMOZYGOUS, SUPPRESSES, and POLYGENIC.
 *
 * This is extracted and simplified from the production engine for readability.
 * Full article: https://dev.to/dusttoo/i-built-a-phenotype-generator-for-crested-gecko-genetics-heres-how-i-modeled-a-hobby-that-cant-34kl
 */

import type { DominancePattern } from './dominance-pattern'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type Zygosity = 'HOM' | 'HET' | 'ABSENT'

export type AlleleRelationshipType =
  | 'SUPPRESSES'
  | 'REQUIRES'
  | 'ENHANCES'
  | 'LETHAL_HOMOZYGOUS'
  | 'INTERACTS_WITH'

export interface AlleleRelationship {
  source_allele_id: string
  target_allele_id: string
  relationship_type: AlleleRelationshipType
  notes?: string | null
}

export interface GeckoAllele {
  allele_id:      string
  common_name:    string
  gene_locus_code: string
  dominance_pattern: DominancePattern
  is_homozygous:  boolean
  visibility:     'visual' | 'not_visual' | 'possible_het' | '100%_het' | 'unknown'
}

export interface InheritanceRates {
  hom:    number  // probability of homozygous offspring
  het:    number  // probability of heterozygous offspring
  absent: number  // probability of no expression
}

export interface ResolvedAllele {
  allele_id:         string
  name:              string
  zygosity:          Zygosity
  inheritanceLabel:  string | null  // "Het", "Super", "Strong", "Present", null
  genotypeNotation:  string | null  // "LW/+", "PH/PH" — null for POLYGENIC
  isVisible:         boolean
  suppressedBy:      string | null  // name of suppressing allele, if any
}

export interface ResolutionResult {
  visibleTraits:    ResolvedAllele[]
  carriedTraits:    ResolvedAllele[]  // het recessives — not visible but heritable
  suppressedTraits: ResolvedAllele[]  // present but masked
  warnings:         string[]          // non-blocking; surfaces lethal combinations etc.
}


// ---------------------------------------------------------------------------
// Polygenic probability priors
//
// These are observation-derived estimates, not Mendelian derivations.
// They represent the current state of community knowledge and are designed
// to be corrected as breeding data accumulates (see confidence.ts).
// ---------------------------------------------------------------------------

export function calculatePolygenicRates(
  sireZygosity: Zygosity,
  damZygosity:  Zygosity
): InheritanceRates {
  const sirePresent = sireZygosity !== 'ABSENT'
  const damPresent  = damZygosity  !== 'ABSENT'

  if (sirePresent && damPresent) {
    // Both parents express the trait
    return { hom: 0.30, het: 0.50, absent: 0.20 }
  }
  if (sirePresent || damPresent) {
    // One parent expresses the trait
    return { hom: 0.10, het: 0.40, absent: 0.50 }
  }
  // Neither parent expresses — still possible due to hidden polygenic contributions
  return { hom: 0.02, het: 0.08, absent: 0.90 }
}


// ---------------------------------------------------------------------------
// Warning checks
//
// Warnings are non-blocking by design. They surface into warnings: string[]
// rather than throwing errors. The system informs the breeder of consequences
// and lets them decide — the right call when users are domain experts.
// ---------------------------------------------------------------------------

export function checkAlleleWarnings(
  alleleId:      string,
  alleleName:    string,
  rates:         InheritanceRates,
  relationships: AlleleRelationship[],
  allAlleleIds:  Set<string>
): string[] {
  const warnings: string[] = []

  // LETHAL_HOMOZYGOUS — e.g. Lilly White × Lilly White produces non-viable HOM offspring.
  // Only warn if homozygous offspring are actually possible in this pairing.
  if (rates.hom > 0) {
    const lethalRels = relationships.filter(
      r =>
        r.relationship_type === 'LETHAL_HOMOZYGOUS' &&
        (r.source_allele_id === alleleId || r.target_allele_id === alleleId)
    )
    for (const rel of lethalRels) {
      warnings.push(
        `Homozygous ${alleleName} is lethal.` +
        (rel.notes ? ` ${rel.notes}` : '') +
        ` Offspring showing HOM for this allele will not survive.`
      )
    }
  }

  // SUPPRESSES (cross-allele) — warn when a suppressor is present in the parent set.
  // The per-gecko suppression check below handles the phenotype name; this surfaces
  // the interaction as an explicit warning for the breeder.
  const suppressors = relationships.filter(
    r =>
      r.relationship_type === 'SUPPRESSES' &&
      r.target_allele_id === alleleId &&
      allAlleleIds.has(r.source_allele_id)
  )
  for (const rel of suppressors) {
    warnings.push(
      `${alleleName} may be visually suppressed by another allele present in the parents.` +
      (rel.notes ? ` ${rel.notes}` : '')
    )
  }

  return warnings
}


// ---------------------------------------------------------------------------
// Core resolution function
// ---------------------------------------------------------------------------

export function resolveGeckoAlleles(
  alleles:       GeckoAllele[],
  relationships: AlleleRelationship[]
): ResolutionResult {
  const visibleTraits:    ResolvedAllele[] = []
  const carriedTraits:    ResolvedAllele[] = []
  const suppressedTraits: ResolvedAllele[] = []
  const warnings:         string[]         = []

  // Build the suppression map for this gecko's allele set.
  // Key: suppressed allele_id → name of the allele suppressing it.
  const suppressionMap = new Map<string, string>()
  const presentAlleleIds = new Set(alleles.map(a => a.allele_id))

  for (const rel of relationships) {
    if (rel.relationship_type !== 'SUPPRESSES') continue
    if (!presentAlleleIds.has(rel.source_allele_id)) continue
    if (!presentAlleleIds.has(rel.target_allele_id)) continue

    // Find the name of the suppressing allele for the output label
    const sourceName = alleles.find(a => a.allele_id === rel.source_allele_id)?.common_name ?? 'unknown'
    suppressionMap.set(rel.target_allele_id, sourceName)
  }

  for (const allele of alleles) {
    const { allele_id, common_name, dominance_pattern, is_homozygous, visibility } = allele
    const isHom = is_homozygous

    // ── Visibility override ────────────────────────────────────────────────
    // When a breeder has manually overridden the expression (e.g. the gecko
    // doesn't visually show a trait its genotype predicts), respect that and
    // skip genetics logic entirely for this allele.
    if (visibility === 'not_visual') {
      suppressedTraits.push({
        allele_id,
        name:             common_name,
        zygosity:         isHom ? 'HOM' : 'HET',
        inheritanceLabel: null,
        genotypeNotation: null,
        isVisible:        false,
        suppressedBy:     'manual override',
      })
      continue
    }

    // ── SUPPRESSES check ───────────────────────────────────────────────────
    // If another allele on this gecko suppresses this one, move it to
    // suppressedTraits rather than the phenotype name.
    if (suppressionMap.has(allele_id)) {
      suppressedTraits.push({
        allele_id,
        name:             common_name,
        zygosity:         isHom ? 'HOM' : 'HET',
        inheritanceLabel: null,
        genotypeNotation: null,
        isVisible:        false,
        suppressedBy:     suppressionMap.get(allele_id)!,
      })
      continue
    }

    // ── Pattern-specific resolution ────────────────────────────────────────

    switch (dominance_pattern) {

      case 'DOMINANT':
      case 'FIXED': {
        // One copy is sufficient. No HOM/HET distinction in the phenotype name —
        // HR/+ looks the same as HR/HR to a breeder.
        visibleTraits.push({
          allele_id,
          name:             common_name,
          zygosity:         isHom ? 'HOM' : 'HET',
          inheritanceLabel: null,
          genotypeNotation: null,
          isVisible:        true,
          suppressedBy:     null,
        })
        break
      }

      case 'RECESSIVE': {
        if (isHom) {
          // HOM recessive: fully visible.
          visibleTraits.push({
            allele_id,
            name:             common_name,
            zygosity:         'HOM',
            inheritanceLabel: null,
            genotypeNotation: `${allele.gene_locus_code}/${allele.gene_locus_code}`,
            isVisible:        true,
            suppressedBy:     null,
          })
        } else {
          // HET recessive: not visible but heritable. Goes to carriedTraits.
          carriedTraits.push({
            allele_id,
            name:             common_name,
            zygosity:         'HET',
            inheritanceLabel: 'Het',
            genotypeNotation: `${allele.gene_locus_code}/+`,
            isVisible:        false,
            suppressedBy:     null,
          })
        }
        break
      }

      case 'INCOMPLETE_DOMINANT': {
        // HET = standard expression. HOM = "Super" form — which for Lilly White is lethal.
        // The warning surfaces via checkAlleleWarnings (called by the pairing predictor),
        // not here in the single-gecko resolver.
        visibleTraits.push({
          allele_id,
          name:             common_name,
          zygosity:         isHom ? 'HOM' : 'HET',
          inheritanceLabel: isHom ? 'Super' : 'Het',
          genotypeNotation: isHom
            ? `${allele.gene_locus_code}/${allele.gene_locus_code}`
            : `${allele.gene_locus_code}/+`,
          isVisible:    true,
          suppressedBy: null,
        })
        break
      }

      case 'CO_DOMINANT': {
        // Both alleles simultaneously expressed and distinguishable — no blending.
        visibleTraits.push({
          allele_id,
          name:             common_name,
          zygosity:         isHom ? 'HOM' : 'HET',
          inheritanceLabel: isHom ? 'Homozygous' : null,
          genotypeNotation: isHom
            ? `${allele.gene_locus_code}/${allele.gene_locus_code}`
            : `${allele.gene_locus_code}/+`,
          isVisible:    true,
          suppressedBy: null,
        })
        break
      }

      case 'POLYGENIC': {
        // Mendelian ratios don't apply. HOM/HET notation is not meaningful —
        // expression intensity is the relevant dimension.
        // The engine outputs "Strong" or "Present" rather than inventing
        // precision the hobby doesn't have yet.
        visibleTraits.push({
          allele_id,
          name:             common_name,
          zygosity:         isHom ? 'HOM' : 'HET',
          inheritanceLabel: isHom ? 'Strong' : 'Present',
          genotypeNotation: null,  // intentionally absent for polygenic traits
          isVisible:        true,
          suppressedBy:     null,
        })
        break
      }

      case 'UNKNOWN': {
        // Treated conservatively like RECESSIVE until evidence says otherwise.
        // UNKNOWN is a first-class epistemic state, not an error or missing value.
        if (isHom) {
          visibleTraits.push({
            allele_id,
            name:             common_name,
            zygosity:         'HOM',
            inheritanceLabel: null,
            genotypeNotation: `${allele.gene_locus_code}/${allele.gene_locus_code}`,
            isVisible:        true,
            suppressedBy:     null,
          })
        } else {
          carriedTraits.push({
            allele_id,
            name:             common_name,
            zygosity:         'HET',
            inheritanceLabel: 'Het',
            genotypeNotation: `${allele.gene_locus_code}/+`,
            isVisible:        false,
            suppressedBy:     null,
          })
        }
        break
      }
    }
  }

  return { visibleTraits, carriedTraits, suppressedTraits, warnings }
}
