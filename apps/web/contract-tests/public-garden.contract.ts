import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { deterministicPlantStateFixture } from '@plant/plant-renderer/testing';
import { PUBLIC_BIOMES, serializePublicGarden, serializePublicPlant } from '../lib/garden/public.ts';
import { getGardenEnvironment, getPlantWorldPosition, SOUTH_GARDEN_TEMPLATE } from '../lib/garden/environments.ts';

const privatePlantRow = {
  id: 'gplant_public-safe-123', plot_id: 'plot_1', owner_public_id: 'pc_public-safe-123', plant_type: deterministicPlantStateFixture.plantType,
  visual_seed: String(deterministicPlantStateFixture.seed), canonical_snapshot: { ...deterministicPlantStateFixture, location: '123 Secret Street', weather: deterministicPlantStateFixture.weather ? { ...deterministicPlantStateFixture.weather, placeName: 'Secret Hamlet' } : null },
  status: 'active', added_to_garden_at: '2026-07-01T00:00:00Z', source_created_at: '2026-06-01T00:00:00Z', matured_at: '2026-06-30T00:00:00Z',
  account_id: 'private-account', auth_id: 'private-auth', installation_id: 'private-installation', credential_hash: 'private-hash',
  completed_plant_id: 'private-completed', publication_intent_id: 'private-intent', arbitrary_future_private_field: 'private',
};
const publicContributor = { public_id: 'pc_public-safe-123', display_first_name: 'Tate', state_code: 'NC', visibility_status: 'public', account_id: 'private' };

test('public plant serialization is an explicit allowlist and removes precise location data', () => {
  const output = serializePublicPlant(privatePlantRow, publicContributor);
  assert.ok(output);
  assert.deepEqual(Object.keys(output), ['id', 'plantType', 'visualSeed', 'snapshot', 'contributor', 'addedAt', 'createdAt', 'maturedAt']);
  assert.deepEqual(Object.keys(output.contributor), ['id', 'firstName', 'state']);
  assert.equal(output.snapshot.location, '');
  assert.equal(output.snapshot.weather && 'placeName' in output.snapshot.weather, false);
  const encoded = JSON.stringify(output);
  for (const secret of ['private-account', 'private-auth', 'private-installation', 'private-hash', 'private-completed', 'private-intent', 'Secret Street', 'Secret Hamlet', 'arbitrary_future_private_field']) assert.doesNotMatch(encoded, new RegExp(secret));
});

test('private or hidden contributor display data is withheld while stable public identity remains', () => {
  for (const visibility_status of ['private', 'hidden']) {
    const output = serializePublicPlant(privatePlantRow, { ...publicContributor, visibility_status });
    assert.ok(output);
    assert.deepEqual(output.contributor, { id: 'pc_public-safe-123', firstName: null, state: null });
  }
});

test('declined, removed, malformed, and arbitrary rows cannot become public plants', () => {
  assert.equal(serializePublicPlant({ ...privatePlantRow, status: 'declined' }, publicContributor), null);
  assert.equal(serializePublicPlant({ ...privatePlantRow, status: 'removed' }, publicContributor), null);
  assert.equal(serializePublicPlant({ ...privatePlantRow, canonical_snapshot: { arbitrary: true } }, publicContributor), null);
});

test('public serialization strips weather place name while retaining compatible render state', () => {
  const weather = {
    placeName: 'Exact Private Place', temperatureC: 24, humidity: 55, precipitation: 0,
    weatherCode: 1, windSpeed: 4, isDay: true, recentRain: 0, recentSunHours: 8,
    fetchedAt: '2026-06-30T00:00:00Z',
  };
  const output = serializePublicPlant({
    ...privatePlantRow,
    canonical_snapshot: { ...privatePlantRow.canonical_snapshot, weather },
  }, publicContributor);
  assert.ok(output?.snapshot.weather);
  assert.equal('placeName' in output.snapshot.weather, false);
  assert.equal(output.snapshot.weather.temperatureC, weather.temperatureC);
});

test('public garden preserves all 96 database coordinates and occupancy without returning rows directly', () => {
  const plots = Array.from({ length: 8 }, (_, row) => Array.from({ length: 12 }, (_, column) => ({ id: `plot_${row}_${column}`, row_number: row, column_number: column, plot_type: column % 4 === 3 ? 'path' : 'plantable', reserved_until: 'private' }))).flat();
  const plant = { ...privatePlantRow, plot_id: 'plot_2_4' };
  const garden = serializePublicGarden({ id: 'garden_safe', biome: 'south', garden_number: 1, status: 'closed-to-new-plants', rows: 8, columns: 12, locking_field: 'private' }, plots, [plant], [publicContributor]);
  assert.ok(garden);
  assert.equal(garden.plots.length, 96);
  assert.equal(new Set(garden.plots.map(({ row, column }) => `${row}:${column}`)).size, 96);
  assert.equal(garden.plots.filter(({ plotType }) => plotType === 'path').length, 24);
  assert.equal(garden.plots.find(({ row, column }) => row === 2 && column === 4)?.plant?.id, privatePlantRow.id);
  assert.equal(garden.plots.filter(({ plant: value }) => value).length, 1);
  assert.doesNotMatch(JSON.stringify(garden), /locking_field|reserved_until/);
});

test('all public biome routes, read APIs, deep links, and legacy receipt redirects are implemented', () => {
  assert.deepEqual(PUBLIC_BIOMES, ['south', 'north', 'west', 'central']);
  const overview = readFileSync(new URL('../app/garden/page.tsx', import.meta.url), 'utf8');
  const route = readFileSync(new URL('../app/garden/[biome]/[gardenNumber]/page.tsx', import.meta.url), 'utf8');
  const api = readFileSync(new URL('../app/api/garden/[biome]/[gardenNumber]/route.ts', import.meta.url), 'utf8');
  assert.match(overview, /redirect\(`\/garden\/\$\{encodeURIComponent\(legacy\.biome\)\}/);
  assert.match(route, /notFound\(\)/);
  assert.match(route, /getPublicGarden/);
  assert.match(api, /garden-not-found/);
});

test('grid uses the shared renderer, buttons, URL replacement, escape handling, focus restoration, and reduced motion', () => {
  const grid = readFileSync(new URL('../app/garden/garden-grid.tsx', import.meta.url), 'utf8');
  const plant = readFileSync(new URL('../app/garden/garden-plant.tsx', import.meta.url), 'utf8');
  const styles = readFileSync(new URL('../app/styles.css', import.meta.url), 'utf8');
  assert.match(plant, /createPlantRenderModel/);
  assert.doesNotMatch(plant, /model\.pot/);
  assert.match(grid, /<button/);
  assert.match(grid, /onClick=\{\(\) => open/);
  assert.match(grid, /event\.key === 'Escape'/);
  assert.match(grid, /buttonRefs\.current\.get\(id\)\?\.focus/);
  assert.match(grid, /router\.replace/);
  assert.doesNotMatch(grid, /onDoubleClick|dblclick/);
  assert.match(styles, /prefers-reduced-motion/);
  assert.match(styles, /overflow: auto/);
});

test('South Garden 1 deterministically maps only plantable logical plots into distinct world anchors', () => {
  const first = getGardenEnvironment('south', 1);
  assert.equal(first, SOUTH_GARDEN_TEMPLATE);
  assert.equal(getGardenEnvironment('south', 1), first);
  assert.equal(getGardenEnvironment('north', 1), null);
  assert.deepEqual(getPlantWorldPosition({ row: 0, column: 0, plotType: 'plantable' }, first!), { x: 210, y: 250 });
  assert.notDeepEqual(
    getPlantWorldPosition({ row: 0, column: 1, plotType: 'plantable' }, first!),
    getPlantWorldPosition({ row: 0, column: 0, plotType: 'plantable' }, first!),
  );
  const anchors = Array.from({ length: 8 }, (_, row) => Array.from({ length: 12 }, (_, column) =>
    getPlantWorldPosition({ row, column, plotType: column % 4 === 3 ? 'path' : 'plantable' }, first!),
  )).flat().filter((anchor) => anchor !== null);
  assert.equal(anchors.length, 72);
  assert.equal(new Set(anchors.map(({ x, y }) => `${x}:${y}`)).size, 72);
  assert.equal(getPlantWorldPosition({ row: 0, column: 3, plotType: 'path' }, first!), null);
});

test('presentation mapping does not mutate published plot data', () => {
  const plot = Object.freeze({ row: 2, column: 4, plotType: 'plantable' as const, occupied: true, plant: Object.freeze({ id: 'plant' }) });
  const before = JSON.stringify(plot);
  getPlantWorldPosition(plot, SOUTH_GARDEN_TEMPLATE);
  assert.equal(JSON.stringify(plot), before);
});

test('server read boundary selects explicit columns and contains no mutation operations', () => {
  const source = readFileSync(new URL('../lib/garden/server.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /select\('\*'\)/);
  assert.doesNotMatch(source, /\.insert\(|\.update\(|\.delete\(|\.upsert\(|\.rpc\(/);
  assert.match(source, /\.eq\('status', 'active'\)/);
});
