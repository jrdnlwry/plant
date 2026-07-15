import { normalizePlantStateSnapshot, type PlantStateSnapshot } from './plantSchema';
import { normalizeWeatherSnapshot, type WeatherSnapshot } from './weatherSchema';

export function serializePlantStateSnapshot(snapshot: PlantStateSnapshot): string {
  return JSON.stringify(normalizePlantStateSnapshot(snapshot));
}

export function parsePlantStateSnapshot(serialized: string): PlantStateSnapshot {
  return normalizePlantStateSnapshot(JSON.parse(serialized));
}

export function parseUnknownPlantStateSnapshot(value: unknown): PlantStateSnapshot {
  return normalizePlantStateSnapshot(value);
}

export function serializeWeatherSnapshot(snapshot: WeatherSnapshot): string {
  return JSON.stringify(normalizeWeatherSnapshot(snapshot));
}

export function parseWeatherSnapshot(serialized: string): WeatherSnapshot | null {
  return normalizeWeatherSnapshot(JSON.parse(serialized));
}
