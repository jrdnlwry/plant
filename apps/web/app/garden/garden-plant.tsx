'use client';
import { createPlantRenderModel } from '@plant/plant-renderer';
import type { PlantStateSnapshot } from '@plant/plant-core';

export function GardenPlant({ snapshot }: { snapshot: PlantStateSnapshot }) {
  const model = createPlantRenderModel(snapshot);
  return <svg viewBox={model.viewBox} aria-hidden="true" focusable="false" shapeRendering="crispEdges" className="garden-plant-svg" style={{ opacity: model.opacity }}>
    {model.pixels.map((pixel, index) => <rect key={`p${index}`} x={pixel.x} y={pixel.y} width="1" height="1" fill={pixel.fill} />)}
    {model.pot.map((part, index) => <rect key={`o${index}`} x={part.x} y={part.y} width={part.width} height={part.height} fill={part.fill} />)}
  </svg>;
}
