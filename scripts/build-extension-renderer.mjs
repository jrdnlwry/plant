import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outputPath = path.join(root, 'apps/extension/src/generated/plantRenderer.global.js');
const header = `// Generated from packages/plant-renderer.\n// Do not edit directly.\n// Run: npm run build:extension-renderer\n`;
const entryIds = {
  renderer: 'packages/plant-renderer/src/index.ts',
  core: 'packages/plant-core/src/index.ts',
};
const packageEntries = { '@plant/plant-core': entryIds.core, '@plant/plant-renderer': entryIds.renderer };

function resolveModule(fromId, specifier) {
  if (packageEntries[specifier]) return packageEntries[specifier];
  if (!specifier.startsWith('.')) throw new Error(`Unsupported renderer build import: ${specifier}`);
  return path.posix.normalize(path.posix.join(path.posix.dirname(fromId), specifier));
}

async function collect(id, modules = new Map()) {
  if (modules.has(id)) return modules;
  const source = await readFile(path.join(root, id), 'utf8');
  const dependencies = [...source.matchAll(/(?:from\s+|import\s*)['"]([^'"]+)['"]/g)].map((match) => resolveModule(id, match[1]));
  const compiled = ts.transpileModule(source, {
    fileName: id,
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText.replace(/require\("([^"]+)"\)/g, (_match, specifier) => `require(${JSON.stringify(resolveModule(id, specifier))})`);
  modules.set(id, compiled);
  for (const dependency of dependencies) await collect(dependency, modules);
  return modules;
}

async function generate() {
  const modules = await collect(entryIds.renderer);
  const ordered = [...modules].sort(([a], [b]) => a.localeCompare(b));
  const factories = ordered.map(([id, source]) => `${JSON.stringify(id)}: function(module, exports, require) {\n${source}\n}`).join(',\n');
  return `${header}(() => {\n  const modules = {\n${factories}\n  };\n  const cache = {};\n  function require(id) {\n    if (cache[id]) return cache[id].exports;\n    const module = { exports: {} };\n    cache[id] = module;\n    modules[id](module, module.exports, require);\n    return module.exports;\n  }\n  const renderer = require(${JSON.stringify(entryIds.renderer)});\n  const core = require(${JSON.stringify(entryIds.core)});\n  globalThis.PlantCompanionRenderer = {\n    checkRenderCompatibility: renderer.checkRenderCompatibility,\n    createPlantRenderModel: renderer.createPlantRenderModel,\n    renderPlantSvg: renderer.renderPlantSvg,\n    isPlantStateSnapshot: core.isPlantStateSnapshot,\n    normalizePlantStateSnapshot: core.normalizePlantStateSnapshot,\n    plantStateVersion: core.plantStateVersion,\n    rendererVersion: core.rendererVersion\n  };\n})();\n`;
}

const expected = await generate();
if (process.argv.includes('--verify')) {
  let actual;
  try { actual = await readFile(outputPath, 'utf8'); } catch { throw new Error(`Generated renderer is missing: ${path.relative(root, outputPath)}. Run npm run build:extension-renderer.`); }
  if (actual !== expected) throw new Error('Generated extension renderer is stale. Run npm run build:extension-renderer and commit the result.');
  console.log('Generated extension renderer is current.');
} else {
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, expected);
  console.log(`Generated ${path.relative(root, outputPath)}.`);
}
