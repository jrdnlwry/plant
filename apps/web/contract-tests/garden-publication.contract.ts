import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { biomeForState, GARDEN_LAYOUTS, PublicationValidationError, validateGardenPublicationRequest } from '../lib/garden/publication.ts';

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
