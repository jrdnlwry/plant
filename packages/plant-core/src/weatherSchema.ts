export interface WeatherSnapshot {
  placeName?: string;
  temperatureC: number;
  humidity: number;
  precipitation: number;
  weatherCode: number;
  windSpeed: number;
  isDay: boolean;
  recentRain: number;
  recentSunHours: number;
  fetchedAt: string;
}

function toNumber(value: unknown, fallback: number): number {
  const next = Number(value);
  return Number.isFinite(next) ? next : fallback;
}

export function normalizeWeatherSnapshot(value: unknown): WeatherSnapshot | null {
  if (!value || typeof value !== 'object') return null;
  const input = value as Partial<Record<keyof WeatherSnapshot, unknown>>;
  return {
    placeName: typeof input.placeName === 'string' ? input.placeName : undefined,
    temperatureC: toNumber(input.temperatureC, 20),
    humidity: toNumber(input.humidity, 50),
    precipitation: toNumber(input.precipitation, 0),
    weatherCode: toNumber(input.weatherCode, 0),
    windSpeed: toNumber(input.windSpeed, 0),
    isDay: input.isDay !== false,
    recentRain: toNumber(input.recentRain, 0),
    recentSunHours: toNumber(input.recentSunHours, 0),
    fetchedAt: typeof input.fetchedAt === 'string' ? input.fetchedAt : new Date(0).toISOString(),
  };
}

export function isWeatherSnapshot(value: unknown): value is WeatherSnapshot {
  return Boolean(normalizeWeatherSnapshot(value));
}
