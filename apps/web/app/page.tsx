import {
  PLANT_STATE_SCHEMA_VERSION,
  defaultPlantStateSnapshot,
  isPlantStateSnapshot,
  normalizePlantStateSnapshot,
  type PlantStateSnapshot,
} from '@plant/plant-core';

const exampleSnapshot: PlantStateSnapshot = normalizePlantStateSnapshot({
  ...defaultPlantStateSnapshot,
  plantType: 'fern',
  location: 'Local extension storage remains the source of truth',
  seed: 42,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
});

export default function HomePage() {
  const contractStatus = isPlantStateSnapshot(exampleSnapshot) ? 'Shared contract loaded' : 'Contract unavailable';

  return (
    <section className="hero" aria-labelledby="home-title">
      <p className="eyebrow">Phase 0.75 web workspace</p>
      <h1 id="home-title">A minimal shell for the future Plant Companion website.</h1>
      <p>
        This app is independently buildable from the Chrome extension and currently demonstrates
        read-only consumption of the shared plant-state contract.
      </p>
      <dl className="contract-card" aria-label="Shared plant contract status">
        <div>
          <dt>Plant schema version</dt>
          <dd>{PLANT_STATE_SCHEMA_VERSION}</dd>
        </div>
        <div>
          <dt>Guard status</dt>
          <dd>{contractStatus}</dd>
        </div>
      </dl>
    </section>
  );
}
