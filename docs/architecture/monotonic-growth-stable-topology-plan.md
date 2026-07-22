# Monotonic growth and stable cross-stage topology

## Implementation audit

The active extension record contains lifecycle identity (`plantId`, `seed`), revision,
type/location, stage/progress, health/hydration/flowers, weather and mood/summary, and
creation/update/weather timestamps. Revisionless legacy records migrate to revision 0;
whole-record saves reject a different plant ID or stale same-plant revision. Before this
phase, `updatedAt` doubled as the processing cursor, stage progress advanced independently,
and only one stage could be crossed per update. The single subtraction preserved small
overflow but discarded larger earned growth through the 100 clamp and one-stage limit.

Grammar selection was seeded by visual seed plus stage, turtle detail by visual seed plus
stage, and iterations, scale, jitter, succulent leaf count, and grammar flowers all changed
with stage. Persisted `flowerCount` also stamped flowers, producing two flower authorities.
`createdAt` means lifecycle birth, `updatedAt` last saved advancement,
`weatherUpdatedAt` last weather application, and weather `fetchedAt` observation time.
Manual refresh delegates to the service worker, which serializes mutation requests and
uses plant-ID/revision checked saves. A failed forced weather fetch still advances elapsed
time with cached weather; prior code could apply that same observation again. Existing
Node tests cover migration, revision/ID rejection, lifecycle completion/archive/reset,
weather rules, renderer compatibility/determinism, delegation, and same-stage topology.

## Focused implementation plan

- **Modify:** extension shared state and worker-facing semantics; plant-core snapshot schema;
  renderer source/generated bundle; lifecycle and renderer tests.
- **Add:** this audit and plan.
- **State model:** persist monotonic `totalGrowth` (0–400), derive stage/progress from it,
  add `processedThrough` and `lastWeatherObservationAt` idempotency cursors.
- **Migration:** derive lifetime growth from legacy stage/progress, preserve seed 0, revision,
  timestamps, lifecycle identity, completion archives, and current schema compatibility.
- **Renderer:** generate one mature seeded structure, expose append-only stage prefixes, and
  render flowers exclusively from `flowerCount`.
- **Weather:** consume each elapsed interval and fetched observation at most once, including
  forced refresh failures that reuse cached weather.
- **Tests:** monotonicity, multi-boundary overflow, derivation/migration, interval and weather
  idempotency, append-only topology, and authoritative flowers.
- **Risks:** additive snapshot fields affect strict consumers; legacy contradictory
  stage/progress must resolve deterministically; generated browser output can drift. The
  normalizer, compatibility tests, and generated-bundle verification cover these risks.
