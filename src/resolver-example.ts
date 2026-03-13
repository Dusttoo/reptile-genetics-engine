/**
 * Resolver examples — mirrors the three cases from the article:
 *   1. Basic multi-trait gecko (Yellow, Harlequin, het Empty Back, het Phantom)
 *   2. Adding Lilly White heterozygous
 *   3. Lilly White homozygous (LETHAL_HOMOZYGOUS warning triggered manually)
 *   4. Sable + Cappuccino on same gecko (SUPPRESSES)
 */

import { resolveGeckoAlleles, checkAlleleWarnings, calculatePolygenicRates } from './phenotype-resolver'
import type { GeckoAllele, AlleleRelationship, InheritanceRates } from './phenotype-resolver'

// ---------------------------------------------------------------------------
// Shared relationship definitions
// ---------------------------------------------------------------------------

const RELATIONSHIPS: AlleleRelationship[] = [
  {
    source_allele_id:  'lw',
    target_allele_id:  'lw',
    relationship_type: 'LETHAL_HOMOZYGOUS',
    notes: 'Super Lilly White (LW/LW) is embryonic lethal.',
  },
  {
    source_allele_id:  'sable',
    target_allele_id:  'cappuccino',
    relationship_type: 'SUPPRESSES',
    notes: 'Sable and Cappuccino occupy the same locus — only one can express.',
  },
]

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------

function printResult(label: string, alleles: GeckoAllele[]): void {
  const result = resolveGeckoAlleles(alleles, RELATIONSHIPS)

  console.log(`\n${'═'.repeat(60)}`)
  console.log(`  ${label}`)
  console.log('═'.repeat(60))

  if (result.visibleTraits.length) {
    console.log('\nVisible traits:')
    for (const t of result.visibleTraits) {
      const label = t.inheritanceLabel ? ` [${t.inheritanceLabel}]` : ''
      const notation = t.genotypeNotation ? ` (${t.genotypeNotation})` : ''
      console.log(`  ✓ ${t.name}${label}${notation}`)
    }
  }

  if (result.carriedTraits.length) {
    console.log('\nCarried (het) traits:')
    for (const t of result.carriedTraits) {
      console.log(`  ~ ${t.name} [${t.inheritanceLabel}] (${t.genotypeNotation})`)
    }
  }

  if (result.suppressedTraits.length) {
    console.log('\nSuppressed traits:')
    for (const t of result.suppressedTraits) {
      console.log(`  ✗ ${t.name} — suppressed by: ${t.suppressedBy}`)
    }
  }

  if (result.warnings.length) {
    console.log('\nWarnings:')
    for (const w of result.warnings) {
      console.log(`  ⚠ ${w}`)
    }
  }
}

// ---------------------------------------------------------------------------
// Case 1: Basic multi-trait gecko from the article
//   Yellow (dominant, het) + Harlequin (dominant, hom) +
//   Empty Back (recessive, het) + Phantom (recessive, het)
// ---------------------------------------------------------------------------

const case1: GeckoAllele[] = [
  { allele_id: 'y',  common_name: 'Yellow',      gene_locus_code: 'y',  dominance_pattern: 'DOMINANT',  is_homozygous: false, visibility: 'visual' },
  { allele_id: 'hr', common_name: 'Harlequin',   gene_locus_code: 'HR', dominance_pattern: 'DOMINANT',  is_homozygous: true,  visibility: 'visual' },
  { allele_id: 'eb', common_name: 'Empty Back',  gene_locus_code: 'EB', dominance_pattern: 'RECESSIVE', is_homozygous: false, visibility: 'visual' },
  { allele_id: 'ph', common_name: 'Phantom',     gene_locus_code: 'PH', dominance_pattern: 'RECESSIVE', is_homozygous: false, visibility: 'visual' },
]

printResult('Case 1 — Yellow Based Harlequin, het EB, het Phantom', case1)

// ---------------------------------------------------------------------------
// Case 2: Add Lilly White heterozygous (INCOMPLETE_DOMINANT)
// ---------------------------------------------------------------------------

const case2: GeckoAllele[] = [
  ...case1,
  { allele_id: 'lw', common_name: 'Lilly White', gene_locus_code: 'LW', dominance_pattern: 'INCOMPLETE_DOMINANT', is_homozygous: false, visibility: 'visual' },
]

printResult('Case 2 — Add Lilly White het (LW/+)', case2)

// ---------------------------------------------------------------------------
// Case 3: Lilly White homozygous — lethal warning via checkAlleleWarnings
// (Triggered during pairing prediction, not single-gecko resolution)
// ---------------------------------------------------------------------------

const case3: GeckoAllele[] = [
  ...case1,
  { allele_id: 'lw', common_name: 'Lilly White', gene_locus_code: 'LW', dominance_pattern: 'INCOMPLETE_DOMINANT', is_homozygous: true, visibility: 'visual' },
]

// Simulate the warning check the pairing engine runs when it sees hom > 0
const lwRates: InheritanceRates = { hom: 0.25, het: 0.50, absent: 0.25 }
const lwWarnings = checkAlleleWarnings(
  'lw',
  'Lilly White',
  lwRates,
  RELATIONSHIPS,
  new Set(['lw'])
)

const case3Result = resolveGeckoAlleles(case3, RELATIONSHIPS)
case3Result.warnings.push(...lwWarnings)

console.log(`\n${'═'.repeat(60)}`)
console.log('  Case 3 — Lilly White homozygous (Super / lethal)')
console.log('═'.repeat(60))
console.log('\nVisible traits:')
for (const t of case3Result.visibleTraits) {
  const label = t.inheritanceLabel ? ` [${t.inheritanceLabel}]` : ''
  console.log(`  ✓ ${t.name}${label} (${t.genotypeNotation ?? 'polygenic'})`)
}
console.log('\nWarnings:')
for (const w of case3Result.warnings) {
  console.log(`  ⚠ ${w}`)
}

// ---------------------------------------------------------------------------
// Case 4: Sable + Cappuccino on same gecko — SUPPRESSES relationship
// ---------------------------------------------------------------------------

const case4: GeckoAllele[] = [
  { allele_id: 'sable',      common_name: 'Sable',      gene_locus_code: 'Sa', dominance_pattern: 'DOMINANT', is_homozygous: false, visibility: 'visual' },
  { allele_id: 'cappuccino', common_name: 'Cappuccino', gene_locus_code: 'Ca', dominance_pattern: 'DOMINANT', is_homozygous: false, visibility: 'visual' },
]

printResult('Case 4 — Sable SUPPRESSES Cappuccino (same locus)', case4)

// ---------------------------------------------------------------------------
// Case 5: Polygenic trait probability estimates
// ---------------------------------------------------------------------------

console.log(`\n${'═'.repeat(60)}`)
console.log('  Case 5 — Polygenic probability priors')
console.log('═'.repeat(60))

const polygenicCases: Array<{ label: string; sire: 'HOM' | 'HET' | 'ABSENT'; dam: 'HOM' | 'HET' | 'ABSENT' }> = [
  { label: 'Both parents express',    sire: 'HET', dam: 'HET'    },
  { label: 'One parent expresses',    sire: 'HET', dam: 'ABSENT' },
  { label: 'Neither parent expresses', sire: 'ABSENT', dam: 'ABSENT' },
]

for (const { label, sire, dam } of polygenicCases) {
  const rates = calculatePolygenicRates(sire, dam)
  console.log(`\n  ${label} (sire: ${sire}, dam: ${dam})`)
  console.log(`    hom: ${(rates.hom * 100).toFixed(0)}%  het: ${(rates.het * 100).toFixed(0)}%  absent: ${(rates.absent * 100).toFixed(0)}%`)
}

console.log('')
