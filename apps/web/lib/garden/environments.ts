import type { GardenBiome } from '@plant/plant-core';
import type { PublicGardenPlot } from './public';

export interface GardenWorldPosition { x: number; y: number }

export interface GardenEnvironmentTemplate {
  id: string;
  biome: GardenBiome;
  world: { width: number; height: number };
  plotToWorld(row: number, column: number): GardenWorldPosition;
}

const SOUTH_ROOM_ANCHORS = [
  [{ x: 210, y: 250 }, { x: 315, y: 235 }, { x: 415, y: 275 }],
  [{ x: 675, y: 270 }, { x: 790, y: 245 }, { x: 865, y: 320 }],
  [{ x: 1240, y: 245 }, { x: 1350, y: 220 }, { x: 1430, y: 285 }],
] as const;

/** Presentation-only coordinates. Database rows and columns remain authoritative. */
export const SOUTH_GARDEN_TEMPLATE: GardenEnvironmentTemplate = {
  id: 'south-community-garden-a',
  biome: 'south',
  world: { width: 1600, height: 1200 },
  plotToWorld(row, column) {
    const district = Math.floor(column / 4);
    const bedColumn = column % 4;
    const base = SOUTH_ROOM_ANCHORS[district]?.[Math.min(bedColumn, 2)] ?? SOUTH_ROOM_ANCHORS[0][0];
    const rowDrift = [0, 18, -10, 24, -16, 12, -6, 20][row] ?? 0;
    return {
      x: base.x + rowDrift + (row % 3 === 2 ? (bedColumn - 1) * 9 : 0),
      y: base.y + row * 102 + (bedColumn === 1 ? 10 : bedColumn === 2 ? -5 : 0),
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
