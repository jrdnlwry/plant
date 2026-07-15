const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPlantStateApi() {
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/sharedPlantState.js'), 'utf8');
  const storage = {};
  const context = {
    console,
    Date,
    Math,
    Number,
    String,
    Boolean,
    Promise,
    globalThis: {},
    chrome: {
      storage: {
        local: {
          get: async (key) => ({ [key]: storage[key] }),
          set: async (value) => Object.assign(storage, value),
        },
      },
      runtime: {
        sendMessage: async () => ({ ok: false, error: 'not stubbed' }),
        lastError: null,
      },
    },
  };
  context.globalThis = context;
  context.window = context;
  vm.createContext(context);
  vm.runInContext(source, context, { filename: 'sharedPlantState.js' });
  return { api: context.PlantCompanionState, storage };
}

const baseWeather = Object.freeze({
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
});

function baseState(api, overrides = {}) {
  return api.normalizePlantState({
    plantType: 'blossom',
    location: 'Raleigh, NC',
    seed: 12345,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-14T00:00:00.000Z',
    weatherUpdatedAt: '2026-07-14T00:00:00.000Z',
    weather: baseWeather,
    ...overrides,
  });
}

test('normalizes plant state defaults, types, trimming, and clamps numeric fields', () => {
  const { api } = loadPlantStateApi();
  const normalized = api.normalizePlantState({
    plantType: 'unknown',
    location: '  Durham, NC  ',
    growthStage: 99,
    health: -10,
    hydration: 200,
    growthProgress: 400,
    flowerCount: 50,
    weatherMood: 17,
    weatherSummary: null,
    weather: 'rain',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '',
  });

  assert.equal(normalized.plantType, 'fern');
  assert.equal(normalized.location, 'Durham, NC');
  assert.equal(normalized.growthStage, 4);
  assert.equal(normalized.health, 0);
  assert.equal(normalized.hydration, 100);
  assert.equal(normalized.growthProgress, 100);
  assert.equal(normalized.flowerCount, 5);
  assert.equal(normalized.weatherMood, 'starting');
  assert.equal(normalized.weatherSummary, 'Waiting for local weather');
  assert.equal(normalized.weather, null);
  assert.equal(normalized.createdAt, '2026-01-01T00:00:00.000Z');
  assert.match(normalized.updatedAt, /^\d{4}-\d{2}-\d{2}T/);
});

test('uses stable deterministic seed derivation and preserves explicit seed after creation', () => {
  const { api } = loadPlantStateApi();
  const input = { plantType: 'vine', location: ' Asheville, NC ', createdAt: '2026-02-03T04:05:06.000Z' };
  const first = api.normalizePlantState(input);
  const second = api.normalizePlantState(input);
  assert.equal(first.seed, second.seed);
  assert.equal(api.normalizePlantState({ ...input, seed: 987654321 }).seed, 987654321);

  const created = api.createInitialPlantState({ plantType: 'sapling', location: ' Boone, NC ' });
  assert.equal(created.seed, undefined, 'current creation path does not persist the computed fallback seed');
  const savedAgain = api.normalizePlantState({ ...created, seed: first.seed, location: 'Changed, NC' });
  assert.equal(savedAgain.seed, first.seed);
});

test('normalizes older or incomplete saved state safely', async () => {
  const { api, storage } = loadPlantStateApi();
  storage.ambientPlantState = { plantType: 'succulent', location: ' Cary, NC ' };
  const state = await api.getStoredPlantState();
  assert.equal(state.plantType, 'succulent');
  assert.equal(state.location, 'Cary, NC');
  assert.equal(state.health, 85);
  assert.equal(state.hydration, 70);
  assert.equal(state.growthStage, 1);
  assert.equal(state.weather, null);
  assert.equal(state.seed, undefined, 'current normalizer computes but does not attach a derived seed for older seedless state');
});

test('preserves current plant-type and weather-state behavior', () => {
  const { api } = loadPlantStateApi();
  assert.deepEqual(Object.keys(api.PLANT_TYPES), ['fern', 'succulent', 'blossom', 'vine', 'sapling']);
  assert.equal(api.FLOWER_MIN_STAGE_BY_TYPE.fern, Infinity);
  assert.equal(api.getRainIntensity({ recentRain: 0.25 }), 'light');
  assert.equal(api.getRainIntensity({ recentRain: 4 }), 'moderate');
  assert.equal(api.getRainIntensity({ precipitation: 12 }), 'heavy');
  assert.equal(api.getRainfallAmount({ recentRain: 2, precipitation: 8 }), 8);
  assert.equal(api.shouldRefreshWeather({ location: '', weather: null }), false);
  assert.equal(api.shouldRefreshWeather({ location: 'Raleigh, NC', weather: null }), true);
});

test('advances lifecycle with elapsed time, weather modifiers, and stage transition limits', () => {
  const { api } = loadPlantStateApi();
  const now = Date.parse('2026-07-15T00:00:00.000Z');
  const state = baseState(api, { growthStage: 1, growthProgress: 99, health: 100, hydration: 70 });
  const sunny = { ...baseWeather, recentSunHours: 24, fetchedAt: '2026-07-15T00:00:00.000Z' };
  const next = api.advancePlantState(state, sunny, now);

  assert.equal(next.growthStage, 2);
  assert.equal(next.growthProgress < 100, true);
  assert.equal(next.weatherMood, 'sunny');
  assert.equal(next.hydration < state.hydration, true);
  assert.equal(next.health > state.health - 2, true);

  const huge = baseState(api, { growthStage: 1, growthProgress: 100, updatedAt: '2026-07-01T00:00:00.000Z', health: 100 });
  const capped = api.advancePlantState(huge, sunny, now);
  assert.equal(capped.growthStage, 2, 'a single advancement can increase by at most one stage');
});

test('clamps lifecycle outputs and handles time passage bounds', () => {
  const { api } = loadPlantStateApi();
  const now = Date.parse('2026-07-15T00:00:00.000Z');
  const state = baseState(api, {
    updatedAt: '2026-06-01T00:00:00.000Z',
    health: 2,
    hydration: 1,
    growthProgress: 98,
    flowerCount: 5,
  });
  const hot = { ...baseWeather, temperatureC: 40, recentSunHours: 0 };
  const next = api.advancePlantState(state, hot, now);
  assert.equal(next.health >= 0 && next.health <= 100, true);
  assert.equal(next.hydration >= 0 && next.hydration <= 100, true);
  assert.equal(next.growthProgress >= 0 && next.growthProgress <= 100, true);
  assert.equal(next.flowerCount >= 0 && next.flowerCount <= 5, true);
  assert.equal(next.weatherMood, 'hot');
});

test('flower generation remains restricted by type, stage, health, mood, and weather timing', () => {
  const { api } = loadPlantStateApi();
  const now = Date.parse('2026-07-15T12:00:00.000Z');
  const sunny = { ...baseWeather, recentSunHours: 24, temperatureC: 22 };
  const fern = baseState(api, { plantType: 'fern', growthStage: 4, health: 100, flowerCount: 0 });
  assert.equal(api.advancePlantState(fern, sunny, now).flowerCount, 0);

  const lowStage = baseState(api, { plantType: 'blossom', growthStage: 3, health: 100, flowerCount: 0 });
  assert.equal(api.advancePlantState(lowStage, sunny, now).flowerCount, 0);

  const lowHealth = baseState(api, { plantType: 'blossom', growthStage: 4, health: 60, flowerCount: 1 });
  assert.equal(api.advancePlantState(lowHealth, sunny, now).flowerCount, 1);
});

test('renders deterministically for identical normalized plant state', () => {
  const { api } = loadPlantStateApi();
  const state = baseState(api, { growthStage: 4, growthProgress: 42, flowerCount: 2, weatherMood: 'sunny' });
  assert.equal(api.renderPlantSvg(state), api.renderPlantSvg({ ...state }));
  assert.match(api.renderPlantSvg(state), /<svg viewBox="0 0 32 32"/);
});
