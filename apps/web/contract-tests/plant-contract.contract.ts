import assert from 'node:assert/strict';
import test from 'node:test';
import {
  PLANT_STATE_SCHEMA_VERSION,
  defaultPlantStateSnapshot,
  isPlantStateSnapshot,
  normalizePlantStateSnapshot,
  type PlantStateSnapshot,
} from '@plant/plant-core';

const validSnapshot: PlantStateSnapshot = normalizePlantStateSnapshot({
  ...defaultPlantStateSnapshot,
  plantType: 'blossom',
  location: 'Raleigh, NC',
  seed: 12345,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-15T00:00:00.000Z',
  weatherUpdatedAt: '2026-07-15T00:00:00.000Z',
  weather: {
    placeName: 'Raleigh, North Carolina',
    temperatureC: 22,
    humidity: 55,
    precipitation: 0,
    weatherCode: 0,
    windSpeed: 5,
    isDay: true,
    recentRain: 0,
    recentSunHours: 12,
    fetchedAt: '2026-07-15T00:00:00.000Z',
  },
});

test('web workspace accepts a valid shared plant snapshot', () => {
  assert.equal(validSnapshot.schemaVersion, PLANT_STATE_SCHEMA_VERSION);
  assert.equal(isPlantStateSnapshot(validSnapshot), true);
});

test('web workspace rejects a malformed plant snapshot', () => {
  assert.equal(isPlantStateSnapshot({ ...validSnapshot, health: 'healthy' }), false);
});

test('web workspace rejects the wrong plant schema version', () => {
  assert.equal(isPlantStateSnapshot({ ...validSnapshot, schemaVersion: '0.0.0' }), false);
});

test('web workspace rejects an incomplete nested weather object', () => {
  const { fetchedAt: _missingFetchedAt, ...incompleteWeather } = validSnapshot.weather ?? {};
  assert.equal(isPlantStateSnapshot({ ...validSnapshot, weather: incompleteWeather }), false);
});
