import assert from 'node:assert/strict';
import test from 'node:test';
import { createPlantRenderModel } from '@plant/plant-renderer';
import { deterministicPlantStateFixture } from '@plant/plant-renderer/testing';

test('website imports canonical renderer and fixture', () => {
  assert.equal(createPlantRenderModel(deterministicPlantStateFixture).rendererVersion, deterministicPlantStateFixture.rendererVersion);
});
