import assert from 'node:assert/strict';
import test from 'node:test';
import vm from 'node:vm';
import { compileModule, generate, resolveModule } from '../scripts/build-extension-renderer.mjs';

test('compiler discovers and rewrites runtime module edges without formatting assumptions', () => {
  const seen = [];
  const source = `
    import type { Hidden } from './types.ts'
    import { original as renamed, type Other } from "./dependency.ts";
    export { value as publicValue } from
      './reexport.ts';
    export type { PublicType } from './public-types.ts';
    export const result: Hidden | Other = renamed;
  `;
  const { code, dependencies } = compileModule(source, 'packages/plant-renderer/src/example.ts', (_from, specifier) => {
    seen.push(specifier);
    return `resolved/${specifier.slice(2)}`;
  });

  assert.deepEqual(seen.sort(), ['./dependency.ts', './reexport.ts']);
  assert.deepEqual(dependencies, ['resolved/dependency.ts', 'resolved/reexport.ts']);
  assert.match(code, /require\("resolved\/dependency\.ts"\)/);
  assert.match(code, /require\("resolved\/reexport\.ts"\)/);
  assert.doesNotMatch(code, /types\.ts|public-types\.ts|\bimport\b/);
});

test('resolver supports extensionless production imports and rejects non-browser dependencies', () => {
  assert.equal(resolveModule('packages/plant-core/src/index.ts', './versions'), 'packages/plant-core/src/versions.ts');
  assert.throws(() => resolveModule('packages/plant-renderer/src/index.ts', 'node:fs'), /Unsupported renderer build import/);
  assert.throws(() => resolveModule('packages/plant-renderer/src/index.ts', './testing/fixture.ts'), /test or fixture/);
});

test('generated output is deterministic, classic-script compatible, and self-contained', async () => {
  const first = await generate();
  const second = await generate();
  assert.equal(first, second);
  assert.doesNotMatch(first, /^\s*(?:import|export)\s/m);
  assert.doesNotMatch(first, /require\(["'](?:node:|@plant\/|\.)/);
  const context = vm.createContext({ globalThis: {} });
  context.globalThis = context;
  vm.runInContext(first, context);
  assert.equal(typeof context.PlantCompanionRenderer.renderPlantSvg, 'function');
});
