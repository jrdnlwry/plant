import { defaultPlantType, isPlantType, type PlantType } from './plantTypes.ts';
import { isWeatherSnapshot, normalizeWeatherSnapshot, type WeatherSnapshot } from './weatherSchema.ts';
import { plantStateVersion, rendererVersion } from './versions.ts';

export interface PlantStateSnapshot {
  schemaVersion: typeof plantStateVersion;
  rendererVersion: typeof rendererVersion;
  plantType: PlantType;
  location: string;
  growthStage: number;
  health: number;
  hydration: number;
  growthProgress: number;
  totalGrowth: number;
  flowerCount: number;
  weatherMood: string;
  weatherSummary: string;
  weather: WeatherSnapshot | null;
  seed: number;
  createdAt: string;
  updatedAt: string;
  weatherUpdatedAt: string | null;
}

export const defaultPlantStateSnapshot = {
  schemaVersion: plantStateVersion,
  rendererVersion,
  plantType: defaultPlantType,
  location: '',
  growthStage: 1,
  health: 85,
  hydration: 70,
  growthProgress: 0,
  totalGrowth: 0,
  flowerCount: 0,
  weatherMood: 'starting',
  weatherSummary: 'Waiting for local weather',
  weather: null,
  seed: 0,
  createdAt: new Date(0).toISOString(),
  updatedAt: new Date(0).toISOString(),
  weatherUpdatedAt: null,
} as const satisfies PlantStateSnapshot;

export function clamp(value: unknown, min: number, max: number): number {
  return Math.min(Math.max(Number(value) || 0, min), max);
}

export function hashString(value: unknown): number {
  return String(value || '').split('').reduce((hash, char) => {
    const nextHash = (hash << 5) - hash + char.charCodeAt(0);
    return nextHash >>> 0;
  }, 2166136261);
}

export function normalizePlantStateSnapshot(value: unknown, now = new Date().toISOString()): PlantStateSnapshot {
  const input = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const plantType = isPlantType(input.plantType) ? input.plantType : defaultPlantType;
  const location = typeof input.location === 'string' ? input.location.trim() : '';
  const createdAt = typeof input.createdAt === 'string' && input.createdAt ? input.createdAt : now;
  const seed = Number.isFinite(Number(input.seed)) ? Number(input.seed) >>> 0 : hashString(`${plantType}|${location}|${createdAt}`);

  const legacyTotalGrowth = (clamp(input.growthStage ?? 1, 1, 4) - 1) * 100
    + clamp(input.growthProgress ?? 0, 0, 100);
  const totalGrowth = clamp(input.totalGrowth ?? legacyTotalGrowth, 0, 400);
  const growthStage = totalGrowth >= 300 ? 4 : Math.floor(totalGrowth / 100) + 1;
  const growthProgress = totalGrowth >= 300 ? totalGrowth - 300 : totalGrowth % 100;
  return {
    schemaVersion: plantStateVersion,
    rendererVersion,
    plantType,
    location,
    growthStage,
    health: clamp(input.health ?? defaultPlantStateSnapshot.health, 0, 100),
    hydration: clamp(input.hydration ?? defaultPlantStateSnapshot.hydration, 0, 100),
    growthProgress,
    totalGrowth,
    flowerCount: clamp(input.flowerCount ?? defaultPlantStateSnapshot.flowerCount, 0, 5),
    weatherMood: typeof input.weatherMood === 'string' ? input.weatherMood : defaultPlantStateSnapshot.weatherMood,
    weatherSummary: typeof input.weatherSummary === 'string' ? input.weatherSummary : defaultPlantStateSnapshot.weatherSummary,
    weather: normalizeWeatherSnapshot(input.weather),
    seed,
    createdAt,
    updatedAt: typeof input.updatedAt === 'string' && input.updatedAt ? input.updatedAt : now,
    weatherUpdatedAt: typeof input.weatherUpdatedAt === 'string' ? input.weatherUpdatedAt : null,
  };
}

function hasFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

export function isPlantStateSnapshot(value: unknown): value is PlantStateSnapshot {
  if (!value || typeof value !== 'object') return false;

  const input = value as Record<keyof PlantStateSnapshot, unknown>;
  const derivedStage = hasFiniteNumber(input.totalGrowth)
    ? (input.totalGrowth >= 300 ? 4 : Math.floor(input.totalGrowth / 100) + 1) : 0;
  const derivedProgress = hasFiniteNumber(input.totalGrowth)
    ? (input.totalGrowth >= 300 ? input.totalGrowth - 300 : input.totalGrowth % 100) : -1;
  return input.schemaVersion === plantStateVersion
    && input.rendererVersion === rendererVersion
    && isPlantType(input.plantType)
    && typeof input.location === 'string'
    && hasFiniteNumber(input.growthStage) && input.growthStage >= 1 && input.growthStage <= 4
    && hasFiniteNumber(input.health) && input.health >= 0 && input.health <= 100
    && hasFiniteNumber(input.hydration) && input.hydration >= 0 && input.hydration <= 100
    && hasFiniteNumber(input.growthProgress) && input.growthProgress >= 0 && input.growthProgress <= 100
    && hasFiniteNumber(input.totalGrowth) && input.totalGrowth >= 0 && input.totalGrowth <= 400
    && input.growthStage === derivedStage && input.growthProgress === derivedProgress
    && hasFiniteNumber(input.flowerCount) && input.flowerCount >= 0 && input.flowerCount <= 5
    && typeof input.weatherMood === 'string'
    && typeof input.weatherSummary === 'string'
    && (input.weather === null || isWeatherSnapshot(input.weather))
    && hasFiniteNumber(input.seed)
    && typeof input.createdAt === 'string' && input.createdAt.length > 0
    && typeof input.updatedAt === 'string' && input.updatedAt.length > 0
    && (input.weatherUpdatedAt === null || typeof input.weatherUpdatedAt === 'string');
}
