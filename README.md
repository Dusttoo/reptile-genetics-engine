# Reptile Genetics Engine — Code Reference

Companion codebase for the Dev.to article:
**[Building a Phenotype Generator When the Domain Experts Disagree](https://dev.to/dusttoo/i-built-a-phenotype-generator-for-crested-gecko-genetics-heres-how-i-modeled-a-hobby-that-cant-34kl)**

This repo contains isolated, runnable versions of the core genetic rule engine built into [Geckistry](https://geckistry.com). Everything here is extracted from the production system and written for readability — the article explains the *why* behind each design decision.

---

## What's in Here

| File | What it covers |
|------|----------------|
| [`src/dominance-pattern.ts`](src/dominance-pattern.ts) | `DominancePattern` enum with inline comments for all 7 cases including `UNKNOWN` as a first-class epistemic state |
| [`src/schema.sql`](src/schema.sql) | `alleles`, `allele_relationships`, and `gecko_alleles` tables — the rule library that lives in the database rather than in code |
| [`src/phenotype-resolver.ts`](src/phenotype-resolver.ts) | Core resolution logic covering `LETHAL_HOMOZYGOUS`, `SUPPRESSES`, `POLYGENIC`, visibility overrides, and all dominance patterns |
| [`src/confidence.ts`](src/confidence.ts) | Sigmoid confidence formula and Bayesian blending function that displaces Mendelian theory with observed breeding data over time |

---

## Running the Examples

No build step required. Clone the repo, install dependencies, then use the npm scripts:

```bash
npm install

# Sigmoid confidence blending walkthrough — shows theory vs. observed blend
# across sample sizes n=0, 5, 10, 20, 30, 100
npm run confidence

# All five resolver cases: multi-trait gecko, Lilly White het/hom,
# Sable/Cappuccino suppression, and polygenic probability priors
npm run resolver
```

Both scripts use [`tsx`](https://github.com/privatenumber/tsx) (installed locally as a dev dependency) — no global installs needed.

---

## The Core Ideas

### The genetics rule system lives in the database, not in code

Crested gecko genetics is a moving target. Community consensus on how traits inherit changes as more breeders document results. Keeping rules in `allele_relationships` rows means updating a trait's behavior is a data migration, not a deployment.

### `UNKNOWN` is a first-class value

```typescript
export type DominancePattern =
  | 'DOMINANT'
  | 'RECESSIVE'
  // ...
  | 'UNKNOWN'  // not a missing field — an honest epistemic state
```

The system treats `UNKNOWN` conservatively (like recessive) rather than producing a confident wrong answer.

### Confidence blends theory with observation

```
confidence = 1 - 1 / (1 + n / 10)

n =  0  →  0.00  (pure Mendelian math)
n = 10  →  0.50  (half-weight to observed data)
n = 30  →  0.75
n → ∞   →  1.00  (asymptote)
```

At zero samples the engine uses textbook genetics. As breeders record clutch outcomes, observed ratios gradually displace the theory. The curve is tuned for small clutch sizes.

### Warnings, not errors

`LETHAL_HOMOZYGOUS` relationships surface as entries in a `warnings: string[]` array, not thrown exceptions. Breeders are domain experts so the system informs, it doesn't block.

---

## Full Article

The article covers:
- Why crested gecko genetics can't be modeled with basic Mendelian rules
- The full data model and why rules live in the database
- Lilly White's lethal homozygous case in detail
- Sable/Cappuccino as a same-locus suppression problem
- Polygenic traits and where the hobby's knowledge runs out
- The reverse inference engine (phenotype → genotype)

→ **[Read it on Dev.to](https://dev.to/dusttoo/i-built-a-phenotype-generator-for-crested-gecko-genetics-heres-how-i-modeled-a-hobby-that-cant-34kl)**

---

## About

Built by [Dusty](https://builtbydusty.com) — a software studio building custom applications for small businesses and animal breeders. The production system runs inside [Geckistry](https://geckistry.com) and is being extended to additional species through [ReptiDex](https://reptidex.com).
