-- =============================================================================
-- Reptile Genetics Engine — Core Schema
-- =============================================================================
-- Companion reference for the Dev.to article:
-- https://dev.to/dusttoo/i-built-a-phenotype-generator-for-crested-gecko-genetics-heres-how-i-modeled-a-hobby-that-cant-34kl
--
-- This is a simplified, readable version of the production schema.
-- It covers the three tables that form the core of the genetics rule system.
-- The full production schema also includes: allele_cross_statistics,
-- breeding_outcome_records, prediction_sessions, and combo_morph tables.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------

CREATE TYPE dominance_pattern AS ENUM (
  'DOMINANT',
  'RECESSIVE',
  'INCOMPLETE_DOMINANT',
  'CO_DOMINANT',
  'POLYGENIC',
  'FIXED',
  'UNKNOWN'     -- first-class value, not a missing field; treated conservatively
);

CREATE TYPE allele_trait_category AS ENUM (
  'BASE_COLOR',         -- e.g. Red Base, Yellow
  'PATTERN_MODIFIER',   -- e.g. Harlequin, Phantom
  'COLOR_MODIFIER',     -- e.g. Cappuccino
  'STRUCTURAL',         -- e.g. Crested, Eyelash
  'SPECIAL_TRAIT',      -- e.g. Lilly White
  'UNKNOWN'
);

-- Drives the interaction logic in the resolution engine.
-- New relationship types can be added via ALTER TYPE as community
-- consensus forms — no application code change required.
CREATE TYPE allele_relationship_type AS ENUM (
  'SUPPRESSES',         -- source allele masks expression of target allele
  'REQUIRES',           -- source allele only expresses when target is present
  'ENHANCES',           -- source allele intensifies target allele expression
  'LETHAL_HOMOZYGOUS',  -- homozygous form of this allele is non-viable (e.g. Lilly White)
  'INTERACTS_WITH'      -- general interaction; used when mechanism is unclear
);


-- -----------------------------------------------------------------------------
-- ALLELES
-- The genetics rule library. One row per inheritable trait variant.
-- Rules live here rather than in application code so they can be updated
-- without a deployment.
-- -----------------------------------------------------------------------------

CREATE TABLE alleles (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gene_locus_code     TEXT NOT NULL UNIQUE,  -- short breeder notation: "LW", "PH", "y"
  common_name         TEXT NOT NULL,          -- human-readable: "Lilly White", "Phantom", "Yellow"
  trait_category      allele_trait_category[] NOT NULL,
  dominance_pattern   dominance_pattern NOT NULL,
  allele_notations    TEXT[],                 -- e.g. ["LW+", "lw"] — het vs hom notation
  notes_evidence      TEXT,                   -- source notes, community references
  identification_tips TEXT,                   -- visual ID guidance for breeders
  historical_notes    TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);


-- -----------------------------------------------------------------------------
-- ALLELE_RELATIONSHIPS
-- Encodes interaction rules between allele pairs.
--
-- Key design: the relationship_type enum is the mechanism for adding new
-- rule types without touching code. "Can these two coexist?" and "Does one
-- mask the other?" are answered by querying this table, not by branching
-- in application logic.
--
-- Example rows:
--   Lilly White → Lilly White, LETHAL_HOMOZYGOUS
--   Sable       → Cappuccino,  SUPPRESSES  (same locus — can't carry both)
-- -----------------------------------------------------------------------------

CREATE TABLE allele_relationships (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_allele_id    UUID NOT NULL REFERENCES alleles(id) ON DELETE CASCADE,
  target_allele_id    UUID NOT NULL REFERENCES alleles(id) ON DELETE CASCADE,
  relationship_type   allele_relationship_type NOT NULL,
  notes               TEXT,
  created_at          TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(source_allele_id, target_allele_id, relationship_type)
);


-- -----------------------------------------------------------------------------
-- GECKO_ALLELES
-- Junction table linking a specific gecko to the alleles it carries.
--
-- `visibility` is the pragmatic escape hatch. When a gecko's visual expression
-- doesn't match what genetics predict, a breeder can set this field and the
-- resolution engine will respect the override rather than fighting the breeder.
--
-- `expression_score` (1–10) captures analog intensity for polygenic traits
-- without forcing false precision. A "Strong" expression is not the same as
-- a "Present" one, but there's no genotype notation that captures the gradient.
-- -----------------------------------------------------------------------------

CREATE TABLE gecko_alleles (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  gecko_id         UUID NOT NULL REFERENCES geckos(id) ON DELETE CASCADE,
  allele_id        UUID NOT NULL REFERENCES alleles(id),
  is_homozygous    BOOLEAN NOT NULL DEFAULT FALSE,

  -- Breeder override for visual expression.
  -- When set to anything other than 'visual', the engine skips genetics logic
  -- for this gecko-allele pair and uses the override directly.
  visibility       TEXT NOT NULL DEFAULT 'visual'
                   CHECK (visibility IN ('visual', 'not_visual', 'possible_het', '100%_het', 'unknown')),

  -- Optional: 1–10 expression intensity. Meaningful for POLYGENIC traits.
  -- NULL for traits where zygosity (HOM/HET) is the only relevant dimension.
  expression_score SMALLINT CHECK (expression_score IS NULL OR expression_score BETWEEN 1 AND 10),

  notes            TEXT,
  created_at       TIMESTAMPTZ DEFAULT NOW(),

  UNIQUE(gecko_id, allele_id)
);
