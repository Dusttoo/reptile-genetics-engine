/**
 * DominancePattern
 *
 * Represents the full set of inheritance mechanisms the phenotype engine
 * must handle simultaneously. In real crested gecko genetics, multiple
 * patterns coexist in a single animal — this enum lets each allele declare
 * its own mechanism independently.
 *
 * Full article: https://dev.to/dusttoo/i-built-a-phenotype-generator-for-crested-gecko-genetics-heres-how-i-modeled-a-hobby-that-cant-34kl
 */
export type DominancePattern =
  /** One copy is sufficient for full expression. HR/+ looks the same as HR/HR. */
  | 'DOMINANT'

  /** Two copies required for expression. A single copy produces a carrier ("het")
   *  that looks like a wildtype but passes the allele to offspring. */
  | 'RECESSIVE'

  /** Heterozygotes show a visually distinct intermediate form. The classic
   *  crested gecko example is Lilly White: one copy (LW/+) produces the
   *  Lilly White phenotype; two copies (LW/LW) produce "Super" — and are lethal. */
  | 'INCOMPLETE_DOMINANT'

  /** Both alleles at a locus are simultaneously expressed and distinguishable
   *  in the phenotype. Unlike incomplete dominance, there is no blending. */
  | 'CO_DOMINANT'

  /** Controlled by multiple loci acting together; Mendelian ratios do not apply.
   *  The engine falls back to observation-derived probability estimates and
   *  uses soft language ("Strong" / "Present") instead of HOM/HET notation. */
  | 'POLYGENIC'

  /** Present in every animal of the species/line — no meaningful inheritance
   *  calculation is needed. Used for baseline or wildtype traits. */
  | 'FIXED'

  /**
   * UNKNOWN is not a missing field or an error state.
   *
   * It is a first-class value that explicitly encodes "the community has not
   * reached consensus on how this trait inherits." The engine treats UNKNOWN
   * conservatively (like recessive) rather than producing a confident
   * wrong answer. This is a deliberate epistemic choice, not a placeholder.
   */
  | 'UNKNOWN'
