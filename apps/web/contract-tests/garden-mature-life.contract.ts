import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isPlantStateSnapshot } from '@plant/plant-core';
import { deterministicPlantStateFixture as snapshot } from '@plant/plant-renderer/testing';
import { catchUpMatureLife, initialMatureLife, matureRenderSnapshot, simulateMatureDay, type GardenConditions } from '../lib/garden/mature-life.ts';

const good: GardenConditions = { temperatureC: 22, precipitationMm: 5, humidity: 60, season: 'spring' };
const dry: GardenConditions = { temperatureC: 38, precipitationMm: 0, humidity: 20, season: 'summer' };
const winter: GardenConditions = { temperatureC: 2, precipitationMm: 1, humidity: 65, season: 'winter' };
const days = (state: ReturnType<typeof initialMatureLife>, count: number, weather: GardenConditions) => {
  let current = state;
  for (let day = 2; day <= count + 1; day++) current = simulateMatureDay(current, `2026-01-${String(day).padStart(2, '0')}`, weather);
  return current;
};

test('publication initializes a separate adult state and renderer adapter never exposes juvenile stages', () => {
  const life = initialMatureLife(snapshot, '2026-01-01');
  assert.equal(life.stage, 'active_growth');
  assert.notEqual(life, snapshot);
  const stressedSnapshot = matureRenderSnapshot(snapshot, { ...life, stage: 'stress', structuralGrowth: 300 });
  assert.equal(stressedSnapshot.growthStage, 4);
  assert.equal(stressedSnapshot.growthProgress, 0);
  assert.ok(isPlantStateSnapshot(stressedSnapshot));
});

test('favorable adult days add bounded structure and foliage and can flourish', () => {
  const initial = { ...initialMatureLife(snapshot, '2026-01-01'), health: 90, hydration: 70 };
  const result = days(initial, 3, good);
  assert.equal(result.stage, 'flourish');
  assert.ok(result.structuralGrowth > initial.structuralGrowth);
  assert.ok(result.foliageDensity >= initial.foliageDensity);
  assert.ok(result.flowerCount >= initial.flowerCount);
});

test('prolonged dryness causes stress and gradual, bounded decay', () => {
  const initial = { ...initialMatureLife(snapshot, '2026-01-01'), hydration: 40, foliageDensity: 80, flowerCount: 5, structuralGrowth: 440 };
  const result = days(initial, 12, dry);
  assert.equal(result.stage, 'stress');
  assert.ok(result.health < initial.health && result.foliageDensity < initial.foliageDensity && result.flowerCount < 5);
  assert.ok(result.structuralGrowth >= 300);
});

test('winter produces living dormancy without growth, then favorable weather produces gradual recovery', () => {
  const initial = initialMatureLife(snapshot, '2026-01-01');
  const dormant = simulateMatureDay(initial, '2026-01-02', winter);
  assert.equal(dormant.stage, 'dormant');
  assert.equal(dormant.structuralGrowth, initial.structuralGrowth);
  const recovery = simulateMatureDay(dormant, '2026-01-03', good);
  assert.equal(recovery.stage, 'recovery');
  const active = days({ ...recovery, lastSimulatedDate: '2026-01-01' }, 8, good);
  assert.ok(['active_growth', 'flourish'].includes(active.stage));
});

test('same-day retry is idempotent and missed days catch up once in date order', () => {
  const initial = initialMatureLife(snapshot, '2026-01-01');
  const once = simulateMatureDay(initial, '2026-01-02', good);
  assert.equal(simulateMatureDay(once, '2026-01-02', dry), once);
  const caught = catchUpMatureLife(initial, '2026-01-05', () => good);
  assert.equal(caught.lastSimulatedDate, '2026-01-05');
  assert.deepEqual(catchUpMatureLife(caught, '2026-01-05', () => dry), caught);
});

test('migration separates mutable state, preserves snapshot, backfills, and exposes scheduler-only idempotent RPC', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260808010000_persistent_garden_mature_life.sql', import.meta.url), 'utf8');
  assert.match(sql, /current_mature_stage/);
  assert.match(sql, /update public\.garden_plants set/);
  assert.doesNotMatch(sql, /set canonical_snapshot\s*=/);
  assert.match(sql, /last_simulated_date < p_date/);
  assert.match(sql, /on conflict \(biome,simulated_date\)/);
  assert.match(sql, /revoke all on function public\.simulate_garden_mature_day/);
});

test('public reads remain mutation-free and extension lifecycle sources are untouched by garden simulation', () => {
  const server = readFileSync(new URL('../lib/garden/server.ts', import.meta.url), 'utf8');
  const extension = readFileSync(new URL('../../../apps/extension/src/sharedPlantState.js', import.meta.url), 'utf8');
  assert.doesNotMatch(server, /\.insert\(|\.update\(|\.delete\(|\.rpc\(/);
  assert.match(extension, /growthStage/);
  assert.doesNotMatch(extension, /active_growth|current_mature_stage|simulateMatureDay/);
});
