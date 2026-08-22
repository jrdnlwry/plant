const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function loadPlantStateApi() {
  const rendererSource = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/generated/plantRenderer.global.js'), 'utf8');
  const source = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/sharedPlantState.js'), 'utf8');
  const storage = {};
  const storageControl = { failNextSet: false };
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
          get: async (key) => {
            if (Array.isArray(key)) return Object.fromEntries(key.map((entry) => [entry, storage[entry]]));
            return { [key]: storage[key] };
          },
          set: async (value) => {
            if (storageControl.failNextSet) {
              storageControl.failNextSet = false;
              throw new Error('simulated storage failure');
            }
            Object.assign(storage, value);
          },
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
  vm.runInContext(rendererSource, context, { filename: 'plantRenderer.global.js' });
  vm.runInContext(source, context, { filename: 'sharedPlantState.js' });
  return { api: context.PlantCompanionState, renderer: context.PlantCompanionRenderer, storage, storageControl };
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

test('preserves the legacy zero seed and explicit seeds after creation', () => {
  const { api } = loadPlantStateApi();
  const input = { plantType: 'vine', location: ' Asheville, NC ', createdAt: '2026-02-03T04:05:06.000Z' };
  const first = api.normalizePlantState(input);
  const second = api.normalizePlantState(input);
  assert.equal(first.seed, 0);
  assert.equal(second.seed, 0);
  assert.equal(api.normalizePlantState({ ...input, seed: 987654321 }).seed, 987654321);

  const created = api.createInitialPlantState({ plantType: 'sapling', location: ' Boone, NC ' });
  assert.equal(Number.isInteger(created.seed), true, 'new lifecycles persist their visual seed');
  assert.equal(typeof created.plantId, 'string');
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
  assert.equal(state.seed, 0, 'legacy state persists the historical zero visual seed');
  assert.equal(typeof state.plantId, 'string', 'legacy state receives a local lifecycle identity');
  assert.equal(storage.ambientPlantState.plantId, state.plantId);
  assert.equal(storage.ambientPlantState.seed, 0);
});

test('manual watering is eligible once per local calendar date and persists across reloads', async () => {
  const fixture = loadPlantStateApi();
  const { api, storage } = fixture;
  await api.savePlantState(baseState(api, { hydration: 50 }));
  let rolls = 0;
  const first = await api.manuallyWaterPlant(
    { requestId: 'click-1', date: '2026-08-20' },
    { random: () => { rolls += 1; return 10 / 21; } },
  );
  assert.equal(first.status, 'watered');
  assert.equal(first.hydrationGain, 10);
  assert.equal(first.state.hydration, 60);
  assert.equal(storage.ambientPlantState.lastManuallyWateredDate, '2026-08-20');

  const sameDay = await api.manuallyWaterPlant(
    { requestId: 'click-2', date: '2026-08-20' },
    { random: () => { rolls += 1; return 1; } },
  );
  assert.equal(sameDay.status, 'already-watered');
  assert.equal(rolls, 1, 'ineligible attempts never consume randomness');

  // Re-evaluating the script simulates a popup/browser restart while retaining local storage.
  const restarted = loadPlantStateApi();
  restarted.storage.ambientPlantState = JSON.parse(JSON.stringify(storage.ambientPlantState));
  const afterRestart = await restarted.api.manuallyWaterPlant(
    { requestId: 'click-3', date: '2026-08-20' },
    { random: () => { throw new Error('must not reroll'); } },
  );
  assert.equal(afterRestart.status, 'already-watered');

  const tomorrow = await restarted.api.manuallyWaterPlant(
    { requestId: 'click-4', date: '2026-08-21' },
    { random: () => 0 },
  );
  assert.equal(tomorrow.status, 'watered');
  assert.equal(tomorrow.hydrationGain, 0, 'zero is a valid result');
});

test('manual watering rolls integer gains from 0 through 20 and clamps hydration', async () => {
  for (const expected of [0, 1, 10, 20]) {
    const { api } = loadPlantStateApi();
    await api.savePlantState(baseState(api, { hydration: 95 }));
    const result = await api.manuallyWaterPlant(
      { requestId: `roll-${expected}`, date: '2026-08-20' },
      { random: () => expected / 21 },
    );
    assert.equal(result.hydrationGain, expected);
    assert.equal(Number.isInteger(result.hydrationGain), true);
    assert.equal(result.hydrationGain >= 0 && result.hydrationGain <= 20, true);
    assert.equal(result.state.hydration, Math.min(100, 95 + expected));
  }
});

test('manual watering retries are idempotent and consume exactly one roll', async () => {
  const { api } = loadPlantStateApi();
  await api.savePlantState(baseState(api, { hydration: 40 }));
  let rolls = 0;
  const options = { random: () => { rolls += 1; return 20 / 21; } };
  const first = await api.manuallyWaterPlant({ requestId: 'stable-request', date: '2026-08-20' }, options);
  const retry = await api.manuallyWaterPlant({ requestId: 'stable-request', date: '2026-08-20' }, options);
  assert.equal(first.hydrationGain, 20);
  assert.equal(retry.status, 'already-applied');
  assert.equal(retry.hydrationGain, 20);
  assert.equal(retry.state.hydration, 60);
  assert.equal(rolls, 1);
});

test('completed and archived garden-bound plants cannot be manually watered', async () => {
  const { api } = loadPlantStateApi();
  const mature = await api.savePlantState(baseState(api, { totalGrowth: 400 }));
  await assert.rejects(
    () => api.manuallyWaterPlant({ requestId: 'too-late', date: '2026-08-20' }),
    /completed plants cannot be watered/,
  );
  const completion = await api.completePlantLifecycle({
    plantId: mature.plantId,
    expectedRevision: mature.revision,
    decision: 'accepted',
  });
  assert.equal(completion.completedPlant.gardenDecision, 'accepted');
  assert.equal(typeof api.waterGardenPlant, 'undefined', 'community garden snapshots expose no watering operation');
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

test('uses terminal stage progress as the single lifecycle completion condition', () => {
  const { api } = loadPlantStateApi();
  assert.equal(api.isPlantLifecycleComplete(baseState(api, { growthStage: 3, growthProgress: 100, flowerCount: 5 })), false);
  assert.equal(api.isPlantLifecycleComplete(baseState(api, { growthStage: 4, growthProgress: 99.99, flowerCount: 5 })), false);
  assert.equal(api.isPlantLifecycleComplete(baseState(api, { plantType: 'fern', growthStage: 4, growthProgress: 100, flowerCount: 0 })), true);
});

test('archives a completed snapshot and restarts with fresh canonical identity', async () => {
  const { api, storage } = loadPlantStateApi();
  const completed = baseState(api, { growthStage: 4, growthProgress: 100, seed: 88 });
  await api.savePlantState(completed);

  const pending = await api.getPendingLifecycleCompletion();
  assert.equal(pending.plantId, completed.plantId);
  const saved = await api.getStoredPlantState();
  const result = await api.completePlantLifecycle({
    plantId: saved.plantId,
    expectedRevision: saved.revision,
    decision: 'accepted',
  });
  assert.equal(result.completedPlant.gardenDecision, 'accepted');
  assert.equal(result.completedPlant.plantId, completed.plantId);
  assert.equal(result.completedPlant.finalState.seed, 88);
  assert.equal(result.publicationIntent.completedPlantId, result.completedPlant.completedPlantId);
  assert.equal((await api.getPublicationIntents()).length, 1);
  assert.equal(result.nextPlant.plantId === completed.plantId, false);
  assert.equal(result.nextPlant.seed === completed.seed, false);
  assert.equal(result.nextPlant.growthStage, 1);
  assert.equal(result.nextPlant.growthProgress, 0);
  assert.equal(storage.ambientPlantPendingCompletion, null);
  const duplicate = await api.completePlantLifecycle({ plantId: completed.plantId, decision: 'accepted' });
  assert.equal(duplicate.status, 'already-completed', 'the durable archive makes the decision idempotent');
  assert.equal((await api.getPlantArchive()).length, 1);
});

test('rejects stale saves after a completed lifecycle restarts', async () => {
  const { api, storage } = loadPlantStateApi();
  const completed = baseState(api, { growthStage: 4, growthProgress: 100 });
  await api.savePlantState(completed);
  const { nextPlant } = await api.completePlantLifecycle('private');

  const staleResult = await api.savePlantState({ ...completed, weatherMood: 'rainy' });

  assert.equal(staleResult.plantId, nextPlant.plantId, 'save returns the current lifecycle');
  assert.equal(storage.ambientPlantState.plantId, nextPlant.plantId, 'stale lifecycle does not replace the new plant');
  assert.equal(storage.ambientPlantPendingCompletion, null, 'stale lifecycle does not recreate completion');
  assert.equal(storage.ambientPlantArchive.length, 1, 'completed lifecycle remains archived only once');
});

test('private archives are append-only from callers and reject invalid decisions', async () => {
  const { api } = loadPlantStateApi();
  await assert.rejects(() => api.completePlantLifecycle('publish-now'), /Invalid lifecycle completion decision/);
  await api.savePlantState(baseState(api, { growthStage: 4, growthProgress: 100 }));
  await api.completePlantLifecycle('private');
  const archive = await api.getPlantArchive();
  archive[0].finalState.location = 'Mutated, NC';
  assert.equal((await api.getPlantArchive())[0].finalState.location, 'Raleigh, NC');
  assert.equal(archive[0].gardenDecision, 'declined');
  assert.equal(archive[0].gardenSubmissionStatus, 'not-requested');
  assert.equal((await api.getPublicationIntents()).length, 0);
});

test('maturity stores one durable pending timestamp while non-mature plants do not', async () => {
  const { api } = loadPlantStateApi();
  const growing = await api.savePlantState(baseState(api, { totalGrowth: 399, growthStage: 4, growthProgress: 99 }));
  assert.equal(growing.completionPendingAt, undefined);
  assert.equal((await api.getLifecycleCompletionStatus()).completionRequired, false);

  const mature = await api.savePlantState({ ...growing, totalGrowth: 400 }, { expectedRevision: growing.revision });
  const pendingAt = mature.completionPendingAt;
  const repeated = await api.savePlantState({ ...mature }, { expectedRevision: mature.revision });
  assert.equal(repeated.completionPendingAt, pendingAt);
  assert.equal((await api.getLifecycleCompletionStatus()).completionRequired, true);
});

test('decline preserves an exact independent final state and monotonic reset revision', async () => {
  const { api } = loadPlantStateApi();
  const mature = await api.savePlantState(baseState(api, {
    totalGrowth: 400,
    flowerCount: 4,
    weatherMood: 'sunny',
  }));
  const result = await api.completePlantLifecycle({
    plantId: mature.plantId,
    expectedRevision: mature.revision,
    decision: 'declined',
  });
  assert.equal(result.nextPlant.revision, mature.revision + 1);
  assert.equal(result.nextPlant.totalGrowth, 0);
  assert.notEqual(result.nextPlant.plantId, mature.plantId);
  result.nextPlant.weatherMood = 'changed';
  assert.equal((await api.getPlantArchive())[0].finalState.weatherMood, 'sunny');
});

test('completion rejects stale identities and revisions without losing the mature plant', async () => {
  const { api, storage } = loadPlantStateApi();
  const mature = await api.savePlantState(baseState(api, { totalGrowth: 400 }));
  await assert.rejects(
    () => api.completePlantLifecycle({ plantId: 'stale', decision: 'declined' }),
    /identity is stale/,
  );
  await assert.rejects(
    () => api.completePlantLifecycle({ plantId: mature.plantId, expectedRevision: mature.revision - 1, decision: 'declined' }),
    /revision is stale/,
  );
  assert.equal(storage.ambientPlantState.plantId, mature.plantId);
  assert.equal(storage.ambientPlantArchive, undefined);
});

test('a failed atomic completion commit leaves the mature plant pending and retryable', async () => {
  const { api, storage, storageControl } = loadPlantStateApi();
  const mature = await api.savePlantState(baseState(api, { totalGrowth: 400 }));
  const command = { plantId: mature.plantId, expectedRevision: mature.revision, decision: 'accepted' };
  storageControl.failNextSet = true;
  await assert.rejects(() => api.completePlantLifecycle(command), /simulated storage failure/);
  assert.equal(storage.ambientPlantState.plantId, mature.plantId);
  assert.equal(storage.ambientPlantPendingCompletion.plantId, mature.plantId);
  assert.equal(storage.ambientPlantArchive, undefined);
  const retried = await api.completePlantLifecycle(command);
  assert.equal(retried.status, 'completed');
  assert.equal(storage.ambientPlantArchive.length, 1);
  assert.equal(storage.ambientPlantPublicationIntents.length, 1);
});

test('renders deterministically for identical normalized plant state', () => {
  const { api } = loadPlantStateApi();
  const state = baseState(api, { growthStage: 4, growthProgress: 42, flowerCount: 2, weatherMood: 'sunny' });
  assert.equal(api.renderPlantSvg(state), api.renderPlantSvg({ ...state }));
  assert.match(api.renderPlantSvg(state), /<svg viewBox="0 0 32 32"/);
});

test('migrates unversioned state at a non-mutating strict snapshot boundary', () => {
  const { api, renderer } = loadPlantStateApi();
  const legacy = baseState(api, { weather: { temperatureC: 25 } });
  delete legacy.seed;
  const before = JSON.stringify(legacy);
  const snapshot = api.toRenderablePlantSnapshot(legacy);
  assert.equal(renderer.isPlantStateSnapshot(snapshot), true);
  assert.equal(snapshot.schemaVersion, renderer.plantStateVersion);
  assert.equal(snapshot.rendererVersion, renderer.rendererVersion);
  assert.equal(snapshot.seed, 0, 'seedless legacy appearance retains its historical zero RNG seed');
  assert.equal(snapshot.weather.humidity, 50);
  assert.equal(snapshot.weather.fetchedAt, '1970-01-01T00:00:00.000Z');
  assert.equal(JSON.stringify(legacy), before);
});

test('accepts current snapshots and distinguishes malformed and future-version state', () => {
  const { api, renderer } = loadPlantStateApi();
  const current = api.toRenderablePlantSnapshot(baseState(api, { seed: 42 }));
  assert.equal(renderer.isPlantStateSnapshot(api.toRenderablePlantSnapshot(current)), true);
  assert.throws(() => api.toRenderablePlantSnapshot({ location: 'Nowhere' }), /Invalid legacy plant state/);
  assert.throws(() => api.toRenderablePlantSnapshot({ ...current, schemaVersion: 2 }), /Unsupported plant state schema version/);
  assert.throws(() => api.toRenderablePlantSnapshot({ ...current, rendererVersion: 'future-renderer' }), /Unsupported plant renderer version/);
});

test('generated global and facade produce identical deterministic package-derived output', () => {
  const { api, renderer } = loadPlantStateApi();
  const snapshot = api.toRenderablePlantSnapshot(baseState(api, { seed: 12345, growthStage: 4 }));
  assert.equal(renderer.checkRenderCompatibility(snapshot).supported, true);
  assert.equal(api.renderPlantSvg(snapshot), renderer.renderPlantSvg(snapshot));
  assert.equal(renderer.renderPlantSvg(snapshot), renderer.renderPlantSvg(snapshot));
  assert.equal(Object.prototype.hasOwnProperty.call(renderer, 'deterministicPlantStateFixture'), false);
});

test('migrates legacy revision and rejects stale same-plant whole-record saves', async () => {
  const { api, storage } = loadPlantStateApi();
  storage.ambientPlantState = {
    plantType: 'blossom',
    location: 'Raleigh, NC',
    seed: 7,
    growthStage: 2,
    growthProgress: 20,
  };

  const legacy = await api.getStoredPlantState();
  assert.equal(legacy.revision, 0);
  assert.equal(storage.ambientPlantState.revision, 0, 'migration is persisted');

  const first = await api.savePlantState({ ...legacy, totalGrowth: 130 }, { expectedRevision: 0 });
  assert.equal(first.revision, 1);
  assert.equal(first.growthProgress, 30);

  const stale = await api.savePlantState({ ...legacy, totalGrowth: 125, health: 1 }, { expectedRevision: 0 });
  assert.equal(stale.revision, 1);
  assert.equal(stale.growthProgress, 30);
  assert.notEqual(stale.health, 1);
  assert.equal(storage.ambientPlantState.revision, 1);
});

test('growth progress does not reroll topology within a lifecycle stage', () => {
  const { api, renderer } = loadPlantStateApi();
  const early = api.toRenderablePlantSnapshot(baseState(api, {
    growthStage: 3,
    growthProgress: 1,
    health: 85,
    hydration: 70,
    flowerCount: 0,
  }));
  const later = { ...early, growthProgress: 99, totalGrowth: 299 };
  assert.deepEqual(renderer.createPlantRenderModel(early).pixels, renderer.createPlantRenderModel(later).pixels);
});

test('derives stage and progress from monotonic lifetime growth while preserving overflow', () => {
  const { api } = loadPlantStateApi();
  const migrated = api.normalizePlantState({ growthStage: 2, growthProgress: 35 });
  assert.equal(migrated.totalGrowth, 135);
  assert.equal(migrated.growthStage, 2);
  assert.equal(migrated.growthProgress, 35);

  const now = Date.parse('2026-07-15T00:00:00.000Z');
  const state = baseState(api, {
    totalGrowth: 95,
    health: 100,
    updatedAt: '2026-07-01T00:00:00.000Z',
    processedThrough: '2026-07-01T00:00:00.000Z',
    lastWeatherObservationAt: baseWeather.fetchedAt,
  });
  const next = api.advancePlantState(state, baseWeather, now);
  assert.equal(next.totalGrowth >= state.totalGrowth, true);
  assert.equal(next.growthStage >= 2, true, 'one update may cross every earned boundary');
  assert.equal(next.totalGrowth, (next.growthStage - 1) * 100 + next.growthProgress);
});

test('processes elapsed time and each weather observation at most once', () => {
  const { api } = loadPlantStateApi();
  const now = Date.parse('2026-07-15T00:00:00.000Z');
  const state = baseState(api, {
    totalGrowth: 100,
    processedThrough: '2026-07-14T00:00:00.000Z',
    lastWeatherObservationAt: '2026-07-14T00:00:00.000Z',
  });
  const observation = { ...baseWeather, recentSunHours: 24 };
  const once = api.advancePlantState(state, observation, now);
  const repeated = api.advancePlantState(once, observation, now);
  assert.equal(repeated.totalGrowth, once.totalGrowth);
  assert.equal(repeated.hydration, once.hydration);
  assert.equal(repeated.flowerCount, once.flowerCount);
  assert.equal(repeated.processedThrough, once.processedThrough);
});

function intervalWeather(fetchedAt, hourlyMillimeters) {
  return {
    ...baseWeather,
    fetchedAt,
    precipitation: 0,
    recentRain: 0,
    precipitationUnit: 'mm',
    precipitationSamples: hourlyMillimeters.map(([observedAt, precipitationMm]) => ({ observedAt, precipitationMm })),
  };
}

function completedIntervalWeather(fetchedAt, precipitationThroughAt, hourlyMillimeters) {
  return { ...intervalWeather(fetchedAt, hourlyMillimeters), precipitationThroughAt };
}

test('converts provider millimeters to inches exactly once', () => {
  const { api } = loadPlantStateApi();
  assert.equal(api.millimetersToInches(25.4), 1);
  assert.equal(Math.abs(api.millimetersToInches(2.286) - 0.09) < Number.EPSILON, true);
  assert.equal(api.millimetersToInches(-1), 0);
});

test('no rain in an hourly evaluation interval produces no rain hydration gain', () => {
  const { api } = loadPlantStateApi();
  const start = '2026-08-20T12:00:00.000Z';
  const end = '2026-08-20T18:00:00.000Z';
  const state = baseState(api, { hydration: 50, createdAt: start, processedThrough: start, lastWeatherEvaluationAt: start, lastWeatherObservationAt: start });
  const weather = intervalWeather(end, [13, 14, 15, 16, 17, 18].map((hour) => [`2026-08-20T${hour}:00:00.000Z`, 0]));
  const next = api.advancePlantState(state, weather, Date.parse(end));
  assert.equal(next.lastWeatherPrecipitationMm, 0);
  assert.equal(next.hydration <= state.hydration, true);
});

test('light hourly rain is accumulated in millimeters and applied once', () => {
  const { api } = loadPlantStateApi();
  const start = '2026-08-20T12:00:00.000Z';
  const end = '2026-08-20T18:00:00.000Z';
  const state = baseState(api, { hydration: 40, createdAt: start, processedThrough: start, lastWeatherEvaluationAt: start, lastWeatherObservationAt: start });
  // 0.05 + 0.04 inches = 2.286 mm at the provider boundary.
  const weather = intervalWeather(end, [0, 0, 1.27, 1.016, 0, 0].map((rain, index) => [`2026-08-20T${13 + index}:00:00.000Z`, rain]));
  const once = api.advancePlantState(state, weather, Date.parse(end));
  const retry = api.advancePlantState(once, weather, Date.parse(end));
  assert.equal(once.lastWeatherPrecipitationMm, 2.286);
  assert.equal(once.weatherMood, 'rainy');
  assert.equal(once.hydration > state.hydration, true);
  assert.equal(retry.hydration, once.hydration);
});

test('a heavy storm between checks hydrates even when the next current condition is cloudy', () => {
  const { api } = loadPlantStateApi();
  const start = '2026-08-20T12:00:00.000Z';
  const end = '2026-08-20T18:00:00.000Z';
  const state = baseState(api, { hydration: 30, createdAt: start, processedThrough: start, lastWeatherEvaluationAt: start, lastWeatherObservationAt: start });
  const weather = intervalWeather(end, [["2026-08-20T13:00:00.000Z", 0], ["2026-08-20T14:00:00.000Z", 8], ["2026-08-20T15:00:00.000Z", 9], ["2026-08-20T16:00:00.000Z", 4], ["2026-08-20T17:00:00.000Z", 0], ["2026-08-20T18:00:00.000Z", 0]]);
  weather.weatherCode = 3;
  const next = api.advancePlantState(state, weather, Date.parse(end));
  assert.equal(next.lastWeatherPrecipitationMm, 21);
  assert.equal(next.weatherMood, 'rainy');
  assert.equal(next.hydration > state.hydration, true);
});

test('rain before the evaluation boundary is not applied again', () => {
  const { api } = loadPlantStateApi();
  const start = '2026-08-20T12:00:00.000Z';
  const end = '2026-08-20T18:00:00.000Z';
  const state = baseState(api, { hydration: 50, createdAt: '2026-08-20T08:00:00.000Z', processedThrough: start, lastWeatherEvaluationAt: start, lastWeatherObservationAt: start });
  const weather = intervalWeather(end, [["2026-08-20T08:00:00.000Z", 20], ["2026-08-20T13:00:00.000Z", 0]]);
  const next = api.advancePlantState(state, weather, Date.parse(end));
  assert.equal(next.lastWeatherPrecipitationMm, 0);
  assert.equal(next.weatherMood, 'steady');
});

test('a part-hour plant creation boundary survives two weather refreshes', () => {
  const { api } = loadPlantStateApi();
  const createdAt = '2026-08-20T18:30:00.000Z';
  const state = baseState(api, {
    hydration: 40,
    createdAt,
    updatedAt: createdAt,
    processedThrough: createdAt,
    weatherUpdatedAt: null,
    lastWeatherObservationAt: null,
    lastWeatherEvaluationAt: null,
  });
  const firstWeather = completedIntervalWeather(
    '2026-08-20T18:40:00.000Z',
    '2026-08-20T18:00:00.000Z',
    [['2026-08-20T18:00:00.000Z', 12]],
  );
  const first = api.advancePlantState(state, firstWeather, Date.parse(firstWeather.fetchedAt));
  assert.equal(first.lastWeatherPrecipitationMm, 0);
  assert.equal(first.lastWeatherEvaluationAt, createdAt);

  const secondWeather = completedIntervalWeather(
    '2026-08-20T19:05:00.000Z',
    '2026-08-20T19:00:00.000Z',
    [['2026-08-20T18:00:00.000Z', 12]],
  );
  const second = api.advancePlantState(first, secondWeather, Date.parse(secondWeather.fetchedAt));
  assert.equal(second.lastWeatherPrecipitationMm, 0);
  assert.equal(second.lastWeatherPrecipitationSampleCount, 0);
  assert.equal(second.hydration <= first.hydration, true);
  assert.equal(second.lastWeatherEvaluationAt, '2026-08-20T19:00:00.000Z');
});

test('hour-adjacent creation boundaries exclude only samples before creation', () => {
  const { api } = loadPlantStateApi();
  const boundary = '2026-08-20T19:00:00.000Z';
  const sample = [['2026-08-20T18:00:00.000Z', 5]];
  const weather = completedIntervalWeather('2026-08-20T19:05:00.000Z', boundary, sample);
  const afterBoundary = '2026-08-20T18:00:00.001Z';
  const beforeBoundary = '2026-08-20T17:59:59.999Z';

  const after = api.advancePlantState(baseState(api, {
    createdAt: afterBoundary, processedThrough: afterBoundary, lastWeatherEvaluationAt: null, lastWeatherObservationAt: null,
  }), weather, Date.parse(weather.fetchedAt));
  const before = api.advancePlantState(baseState(api, {
    createdAt: beforeBoundary, processedThrough: beforeBoundary, lastWeatherEvaluationAt: null, lastWeatherObservationAt: null,
  }), weather, Date.parse(weather.fetchedAt));

  assert.equal(after.lastWeatherPrecipitationMm, 0);
  assert.equal(before.lastWeatherPrecipitationMm, 5);
});

test('provider completion boundaries keep the precipitation cursor monotonic', () => {
  const { api } = loadPlantStateApi();
  const cursor = '2026-08-20T19:00:00.000Z';
  const state = baseState(api, {
    createdAt: '2026-08-20T18:30:00.000Z', processedThrough: cursor,
    lastWeatherEvaluationAt: cursor, lastWeatherObservationAt: cursor,
  });
  const stale = completedIntervalWeather('2026-08-20T19:10:00.000Z', '2026-08-20T18:00:00.000Z', []);
  const afterStale = api.advancePlantState(state, stale, Date.parse(stale.fetchedAt));
  assert.equal(afterStale.lastWeatherEvaluationAt, cursor);
  assert.equal(afterStale.lastWeatherEvaluationWindowStart, cursor);

  const equal = completedIntervalWeather('2026-08-20T19:20:00.000Z', cursor, []);
  const afterEqual = api.advancePlantState(afterStale, equal, Date.parse(equal.fetchedAt));
  assert.equal(afterEqual.lastWeatherEvaluationAt, cursor);

  const laterBoundary = '2026-08-20T20:00:00.000Z';
  const later = completedIntervalWeather('2026-08-20T20:05:00.000Z', laterBoundary, []);
  const afterLater = api.advancePlantState(afterEqual, later, Date.parse(later.fetchedAt));
  assert.equal(afterLater.lastWeatherEvaluationAt, laterBoundary);
  assert.equal(afterLater.lastWeatherEvaluationWindowStart, cursor);
});

test('normalization and persistence repair or reject backward precipitation cursors', async () => {
  const { api } = loadPlantStateApi();
  const createdAt = '2026-08-20T18:30:00.000Z';
  const normalized = baseState(api, { createdAt, lastWeatherEvaluationAt: '2026-08-20T18:00:00.000Z' });
  assert.equal(normalized.lastWeatherEvaluationAt, createdAt);

  const cursor = '2026-08-20T20:00:00.000Z';
  const stored = await api.savePlantState({ ...normalized, lastWeatherEvaluationAt: cursor });
  const saved = await api.savePlantState(
    { ...stored, lastWeatherEvaluationAt: '2026-08-20T19:00:00.000Z' },
    { expectedRevision: stored.revision },
  );
  assert.equal(saved.lastWeatherEvaluationAt, cursor);
});

test('creation immediately before UTC midnight includes only the next hourly sample', () => {
  const { api } = loadPlantStateApi();
  const createdAt = '2026-08-20T23:59:59.999Z';
  const weather = completedIntervalWeather('2026-08-21T01:05:00.000Z', '2026-08-21T01:00:00.000Z', [
    ['2026-08-20T23:00:00.000Z', 9],
    ['2026-08-21T00:00:00.000Z', 2],
  ]);
  const next = api.advancePlantState(baseState(api, {
    createdAt, processedThrough: createdAt, lastWeatherEvaluationAt: null, lastWeatherObservationAt: null,
  }), weather, Date.parse(weather.fetchedAt));
  assert.equal(next.lastWeatherPrecipitationMm, 2);
  assert.equal(next.lastWeatherPrecipitationSampleCount, 1);
});

test('rain during missed extension activity is recovered from available hourly data', () => {
  const { api } = loadPlantStateApi();
  const start = '2026-08-17T08:00:00.000Z';
  const end = '2026-08-18T08:00:00.000Z';
  const state = baseState(api, { hydration: 35, createdAt: start, processedThrough: start, lastWeatherEvaluationAt: start, lastWeatherObservationAt: start });
  const weather = intervalWeather(end, [["2026-08-17T15:00:00.000Z", 14], ["2026-08-18T07:00:00.000Z", 0]]);
  const next = api.advancePlantState(state, weather, Date.parse(end));
  assert.equal(next.lastWeatherPrecipitationMm, 14);
  assert.equal(next.hydration > state.hydration, true);
});

test('manual watering eligibility remains independent from later interval rain', async () => {
  const { api } = loadPlantStateApi();
  const start = '2026-08-20T10:00:00.000Z';
  await api.savePlantState(baseState(api, { hydration: 20, createdAt: start, processedThrough: start, lastWeatherEvaluationAt: start, lastWeatherObservationAt: start }));
  const watered = await api.manuallyWaterPlant({ requestId: 'manual-then-rain', date: '2026-08-20' }, { random: () => 0.5 });
  const end = '2026-08-20T18:00:00.000Z';
  const weather = intervalWeather(end, [["2026-08-20T15:00:00.000Z", 12]]);
  const rained = api.advancePlantState(watered.state, weather, Date.parse(end));
  assert.equal(watered.hydrationGain, 10);
  assert.equal(rained.lastManuallyWateredDate, '2026-08-20');
  assert.equal(rained.hydration > watered.state.hydration, true);
});

test('rejects backward developmental growth for the same plant identity', async () => {
  const { api } = loadPlantStateApi();
  const current = await api.savePlantState(baseState(api, { totalGrowth: 240 }));
  const saved = await api.savePlantState({ ...current, totalGrowth: 120 }, { expectedRevision: current.revision });
  assert.equal(saved.totalGrowth, 240);
  assert.equal(saved.growthStage, 3);
  assert.equal(saved.growthProgress, 40);
});

test('flowerCount is the sole flower authority for every plant renderer', () => {
  const { api, renderer } = loadPlantStateApi();
  for (const plantType of Object.keys(api.PLANT_TYPES)) {
    const bare = api.toRenderablePlantSnapshot(baseState(api, { plantType, totalGrowth: 300, flowerCount: 0 }));
    const flowering = { ...bare, flowerCount: 1 };
    const barePixels = renderer.createPlantRenderModel(bare).pixels;
    const floweringPixels = renderer.createPlantRenderModel(flowering).pixels;
    assert.notDeepEqual(floweringPixels, barePixels, `${plantType} renders persisted flowers through the shared path`);
  }
});

test('permanent renderer coordinates grow append-only across stages', () => {
  const { api, renderer } = loadPlantStateApi();
  const coordinates = (stage) => {
    const snapshot = api.toRenderablePlantSnapshot(baseState(api, {
      totalGrowth: (stage - 1) * 100,
      flowerCount: 0,
      weatherMood: 'steady',
    }));
    return new Set(renderer.createPlantRenderModel(snapshot).pixels.map(({ x, y }) => `${x},${y}`));
  };
  const stages = [1, 2, 3, 4].map(coordinates);
  for (let index = 1; index < stages.length; index += 1) {
    for (const pixel of stages[index - 1]) assert.equal(stages[index].has(pixel), true, `${pixel} survives stage ${index + 1}`);
  }
});

test('popup and overlay delegate active lifecycle mutations to the service worker', () => {
  const popup = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/popup/popup.js'), 'utf8');
  const overlay = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/content/injectPlant.js'), 'utf8');
  const worker = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/background/weatherService.js'), 'utf8');

  for (const clientSource of [popup, overlay]) {
    assert.doesNotMatch(clientSource, /\.advancePlantState\s*\(/);
    assert.doesNotMatch(clientSource, /\.savePlantState\s*\(/);
    assert.doesNotMatch(clientSource, /\.refreshPlantStateForWeather\s*\(/);
  }
  assert.match(popup, /PLANT_REQUEST_LIFECYCLE_UPDATE/);
  assert.match(popup, /PLANT_REQUEST_COMPLETION_STATUS/);
  assert.match(popup, /PLANT_COMPLETE_LIFECYCLE/);
  assert.match(overlay, /PLANT_REQUEST_LIFECYCLE_UPDATE/);
  assert.match(worker, /enqueueLifecycleMutation/);
  assert.match(worker, /expectedRevision: state\.revision/);
  assert.match(worker, /PLANT_GET_COMPLETED_HISTORY/);
  assert.match(worker, /PlantCompanionState\.completePlantLifecycle/);
  assert.doesNotMatch(popup, /PlantCompanionState\.completePlantLifecycle/);
});

test('weather worker requests UTC hourly millimeter precipitation from the existing provider', () => {
  const worker = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/background/weatherService.js'), 'utf8');
  assert.match(worker, /api\.open-meteo\.com\/v1\/forecast/);
  assert.match(worker, /hourly: 'precipitation'/);
  assert.match(worker, /timezone: 'UTC'/);
  assert.match(worker, /precipitationUnit: forecast\.hourly_units\?\.precipitation \|\| 'mm'/);
  assert.doesNotMatch(worker, /precipitation_unit/);
});

test('setup location editing preserves the active lifecycle, watering, and archive while advancing revision', async () => {
  const { api, storage } = loadPlantStateApi();
  await api.initializePlantState({ plantType: 'blossom', location: 'Raleigh, NC' });
  let plant = await api.getStoredPlantState();
  plant = await api.savePlantState({
    ...plant,
    totalGrowth: 147.5,
    hydration: 41,
    lastManuallyWateredDate: '2026-08-21',
    lastManualWateringRequestId: 'watering-before-edit',
    lastManualWateringGain: 13,
    lifecycleStatus: 'growing',
    completionPublicationState: 'not-requested',
  }, { expectedRevision: plant.revision });
  storage.ambientPlantArchive = [{ plantId: 'previous-plant', finalState: { totalGrowth: 400 } }];
  const before = JSON.parse(JSON.stringify(plant));
  const archiveBefore = JSON.parse(JSON.stringify(await api.getPlantArchive()));

  const edited = await api.updatePlantSetup({
    plantId: plant.plantId,
    expectedRevision: plant.revision,
    plantType: plant.plantType,
    location: 'Durham, NC',
  });

  for (const field of ['plantId', 'seed', 'createdAt', 'hydration', 'totalGrowth', 'growthStage', 'growthProgress',
    'lastManuallyWateredDate', 'lastManualWateringRequestId', 'lastManualWateringGain', 'lifecycleStatus',
    'completionPublicationState']) {
    assert.equal(edited[field], before[field], `${field} survives setup editing`);
  }
  assert.equal(edited.location, 'Durham, NC');
  assert.equal(edited.revision, before.revision + 1);
  assert.deepEqual(JSON.parse(JSON.stringify(await api.getPlantArchive())), archiveBefore);
});

test('duplicate initialization reports a conflict and cannot replace an active plant', async () => {
  const { api } = loadPlantStateApi();
  await api.initializePlantState({ plantType: 'fern', location: 'Raleigh, NC' });
  let active = await api.getStoredPlantState();
  active = await api.savePlantState({ ...active, totalGrowth: 88, hydration: 37 }, { expectedRevision: active.revision });
  const before = JSON.parse(JSON.stringify(active));

  await assert.rejects(
    () => api.initializePlantState({ plantType: 'sapling', location: 'Boone, NC' }),
    /already initialized/,
  );
  assert.deepEqual(JSON.parse(JSON.stringify(await api.getStoredPlantState())), before);
});

test('location editing invalidates old weather and starts precipitation at a monotonic edit boundary', async () => {
  const { api } = loadPlantStateApi();
  await api.initializePlantState({ plantType: 'vine', location: 'Raleigh, NC' });
  let plant = await api.getStoredPlantState();
  plant = await api.savePlantState({
    ...plant,
    hydration: 33,
    totalGrowth: 125,
    weather: { ...baseWeather, placeName: 'Raleigh, North Carolina', fetchedAt: '2026-08-21T10:00:00.000Z' },
    weatherUpdatedAt: '2026-08-21T10:00:00.000Z',
    lastWeatherObservationAt: '2026-08-21T10:00:00.000Z',
    lastWeatherEvaluationAt: '2026-08-21T10:00:00.000Z',
  }, { expectedRevision: plant.revision });
  const identity = { plantId: plant.plantId, seed: plant.seed, createdAt: plant.createdAt };
  const oldCursor = plant.lastWeatherEvaluationAt;
  const edited = await api.updatePlantSetup({ plantId: plant.plantId, expectedRevision: plant.revision, plantType: 'vine', location: 'Durham, NC' });
  assert.equal(edited.weather, null, 'weather from the old location is discarded');
  assert.ok(Date.parse(edited.lastWeatherEvaluationAt) >= Date.parse(oldCursor));

  const nextBoundary = new Date(Date.parse(edited.lastWeatherEvaluationAt) + 60 * 60 * 1000).toISOString();
  const refreshed = api.advancePlantState(edited, {
    ...baseWeather,
    placeName: 'Durham, North Carolina',
    fetchedAt: nextBoundary,
    precipitationThroughAt: nextBoundary,
    precipitationSamples: [
      { observedAt: '2026-08-20T12:00:00.000Z', precipitationMm: 30 },
      { observedAt: new Date(Date.parse(edited.lastWeatherEvaluationAt) + 30 * 60 * 1000).toISOString(), precipitationMm: 0 },
    ],
  }, Date.parse(nextBoundary));
  assert.equal(refreshed.weather.placeName, 'Durham, North Carolina');
  assert.equal(refreshed.lastWeatherPrecipitationMm, 0, 'old-location historical rain is outside the new cursor');
  assert.ok(Date.parse(refreshed.lastWeatherEvaluationAt) >= Date.parse(edited.lastWeatherEvaluationAt));
  assert.deepEqual({ plantId: refreshed.plantId, seed: refreshed.seed, createdAt: refreshed.createdAt }, identity);
});

test('setup editing rejects plant-type changes without destructive initialization', async () => {
  const { api } = loadPlantStateApi();
  await api.initializePlantState({ plantType: 'fern', location: 'Raleigh, NC' });
  const plant = await api.getStoredPlantState();
  await assert.rejects(() => api.updatePlantSetup({
    plantId: plant.plantId,
    expectedRevision: plant.revision,
    plantType: 'sapling',
    location: 'Durham, NC',
  }), /Plant type cannot be changed/);
  assert.equal((await api.getStoredPlantState()).plantType, 'fern');

  const popup = fs.readFileSync(path.join(__dirname, '..', 'apps/extension/src/popup/popup.js'), 'utf8');
  assert.match(popup, /PLANT_UPDATE_SETUP/);
  assert.match(popup, /plantTypeInput\.disabled = true/);
});

test('pending publication intent becomes identity-only authorization metadata', () => {
  const { api } = loadPlantStateApi();
  const request = api.toPublicationAuthorizationRequest({ state: 'pending', publicationIntentId: 'publication-completed-plant-1234', completedPlantId: 'completed-plant-1234', localPlantId: 'plant-1234', snapshot: { private: 'not sent' } }, `inst_${'a'.repeat(48)}`);
  assert.deepEqual(JSON.parse(JSON.stringify(request)), { publicationIntentId: 'publication-completed-plant-1234', completedPlantId: 'completed-plant-1234', localPlantId: 'plant-1234', installationId: `inst_${'a'.repeat(48)}`, contractVersion: 1, snapshotVersion: 1 });
  assert.equal('snapshot' in request, false);
});
