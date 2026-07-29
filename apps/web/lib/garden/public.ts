import { isPlantStateSnapshot, isPlantType, type GardenBiome, type PlantStateSnapshot } from '@plant/plant-core';

export const PUBLIC_BIOMES = ['south', 'north', 'west', 'central'] as const satisfies readonly GardenBiome[];
export const PUBLIC_GARDEN_STATUSES = ['open', 'near-capacity', 'closed-to-new-plants', 'full', 'archived'] as const;
export const PUBLIC_PLOT_TYPES = ['plantable', 'path', 'environment'] as const;

export type PublicGardenStatus = typeof PUBLIC_GARDEN_STATUSES[number];
export type PublicPlotType = typeof PUBLIC_PLOT_TYPES[number];

export interface PublicGardenPlant {
  id: string;
  plantType: PlantStateSnapshot['plantType'];
  visualSeed: string;
  snapshot: PlantStateSnapshot;
  contributor: { id: string; firstName: string | null; state: string | null };
  addedAt: string;
  createdAt: string;
  maturedAt: string;
}

export interface PublicGardenPlot {
  row: number;
  column: number;
  plotType: PublicPlotType;
  occupied: boolean;
  plant: PublicGardenPlant | null;
}

export interface PublicGarden {
  id: string;
  biome: GardenBiome;
  gardenNumber: number;
  status: PublicGardenStatus;
  rows: number;
  columns: number;
  occupiedPlantCount: number;
  plots: PublicGardenPlot[];
  previousGardenNumber: number | null;
  nextGardenNumber: number | null;
}

export interface PublicGardenSummary extends Omit<PublicGarden, 'plots' | 'previousGardenNumber' | 'nextGardenNumber'> {
  availableGardenNumbers: number[];
}

export type GardenRow = Record<string, unknown>;
export type PlotRow = Record<string, unknown>;
export type PlantRow = Record<string, unknown>;
export type ContributorRow = Record<string, unknown>;

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;
const isInteger = (value: unknown): value is number => Number.isInteger(value);
export const isPublicBiome = (value: string): value is GardenBiome => (PUBLIC_BIOMES as readonly string[]).includes(value);

function publicSnapshot(value: unknown): PlantStateSnapshot | null {
  if (!isPlantStateSnapshot(value)) return null;
  // Location and weather place names are not rendering inputs and can contain exact private locations.
  return {
    schemaVersion: value.schemaVersion,
    rendererVersion: value.rendererVersion,
    plantType: value.plantType,
    location: '',
    growthStage: value.growthStage,
    health: value.health,
    hydration: value.hydration,
    growthProgress: value.growthProgress,
    totalGrowth: value.totalGrowth,
    flowerCount: value.flowerCount,
    weatherMood: value.weatherMood,
    weatherSummary: value.weatherSummary,
    weather: value.weather ? {
      temperatureC: value.weather.temperatureC,
      humidity: value.weather.humidity,
      precipitation: value.weather.precipitation,
      weatherCode: value.weather.weatherCode,
      windSpeed: value.weather.windSpeed,
      isDay: value.weather.isDay,
      recentRain: value.weather.recentRain,
      recentSunHours: value.weather.recentSunHours,
      fetchedAt: value.weather.fetchedAt,
    } : null,
    seed: value.seed,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
    weatherUpdatedAt: value.weatherUpdatedAt,
  };
}

export function serializePublicPlant(row: PlantRow, contributor?: ContributorRow): PublicGardenPlant | null {
  const snapshot = publicSnapshot(row.canonical_snapshot);
  if (!isString(row.id) || !isPlantType(row.plant_type) || !isString(row.visual_seed) || !snapshot
    || snapshot.plantType !== row.plant_type || String(snapshot.seed) !== row.visual_seed
    || row.status !== 'active' || !isString(row.owner_public_id) || !isString(row.added_to_garden_at)
    || !isString(row.source_created_at) || !isString(row.matured_at)) return null;
  const isPublic = contributor?.visibility_status === 'public';
  return {
    id: row.id,
    plantType: row.plant_type,
    visualSeed: row.visual_seed,
    snapshot,
    contributor: {
      id: row.owner_public_id,
      firstName: isPublic && isString(contributor?.display_first_name) ? contributor.display_first_name : null,
      state: isPublic && isString(contributor?.state_code) ? contributor.state_code : null,
    },
    addedAt: row.added_to_garden_at,
    createdAt: row.source_created_at,
    maturedAt: row.matured_at,
  };
}

export function serializePublicGarden(
  garden: GardenRow,
  plots: PlotRow[],
  plants: PlantRow[],
  contributors: ContributorRow[],
  neighbors: { previous: number | null; next: number | null } = { previous: null, next: null },
): PublicGarden | null {
  if (!isString(garden.id) || !isPublicBiome(String(garden.biome)) || !isInteger(garden.garden_number)
    || !(PUBLIC_GARDEN_STATUSES as readonly unknown[]).includes(garden.status) || !isInteger(garden.rows)
    || !isInteger(garden.columns)) return null;
  const plantByPlot = new Map(plants.map((plant) => [plant.plot_id, plant]));
  const contributorById = new Map(contributors.map((item) => [item.public_id, item]));
  const publicPlots = plots.map((plot): PublicGardenPlot | null => {
    if (!isString(plot.id) || !isInteger(plot.row_number) || !isInteger(plot.column_number)
      || !(PUBLIC_PLOT_TYPES as readonly unknown[]).includes(plot.plot_type)) return null;
    const plantRow = plantByPlot.get(plot.id);
    const plant = plantRow ? serializePublicPlant(plantRow, contributorById.get(plantRow.owner_public_id)) : null;
    return { row: plot.row_number, column: plot.column_number, plotType: plot.plot_type as PublicPlotType, occupied: plant !== null, plant };
  });
  if (publicPlots.some((plot) => plot === null)) return null;
  const safePlots = publicPlots as PublicGardenPlot[];
  return {
    id: garden.id,
    biome: garden.biome as GardenBiome,
    gardenNumber: garden.garden_number,
    status: garden.status as PublicGardenStatus,
    rows: garden.rows,
    columns: garden.columns,
    occupiedPlantCount: safePlots.filter((plot) => plot.occupied).length,
    plots: safePlots,
    previousGardenNumber: neighbors.previous,
    nextGardenNumber: neighbors.next,
  };
}
