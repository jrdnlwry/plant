import assert from 'node:assert/strict';
import test from 'node:test';
import { isPlantStateSnapshot, PLANT_STATE_SCHEMA_VERSION } from '@plant/plant-core';
import { checkRenderCompatibility, createPlantRenderModel, renderPlantSvg, SUPPORTED_RENDERER_VERSION } from './index.ts';
import { deterministicPlantStateFixture } from './testing/fixture.ts';

test('deterministic fixture passes plant snapshot guard', () => { assert.equal(isPlantStateSnapshot(deterministicPlantStateFixture), true); });
test('valid fixture creates deterministic render output without mutation', () => {
  const before = JSON.stringify(deterministicPlantStateFixture);
  const one = createPlantRenderModel(deterministicPlantStateFixture);
  const two = createPlantRenderModel(deterministicPlantStateFixture);
  assert.deepEqual(one, two);
  assert.equal(JSON.stringify(deterministicPlantStateFixture), before);
  assert.match(renderPlantSvg(deterministicPlantStateFixture), /^<svg/);
});
test('malformed raw snapshot is rejected before rendering', () => { assert.deepEqual(checkRenderCompatibility({ rendererVersion: SUPPORTED_RENDERER_VERSION }), { supported: false, reason: 'invalid-snapshot' }); });
test('wrong schema version is an invalid snapshot, distinct from renderer incompatibility', () => {
  assert.deepEqual(checkRenderCompatibility({ ...deterministicPlantStateFixture, schemaVersion: PLANT_STATE_SCHEMA_VERSION + 1 }), { supported: false, reason: 'invalid-snapshot' });
});
test('unsupported renderer version produces clear compatibility failure', () => {
  assert.deepEqual(checkRenderCompatibility({ ...deterministicPlantStateFixture, rendererVersion: 'old-renderer' }), { supported: false, reason: 'unsupported-renderer-version', receivedVersion: 'old-renderer', supportedVersion: SUPPORTED_RENDERER_VERSION });
});
import { readFileSync } from 'node:fs';

test('extension popup and overlay call the canonical extension rendering entry point', () => {
  assert.match(readFileSync(`${process.cwd()}/apps/extension/src/popup/popup.js`, 'utf8'), /PlantCompanionState\.renderPlantSvg/);
  assert.match(readFileSync(`${process.cwd()}/apps/extension/src/content/injectPlant.js`, 'utf8'), /PlantCompanionState\.renderPlantSvg/);
});

test('website does not contain a copied renderer implementation or extension storage dependency', () => {
  const preview = readFileSync(`${process.cwd()}/apps/web/app/garden/preview/page.tsx`, 'utf8');
  assert.match(preview, /@plant\/plant-renderer/);
  assert.doesNotMatch(preview, /chrome\.storage|Date\.now\(|Math\.random\(|advancePlantState|fetch\(/);
});
