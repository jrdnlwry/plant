import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { isPlantStateSnapshot, rendererVersion, PLANT_STATE_SCHEMA_VERSION } from '@plant/plant-core';
import { biomeForState, canonicalPublicationSnapshot, GARDEN_LAYOUTS, PublicationValidationError, validateGardenPublicationRequest } from '../lib/garden/publication.ts';
import { serializePublicGarden, serializePublicPlant } from '../lib/garden/public.ts';

const expected = {
  south: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'SC', 'TN', 'TX', 'VA', 'WV', 'DC'],
  north: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'],
  west: ['AZ', 'CA', 'CO', 'ID', 'MT', 'NV', 'NM', 'OR', 'UT', 'WA', 'WY'],
  central: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'OK', 'SD', 'WI'],
} as const;

test('every supported state maps once and unsupported profile regions are rejected', () => {
  const seen = new Set<string>();
  for (const [biome, states] of Object.entries(expected)) for (const state of states) {
    assert.equal(biomeForState(state), biome); assert.equal(seen.has(state), false); seen.add(state);
  }
  for (const state of ['AK', 'HI', 'PR', 'GU', 'XX', 'ca', '', ' California ']) assert.equal(biomeForState(state), null);
});

test('each deterministic biome layout has 96 unique cells and 72 plantable plots', () => {
  for (const layout of Object.values(GARDEN_LAYOUTS)) {
    assert.equal(layout.length, 96);
    assert.equal(new Set(layout.map(({ row, column }) => `${row}:${column}`)).size, 96);
    assert.equal(layout.filter(({ plotType }) => plotType === 'plantable').length, 72);
    assert.equal(layout.filter(({ plotType }) => plotType !== 'plantable').length, 24);
    assert.ok(layout.every(({ row, column }) => row >= 0 && row < 8 && column >= 0 && column < 12));
  }
});

test('publication receipts link to the implemented garden route', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260730000000_garden_publication_foundation.sql', import.meta.url), 'utf8');
  assert.match(sql, /'\/garden\?biome='\|\|p_biome::text\|\|'&garden='\|\|g\.garden_number\|\|'&plant='\|\|gp\.id/);
  assert.doesNotMatch(sql, /'\/garden\/'\|\|p_biome/);
});

test('forward migration grants backend garden reads and repairs only versionless legacy snapshots', () => {
  const sql = readFileSync(new URL('../../../supabase/migrations/20260808000000_garden_publication_contract_and_service_grants.sql', import.meta.url), 'utf8');
  for (const table of ['gardens', 'garden_plots', 'garden_plants', 'plant_publication_receipts']) {
    assert.match(sql, new RegExp(`public\\.${table}`));
  }
  assert.match(sql, /to service_role/);
  assert.match(sql, /not \(canonical_snapshot \? 'schemaVersion'\)/);
  assert.match(sql, /not \(canonical_snapshot \? 'rendererVersion'\)/);
  assert.doesNotMatch(sql, /to (?:anon|authenticated)/);
});

const request = {
  publicationIntentId: 'publication-completed-plant-1234', completedPlantId: 'completed-plant-1234', sourceLocalPlantId: 'plant-1234', installationId: `inst_${'a'.repeat(48)}`,
  contractVersion: 1, snapshotVersion: 1,
  completedPlant: { plantType: 'fern', visualSeed: '42', createdAt: '2026-01-01T00:00:00.000Z', maturedAt: '2026-01-02T00:00:00.000Z', completedAt: '2026-01-03T00:00:00.000Z', finalState: { plantId: 'plant-1234', plantType: 'fern', seed: 42, location: 'Raleigh, NC', weatherMood: 'sunny', weatherSummary: 'Clear', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-02T00:00:00.000Z', growthStage: 4, growthProgress: 100, totalGrowth: 400, health: 80, hydration: 70, flowerCount: 0 } },
};

test('mature publication validation is strict and rejects owner data and markup', () => {
  assert.equal(validateGardenPublicationRequest(request).completedPlantId, request.completedPlantId);
  assert.throws(() => validateGardenPublicationRequest({ ...request, biome: 'south' }), PublicationValidationError);
  assert.throws(() => validateGardenPublicationRequest({ ...request, completedPlant: { ...request.completedPlant, finalState: { ...request.completedPlant.finalState, growthProgress: 99 } } }), /canonical maturity/);
  assert.throws(() => validateGardenPublicationRequest({ ...request, completedPlant: { ...request.completedPlant, finalState: { ...request.completedPlant.finalState, accountId: 'private' } } }), /prohibited/);
  assert.throws(() => validateGardenPublicationRequest({ ...request, completedPlant: { ...request.completedPlant, finalState: { ...request.completedPlant.finalState, weatherSummary: '<svg>' } } }), /prohibited/);
  assert.throws(() => validateGardenPublicationRequest(request, 65 * 1024), /64 KiB/);
});

test('versionless completed extension state persists as a renderable occupied garden plant', () => {
  const accepted = validateGardenPublicationRequest(request);
  const persisted = canonicalPublicationSnapshot(accepted);
  assert.equal(isPlantStateSnapshot(persisted), true);
  assert.equal(persisted.schemaVersion, PLANT_STATE_SCHEMA_VERSION);
  assert.equal(persisted.rendererVersion, rendererVersion);
  assert.equal(persisted.weather, null);
  assert.equal(persisted.weatherUpdatedAt, null);

  const row = {
    id: 'gplant_regression-123', plot_id: 'plot_0_0', owner_public_id: 'pc_regression-123',
    plant_type: 'fern', visual_seed: '42', canonical_snapshot: persisted, status: 'active',
    added_to_garden_at: '2026-01-03T00:00:00.000Z', source_created_at: request.completedPlant.createdAt,
    matured_at: request.completedPlant.maturedAt,
  };
  assert.ok(serializePublicPlant(row));
  const garden = serializePublicGarden(
    { id: 'garden_regression', biome: 'south', garden_number: 1, status: 'open', rows: 8, columns: 12 },
    [{ id: 'plot_0_0', row_number: 0, column_number: 0, plot_type: 'plantable' }],
    [row],
    [{ public_id: 'pc_regression-123', visibility_status: 'public', display_first_name: 'Ari', state_code: 'NC' }],
  );
  assert.ok(garden);
  assert.equal(garden.occupiedPlantCount, 1);
  assert.equal(garden.plots[0].plant?.id, row.id);
});

test('canonical publication rejects explicit incompatible schema and renderer versions', () => {
  for (const finalState of [
    { ...request.completedPlant.finalState, schemaVersion: 999 },
    { ...request.completedPlant.finalState, rendererVersion: 'future-renderer' },
  ]) {
    assert.throws(() => validateGardenPublicationRequest({
      ...request, completedPlant: { ...request.completedPlant, finalState },
    }), /renderer contract/);
  }
});
