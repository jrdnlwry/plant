import { isPlantStateSnapshot, isPlantType, type GardenBiome, type PlantStateSnapshot } from '@plant/plant-core';
import { initialMatureLife, MATURE_STAGES, matureRenderSnapshot, type MatureLifeState, type MatureStage } from './mature-life.ts';

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
  matureLife: {
    stage: MatureStage; gardenAgeInDays: number; health: number; hydration: number;
    structuralGrowth: number; foliageDensity: number; flowerCount: number; dormantSince: string | null;
  };
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
  const publicationSnapshot = publicSnapshot(row.canonical_snapshot);
  const stage = row.current_mature_stage;
  const storedLife: MatureLifeState = {
    stage: stage as MatureStage, health: Number(row.garden_health), hydration: Number(row.garden_hydration),
    structuralGrowth: Number(row.structural_growth), foliageDensity: Number(row.foliage_density),
    flowerCount: Number(row.garden_flower_count), consecutiveUnhealthyDays: Number(row.consecutive_unhealthy_days),
    consecutiveFavorableDays: Number(row.consecutive_favorable_days), dormantSince: typeof row.dormant_since === 'string' ? row.dormant_since : null,
    lastSimulatedDate: String(row.last_simulated_date),
  };
  const hasValidStoredLife = (MATURE_STAGES as readonly unknown[]).includes(stage)
    && [storedLife.health, storedLife.hydration, storedLife.structuralGrowth, storedLife.foliageDensity, storedLife.flowerCount].every(Number.isFinite);
  // Older production schemas have the immutable publication snapshot but not the
  // mature-life columns. Derive the same initial values as the migration backfill
  // so a partially deployed schema cannot take the public route down.
  const life = hasValidStoredLife
    ? storedLife
    : publicationSnapshot
      ? initialMatureLife(publicationSnapshot, String(row.last_simulated_date ?? row.added_to_garden_at).slice(0, 10))
      : storedLife;
  const validLife = hasValidStoredLife || publicationSnapshot !== null;
  const snapshot = publicationSnapshot && validLife ? matureRenderSnapshot(publicationSnapshot, life) : null;
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
    matureLife: {
      stage: life.stage,
      gardenAgeInDays: Math.max(0, Math.floor((Date.now() - Date.parse(row.added_to_garden_at)) / 86_400_000)),
      health: life.health, hydration: life.hydration, structuralGrowth: life.structuralGrowth,
      foliageDensity: life.foliageDensity, flowerCount: life.flowerCount, dormantSince: life.dormantSince,
    },
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
