import { isPlantStateSnapshot } from '@plant/plant-core';
import { createPlantRenderModel } from '@plant/plant-renderer';
import { deterministicPlantStateFixture } from '@plant/plant-renderer/testing';

function PlantSvg() {
  if (!isPlantStateSnapshot(deterministicPlantStateFixture)) {
    return <p>Development fixture is invalid and cannot be rendered.</p>;
  }
  const model = createPlantRenderModel(deterministicPlantStateFixture);
  return (
    <svg viewBox={model.viewBox} role="img" aria-label={model.ariaLabel} xmlns="http://www.w3.org/2000/svg" shapeRendering="crispEdges" style={{ opacity: model.opacity }} className="fixture-plant-svg">
      {model.pixels.map((pixel, index) => <rect key={`plant-${index}`} x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.fill} />)}
      {model.pot.map((rect, index) => <rect key={`pot-${index}`} x={rect.x} y={rect.y} width={rect.width} height={rect.height} fill={rect.fill} />)}
    </svg>
  );
}

export default function GardenPreviewPage() {
  return (
    <main className="garden-page">
      <section className="garden-hero">
        <p className="eyebrow">Development fixture</p>
        <h1>Garden preview</h1>
        <p>
          This read-only page renders one deterministic fixture plant through the canonical shared render-model boundary.
          No plant has been published.
        </p>
      </section>
      <section className="preview-card" aria-label="Deterministic fixture plant preview">
        <PlantSvg />
        <div>
          <h2>Fixture-only rendering</h2>
          <p>The preview does not read Chrome extension storage, mutate plant state, advance lifecycle state, authenticate, call Supabase, call Stripe, call an API, or request live weather.</p>
        </div>
      </section>
    </main>
  );
}
