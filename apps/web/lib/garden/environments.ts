import type { GardenBiome } from '@plant/plant-core';
import type { PublicGardenPlot } from './public';

export interface GardenWorldPosition { x: number; y: number }

export interface GardenEnvironmentTemplate {
  id: string;
  biome: GardenBiome;
  world: { width: number; height: number };
  plotToWorld(row: number, column: number): GardenWorldPosition;
}

const SOUTH_DISTRICT_X = [210, 690, 1135] as const;

/** Presentation-only coordinates. Database rows and columns remain authoritative. */
export const SOUTH_GARDEN_TEMPLATE: GardenEnvironmentTemplate = {
  id: 'south-community-farm-a',
  biome: 'south',
  world: { width: 1600, height: 1200 },
  plotToWorld(row, column) {
    const district = Math.floor(column / 4);
    const bedColumn = column % 4;
    const districtDrift = [0, 18, -12][district] ?? 0;
    return {
      x: (SOUTH_DISTRICT_X[district] ?? SOUTH_DISTRICT_X[0]) + bedColumn * 104 + (row % 2) * 8,
      y: 250 + row * 102 + districtDrift + (bedColumn === 1 ? 8 : 0),
    };
  },
};

export function getGardenEnvironment(biome: GardenBiome, gardenNumber: number): GardenEnvironmentTemplate | null {
  return biome === 'south' && gardenNumber === 1 ? SOUTH_GARDEN_TEMPLATE : null;
}

export function getPlantWorldPosition(plot: Pick<PublicGardenPlot, 'row' | 'column' | 'plotType'>, template: GardenEnvironmentTemplate): GardenWorldPosition | null {
  if (plot.plotType !== 'plantable') return null;
  return template.plotToWorld(plot.row, plot.column);
}
