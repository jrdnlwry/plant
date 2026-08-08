# Persistent community-garden mature life

## Pre-implementation audit

Publication already created a distinct `garden_plants` row and retained the accepted
`canonical_snapshot`. Its identity, source/completed/publication IDs, contributor,
type/seed, timestamps, biome, garden and unique plot were publication-time data.
Root identity and generation were also present (generation 1 only). The only nominal
mutable fields were `status` (constrained to `active`) and `last_simulated_date`.

There was no garden scheduler, weather store, daily/catch-up simulation, hydration or
health mutation, or garden dormancy behavior. Public GETs used explicit service-role
selects and an allowlist serializer and never mutated rows. Publication retries were
transactional: a biome advisory lock protected placement and a unique publication
receipt returned an idempotent replay or conflict. The immutable snapshot supplied
the shared renderer directly, so published plants were frozen. Biomes existed for
placement, but no biome-level weather state existed.

## Implemented boundary

`canonical_snapshot` remains the immutable archival publication record. Adult life is
stored in typed columns beside it: mature stage, health, hydration, structural growth,
foliage, flowers, favorable/unhealthy streaks, dormancy date, and the existing last
simulation date. Existing rows are updated in place from their snapshots; IDs,
ownership, garden and plot are not changed. New publications initialize through a
trigger. Garden age is derived from `added_to_garden_at`, rather than incremented.

The stages are `active_growth`, `flourish`, `stress`, `dormant`, and `recovery` only.
Daily biome weather is persisted by biome/date. The service-role simulation RPC locks
eligible plant rows and advances only rows earlier than that date; a repeat date is a
no-op, and a conflicting retry of the weather record fails. Missed dates can be
submitted in chronological order, while the pure application catch-up helper processes
each elapsed date exactly once. Public reads do not invoke simulation.

Rain increases hydration; dry air and heat reduce it. Sustained unhealthy conditions
reduce health, foliage, flowers and at most one structural unit per day. Adult structure
is bounded to 300–480. Favorable days slowly add structure/foliage, exceptional sustained
health flourishes, cold winter conditions cause dormancy, and improved conditions enter
recovery before active growth. No random trial is used.

The renderer adapter copies mutable health, hydration and flower count onto a transient
render snapshot while forcing the existing adult stage 4 contract. The shared 32px
renderer does not currently scale topology with `totalGrowth` above 400 or accept a
foliage-density field, so stored adult structure is clamped to 400 for rendering and
foliage is represented conservatively through health/hydration thinning. The archival
snapshot is never overwritten.

## Reproduction extension point

The existing root/generation columns provide the beginning of lineage. A follow-up
should relax the generation constraint, add parent and offspring-count data, and run a
deterministic plant/date eligibility trial inside this same daily boundary. Successful
offspring placement must claim an adjacent plantable plot transactionally; no available
adjacent plot means defer/fail rather than distant placement.
